const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const QRCode = require('qrcode');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(path.join(PROJECT_ROOT, '.env'));
  } catch (error) {
    console.warn('⚠️ .env LAB tidak dapat dimuat:', error.message || error);
  }
}

function patchWhatsAppWebMediaBug() {
  const projectRoot = PROJECT_ROOT;
  const utilsPath = path.join(
    projectRoot,
    'node_modules',
    'whatsapp-web.js',
    'src',
    'util',
    'Injected',
    'Utils.js'
  );

  if (!fs.existsSync(utilsPath)) {
    console.warn('⚠️ Utils.js whatsapp-web.js tidak ditemukan; patch media dilewati.');
    return;
  }

  let source = fs.readFileSync(utilsPath, 'utf8');

  if (source.includes('delete message.__x_id;')) {
    console.log('✅ Patch media whatsapp-web.js sudah aktif');
    return;
  }

  const markerRegex = /(\.\.\.extraOptions,\r?\n\s*\};)/;
  const match = source.match(markerRegex);

  if (!match) {
    console.warn('⚠️ Marker Utils.js tidak cocok; patch media tidak diterapkan.');
    return;
  }

  const backupPath = `${utilsPath}.backup`;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(utilsPath, backupPath);
  }

  source = source.replace(
    markerRegex,
    `$1\n        // Workaround whatsapp-web.js media regression (MediaData.__x_id)\n        delete message.__x_id;`
  );

  fs.writeFileSync(utilsPath, source, 'utf8');
  console.log('✅ Patch media whatsapp-web.js berhasil diterapkan');
}

// Apply patch BEFORE whatsapp-web.js is initialized.
patchWhatsAppWebMediaBug();

let client = null;
let clientReady = false;
let isResetting = false;
let initializing = null;
let initializingStartedAt = 0;
let qrDataUrl = null;
let lastInitError = null;

const CONFIG = {
  PORT: 9000,
  MESSAGE_DELAY: 4000,
  READY_TIMEOUT: 60000,
  DOWNLOAD_TIMEOUT: 30000,
  PDF_MAX_MB: 16,
  PDF_URL_BASE:
    'http://192.168.0.16/serverx/assets/rme/pdf/172.16.18.18/Hasil-Pemeriksaan-Laboratorium-',
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function normalizeNumber(number) {
  const n = String(number || '').replace(/\D/g, '');

  if (!n) return '';
  if (n.startsWith('0')) return '62' + n.slice(1);
  if (n.startsWith('8')) return '62' + n;
  if (n.startsWith('62')) return n;

  return n;
}

function isProtocolError(err) {
  const msg = String(err?.message || '');

  return (
    msg.includes('Target closed') ||
    msg.includes('Protocol error') ||
    msg.includes('Session closed') ||
    msg.includes('Execution context was destroyed') ||
    err?.name === 'ProtocolError'
  );
}

async function downloadPDF(url, noReg) {
  const res = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: CONFIG.DOWNLOAD_TIMEOUT,
    validateStatus: (status) => status >= 200 && status < 300,
  });

  const buffer = Buffer.from(res.data);

  if (!buffer.length) {
    throw new Error(`PDF kosong untuk no_reg ${noReg}`);
  }

  if (buffer.length / 1024 / 1024 > CONFIG.PDF_MAX_MB) {
    throw new Error(`PDF lebih dari ${CONFIG.PDF_MAX_MB}MB`);
  }

  // PDF normally begins with %PDF. Do not hard-fail if the server omits the
  // signature, but make an HTML/error response obvious in logs.
  const header = buffer.subarray(0, 4).toString('ascii');
  if (header !== '%PDF') {
    console.warn(`⚠️ Respons PDF ${noReg} tidak diawali %PDF (header: ${JSON.stringify(header)})`);
  }

  return new MessageMedia(
    'application/pdf',
    buffer.toString('base64'),
    `Hasil-Pemeriksaan-Laboratorium-${noReg}.pdf`
  );
}

function createClient() {
  const newClient = new Client({
    authStrategy: new LocalAuth({
      clientId: 'lab-gateway',
      dataPath: path.join(PROJECT_ROOT, '.wwebjs_auth_lab'),
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-background-networking',
        '--disable-renderer-backgrounding',
      ],
    },
    bypassCSP: true,
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    patchMessageBeforeSending: (message) => {
      if (message?.markedUnread !== undefined) {
        delete message.markedUnread;
      }
      return message;
    },
  });

  newClient.on('qr', async (qr) => {
    try {
      qrDataUrl = await QRCode.toDataURL(qr, {
        width: 240,
        margin: 1
      });
      lastInitError = null;
      console.log('QR WhatsApp siap. Buka browser ke http://localhost:9000');
    } catch (err) {
      console.error('❌ Gagal membuat QR browser:', err.message);
    }
  });

  newClient.on('authenticated', () => {
    console.log('🔐 WhatsApp authenticated');
    qrDataUrl = null;
    lastInitError = null;
  });

  newClient.on('ready', () => {
    clientReady = true;
    qrDataUrl = null;
    lastInitError = null;
    console.log('ℹ️ Event ready terpanggil');
    console.log('🟢 WhatsApp CONNECTED & SIAP KIRIM');
  });

  newClient.on('auth_failure', (msg) => {
    clientReady = false;
    console.error('❌ Auth failure:', msg);
  });

  newClient.on('disconnected', (reason) => {
    clientReady = false;
    console.log('⚠️ WhatsApp disconnected:', reason);

    if (reason !== 'LOGOUT') {
      console.log('ℹ️ Client disconnected; reconnect akan dicoba saat diperlukan.');
    }
  });

  newClient.on('change_state', (state) => {
    if (state === 'CONNECTED') {
      clientReady = true;
    } else if (state === 'UNPAIRED' || state === 'UNPAIRED_IDLE') {
      clientReady = false;
    }
  });

  return newClient;
}

async function waitUntilConnected(targetClient = client) {
  const start = Date.now();

  while (Date.now() - start < CONFIG.READY_TIMEOUT) {
    if (targetClient !== client) {
      throw new Error('Client berubah saat proses koneksi berlangsung');
    }

    if (clientReady) {
      return;
    }

    try {
      const state = await targetClient.getState();
      if (state === 'CONNECTED') {
        clientReady = true;
        console.log('🟢 WhatsApp CONNECTED & SIAP KIRIM');
        return;
      }
    } catch (_) {
      // Tunggu percobaan berikutnya.
    }

    await delay(1000);
  }

  throw new Error('Timeout: WhatsApp tidak CONNECTED');
}

function initializeClient() {
  if (initializing) return initializing;

  initializingStartedAt = Date.now();
  lastInitError = null;

  initializing = (async () => {
    try {
      if (!client) {
        client = createClient();
      }

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Timeout initialize WhatsApp LAB setelah 90 detik.'));
        }, 90000).unref();
      });

      await Promise.race([
        client.initialize(),
        timeoutPromise
      ]);

      return client;
    } catch (err) {
      clientReady = false;
      lastInitError = err.message || String(err);
      console.error('❌ Gagal initialize WhatsApp LAB:', lastInitError);

      try {
        if (client) {
          await client.destroy();
        }
      } catch (_) {}

      client = null;
      throw err;
    } finally {
      initializing = null;
    }
  })();

  return initializing;
}

async function resetClient() {
  if (isResetting) {
    console.log('🔄 Reset sudah berjalan, menunggu...');

    const start = Date.now();
    while (isResetting && Date.now() - start < CONFIG.READY_TIMEOUT) {
      await delay(1000);
    }

    if (!clientReady) {
      throw new Error('Client belum CONNECTED setelah reset sebelumnya');
    }

    return;
  }

  isResetting = true;
  clientReady = false;

  console.log('🔄 Mereset WhatsApp client...');

  const oldClient = client;

  try {
    if (oldClient) {
      await oldClient.destroy().catch((e) => {
        console.log('ℹ️ destroy error (diabaikan):', e.message);
      });
    }

    client = null;
    await delay(2000);

    client = createClient();
    await client.initialize();
    await waitUntilConnected(client);

    console.log('✅ Client berhasil direset & reconnected');
  } finally {
    isResetting = false;
  }
}

async function ensureReady() {
  if (clientReady && client) return;

  if (isResetting) {
    throw new Error('WhatsApp sedang melakukan recovery. Silakan coba lagi.');
  }

  if (!client) client = createClient();

  try {
    await initializeClient();
    await waitUntilConnected(client);
  } catch (err) {
    if (isResetting) throw err;
    console.warn('⚠️ Client belum ready, mencoba reset...', err.message);
    await resetClient();
  }
}

async function sendToOneNumber(number, message) {
  const noReg = String(message || '').substring(0, 7);
  const caption = String(message || '').substring(7).trim();
  const intl = normalizeNumber(number);

  if (!intl) {
    throw new Error('Nomor WhatsApp kosong atau tidak valid');
  }

  const pdfUrl = `${CONFIG.PDF_URL_BASE}${noReg}.pdf`;

  console.log(`📄 Mengambil PDF no_reg ${noReg} dari ${pdfUrl}`);
  const media = await downloadPDF(pdfUrl, noReg);

  // Resolve the actual WhatsApp ID first. This avoids constructing a stale or
  // invalid recipient id manually when WhatsApp Web has changed addressing.
  const resolved = await client.getNumberId(intl);

  if (!resolved) {
    throw new Error(`Nomor ${number} (${intl}) tidak terdaftar di WhatsApp`);
  }

  const chatId = resolved._serialized || `${intl}@c.us`;
  console.log(`📱 Recipient resolved: ${chatId}`);

  return client.sendMessage(chatId, media, {
    caption,
    sendSeen: false,
    sendMediaAsDocument: true,
  });
}

const sendMessage = async (numbers, message) => {
  if (!numbers || !String(message || '').trim()) {
    throw new Error('numbers dan message wajib diisi');
  }

  await ensureReady();

  const list = String(numbers)
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean);

  if (!list.length) {
    throw new Error('Tidak ada nomor WhatsApp yang valid');
  }

  const results = [];

  for (const number of list) {
    let retries = 2;

    while (retries >= 0) {
      try {
        await ensureReady();

        await sendToOneNumber(number, message);

        const intl = normalizeNumber(number);
        console.log(`✅ Terkirim ke ${intl}`);

        results.push({
          number: intl,
          status: 1,
          message: 'Terkirim',
        });

        break;
      } catch (err) {
        console.error(`❌ Gagal ke ${number}: ${err.message}`);

        if (isProtocolError(err) && retries > 0) {
          console.warn(
            `⚠️ ProtocolError ke ${number}, reset client... (sisa retry: ${retries})`
          );

          try {
            await resetClient();
          } catch (resetErr) {
            console.error('❌ Reset gagal:', resetErr.message);
            results.push({
              number,
              status: 2,
              message: resetErr.message,
            });
            break;
          }

          retries--;
          continue;
        }

        results.push({
          number,
          status: 2,
          message: err.message,
        });

        break;
      }
    }

    if (list.length > 1) {
      await delay(CONFIG.MESSAGE_DELAY);
    }
  }

  return results;
};

// Start WhatsApp once when this module is loaded.
initializeClient().catch(() => {});

async function shutdown() {
  clientReady = false;
  try {
    if (client) await client.destroy();
  } catch (err) {
    console.warn('⚠️ Gagal menutup client LAB:', err.message);
  } finally {
    client = null;
  }
}

function getStatus() {
  return {
    ready: clientReady,
    state: clientReady
      ? 'READY'
      : (qrDataUrl ? 'QR_READY' : (lastInitError ? 'ERROR' : 'STARTING')),
    qrAvailable: Boolean(qrDataUrl),
    qrDataUrl,
    error: lastInitError,
    initializingStartedAt
  };
}

const app = express();
const port = 9000;

app.disable('x-powered-by');

app.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

    const status = getStatus();
    const ready = status.ready;
    const qrAvailable = status.qrAvailable;
    const state = status.state;
    const qrSource = status.qrDataUrl;

    let content = '';
    let heading = 'Menyiapkan WhatsApp...';
    let description = 'Mohon tunggu, service WhatsApp sedang menyiapkan koneksi.';

    if (ready) {
        heading = 'WhatsApp Terhubung';
        description = 'WhatsApp sudah terhubung dan siap digunakan.';
        content = '<div class="ready-icon">✓</div>';
    } else if (qrAvailable) {
        heading = 'Scan QR WhatsApp';
        description = 'Buka WhatsApp di HP, pilih Perangkat tertaut, lalu scan QR ini.';
        content = '<div class="qr-wrap"><img class="qr" src="' + qrSource + '" alt="QR WhatsApp"></div>';
    } else if (state === 'ERROR') {
        heading = 'Gagal Menyiapkan WhatsApp';
        description = status.error || 'WhatsApp gagal diinisialisasi.';
        content = '<div class="ready-icon" style="background:#dc3545">×</div>';
    } else {
        content = '<div class="waiting"><div class="spinner"></div></div>';
    }

    let html = [
        '<!doctype html>',
        '<html lang="id">',
        '<head>',
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        '<title>WhatsApp Gateway · Lab</title>',
        '<style>',
        '*{box-sizing:border-box}',
        'html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif}',
        'body{background:#f8f9fa;color:#495057}',
        '.page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}',
        '.card{width:min(640px,100%);min-height:475px;background:#fff;border:1px solid #ececec;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;text-align:center;padding:42px}',
        '.content{width:100%}',
        '.title{font-size:14px;font-weight:700;color:#198754;margin-bottom:24px}',
        '.qr-wrap{display:flex;justify-content:center;margin-bottom:28px}',
        '.qr{width:230px;height:230px;display:block;border:1px solid #dee2e6;border-radius:7px;padding:8px;background:#fff}',
        '.waiting{width:230px;height:230px;margin:0 auto 28px;border:1px solid #dee2e6;border-radius:7px;display:flex;align-items:center;justify-content:center;background:#fff}',
        '.spinner{width:42px;height:42px;border:4px solid #e9ecef;border-top-color:#198754;border-radius:50%;animation:spin 1s linear infinite}',
        '.ready-icon{width:92px;height:92px;margin:0 auto 28px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#198754;color:#fff;font-size:58px;font-weight:700}',
        '.desc{font-size:16px;line-height:1.6;color:#6c757d;margin-bottom:20px}',
        '.status{font-size:13px;color:#6c757d;margin-bottom:18px}',
        '.refresh{border:1px solid #adb5bd;background:#fff;color:#6c757d;border-radius:4px;padding:7px 12px;font-size:14px;cursor:pointer}',
        '.refresh:hover{background:#f1f3f5}',
        '@keyframes spin{to{transform:rotate(360deg)}}',
        '</style>',
        '</head>',
        '<body>',
        '<main class="page">',
        '<section class="card">',
        '<div class="content">',
        '<div class="title">', heading, '</div>',
        content,
        '<div class="desc">', description, '</div>',
        '<div class="status">Status: ', state, '</div>',
        '<button class="refresh" type="button" onclick="location.reload()">Refresh</button>',
        '</div>',
        '</section>',
        '</main>',
        '</body>',
        '</html>'
    ].join('');

    if (!ready && state !== 'ERROR') {
        html += '<script>setTimeout(function(){location.reload()},2000)</script>';
    }

    res.send(html);
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'online',
  });
});

app.post('/send', async (req, res) => {
  const { numbers, message } = req.body || {};

  if (typeof numbers !== 'string' || typeof message !== 'string' || numbers.trim() === '' || message.trim() === '') {
    return res.status(400).json({
      success: false,
      message: 'numbers dan message wajib diisi',
    });
  }

  try {
    const results = await sendMessage(numbers, message);

    const allSuccess = results.length > 0 && results.every((item) => item.status === 1);

    return res.status(allSuccess ? 200 : 207).json({
      success: allSuccess,
      data: results,
    });
  } catch (error) {
    console.error('❌ Error /send:', error.stack || error.message);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint tidak ditemukan',
  });
});

const server = app.listen(port, '0.0.0.0', () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 WhatsApp Gateway Server');
  console.log(`📡 http://192.168.0.93:${port}`);
  console.log('📨 POST /send');
  console.log('❤️  GET  /health');
  console.log('='.repeat(60) + '\n');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} sedang digunakan proses lain.`);
    console.error('ℹ️ Jangan jalankan node server.js kedua kali.');
  } else {
    console.error('❌ Server error:', error);
  }
});

let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n🛑 Menghentikan WhatsApp Gateway (${signal})...`);

  const forceTimer = setTimeout(() => {
    console.error('❌ Graceful shutdown timeout; proses dihentikan.');
    process.exit(1);
  }, 15000);
  forceTimer.unref();

  try {
    await shutdownWhatsApp();
  } finally {
    await new Promise((resolve) => {
      db.end(() => {
        server.close(() => resolve());
      });
    });

    clearTimeout(forceTimer);
    console.log('✅ Server berhenti.');
    process.exit(0);
  }
}

process.on('SIGINT', () => { void gracefulShutdown('SIGINT'); });
process.on('SIGTERM', () => { void gracefulShutdown('SIGTERM'); });
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error.stack || error.message || error);
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ Unhandled rejection:', reason);
});
