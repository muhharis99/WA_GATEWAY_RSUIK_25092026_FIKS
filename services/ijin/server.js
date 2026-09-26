const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(path.join(PROJECT_ROOT, '.env'));
  } catch (error) {
    console.warn('⚠️ .env IJIN tidak dapat dimuat:', error.message || error);
  }
}

let clientReady = false;
let initializing = null;
let qrDataUrl = null;

const AUTH_PATH = path.join(PROJECT_ROOT, '.wwebjs_auth_ijin');

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: AUTH_PATH
  }),

  puppeteer: {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  }

});

client.on('qr', async (qr) => {
  try {
    qrDataUrl = await QRCode.toDataURL(qr, {
      width: 240,
      margin: 1
    });
    console.log('QR WhatsApp siap. Buka browser ke http://localhost:3000');
  } catch (err) {
    console.error('❌ Gagal membuat QR browser:', err.message);
  }
});

client.on('authenticated', () => {
  console.log('🔐 WhatsApp authenticated');
  qrDataUrl = null;
});

client.on('ready', async () => {
  clientReady = true;
  qrDataUrl = null;

  console.log('\n========================================');
  console.log('🟢 WHATSAPP READY');
  console.log('========================================');

  try {
    const version = await client.getWWebVersion();
    console.log('🌐 WhatsApp Web Version:', version);
  } catch (err) {
    console.warn('⚠️ Tidak dapat membaca WA Web version:', err.message);
  }

  try {
    const state = await client.getState();
    console.log('🔍 State:', state);
  } catch (err) {
    console.warn('⚠️ Tidak dapat membaca state:', err.message);
  }

  console.log('========================================\n');
});

client.on('auth_failure', (msg) => {
  console.error('❌ WhatsApp auth failure:', msg);
  clientReady = false;
});

client.on('disconnected', async (reason) => {
  console.warn('🔴 WhatsApp disconnected:', reason);

  clientReady = false;

});

client.on('change_state', (state) => {
  console.log('🔄 WhatsApp state berubah:', state);

  if (state === 'CONNECTED') {
    clientReady = true;
  } else if (
    state === 'DISCONNECTED' ||
    state === 'UNPAIRED' ||
    state === 'UNPAIRED_IDLE'
  ) {
    clientReady = false;
  }
});

client.on('error', (err) => {
  console.error('❌ WhatsApp client error:', err.message);
});

const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

function normalizeNumber(number) {
  const n = String(number || '').replace(/\D/g, '');

  if (!n) {
    return null;
  }

  if (n.startsWith('0')) {
    return '62' + n.slice(1);
  }

  if (n.startsWith('8')) {
    return '62' + n;
  }

  if (n.startsWith('62')) {
    return n;
  }

  return n;
}

async function ensureConnected() {
  try {
    const state = await client.getState();

    console.log('🔍 Current state:', state);

    if (state === 'CONNECTED') {
      clientReady = true;
      return true;
    }

    clientReady = false;

    console.warn('⚠️ WhatsApp belum CONNECTED:', state);

    return false;

  } catch (err) {
    clientReady = false;

    console.error(
      '❌ Gagal mengecek state WhatsApp:',
      err.message
    );

    return false;
  }
}

async function sendMessage(numbers, message) {

  if (!clientReady) {
    const connected = await ensureConnected();

    if (!connected) {
      throw new Error(
        'WhatsApp belum READY / CONNECTED. Silakan scan QR atau tunggu koneksi.'
      );
    }
  }

  if (!numbers || !message) {
    throw new Error('Nomor dan pesan wajib diisi.');
  }

  const list = String(numbers)
    .split(',')
    .map(n => n.trim())
    .filter(Boolean);

  const results = [];

  console.log(`📨 Total penerima: ${list.length}`);

  for (const originalNumber of list) {

    const intl = normalizeNumber(originalNumber);

    if (!intl) {
      console.error(`❌ Nomor tidak valid: ${originalNumber}`);

      results.push({
        number: originalNumber,
        status: 2
      });

      continue;
    }

    const chatId = `${intl}@c.us`;

    console.log(`\n📤 Mengirim ke: ${intl}`);

    try {

      const connected = await ensureConnected();

      if (!connected) {
        throw new Error(
          'WhatsApp terputus sebelum pengiriman.'
        );
      }

      let isRegistered = false;

      try {
        isRegistered = await client.isRegisteredUser(chatId);
      } catch (err) {
        console.warn(
          `⚠️ Gagal mengecek nomor ${intl}:`,
          err.message
        );

        // Kita tetap coba kirim.
        isRegistered = true;
      }

      if (!isRegistered) {
        console.warn(
          `⚠️ Nomor ${intl} tidak terdaftar di WhatsApp`
        );

        results.push({
          number: intl,
          status: 2
        });

        continue;
      }

      let sent = false;

      for (let attempt = 1; attempt <= 2; attempt++) {

        try {

          console.log(
            `📨 Attempt ${attempt}/2 -> ${intl}`
          );

          // PENTING:
          // Jangan gunakan { sendSeen: false }
          await client.sendMessage(
            chatId,
            message
          );

          console.log(
            `✅ BERHASIL terkirim ke ${intl}`
          );

          results.push({
            number: intl,
            status: 1
          });

          sent = true;

          break;

        } catch (err) {

          console.error(
            `❌ Gagal attempt ${attempt} ke ${intl}:`,
            err.message
          );

          if (attempt === 1) {
            console.log(
              '⏳ Tunggu 5 detik sebelum retry...'
            );

            await delay(5000);

            const connectedAfterError =
              await ensureConnected();

            if (!connectedAfterError) {
              throw new Error(
                'WhatsApp terputus setelah gagal mengirim.'
              );
            }
          } else {
            throw err;
          }
        }
      }

      if (!sent) {
        throw new Error('Gagal mengirim pesan.');
      }

    } catch (err) {

      console.error(
        `❌ FINAL ERROR ${originalNumber}:`,
        err.message
      );

      results.push({
        number: intl,
        status: 2
      });
    }

    /*
     * Delay antar nomor.
     * 7 detik seperti sistem lama.
     */
    await delay(7000);
  }

  return results;
}

function initializeClient() {
  if (initializing) return initializing;

  initializing = (async () => {
    try {
      console.log('\n========================================');
      console.log('🚀 Initializing WhatsApp client...');
      console.log('========================================\n');
      await client.initialize();
      return client;
    } catch (err) {
      console.error('❌ Gagal initialize WhatsApp:', err.message);
      throw err;
    } finally {
      initializing = null;
    }
  })();

  return initializing;
}

initializeClient().catch(() => {});

async function shutdown() {
  clientReady = false;
  try {
    await client.destroy();
  } catch (err) {
    console.warn('⚠️ Gagal menutup client IJIN:', err.message);
  }
}

function getStatus() {
  return {
    ready: clientReady,
    state: clientReady ? 'READY' : (qrDataUrl ? 'QR_READY' : 'STARTING'),
    qrAvailable: Boolean(qrDataUrl),
    qrDataUrl
  };
}

const app = express();
app.disable('x-powered-by');
const port = 3000;

app.get('/', (req, res) => {
  const status = getStatus();
  const qrMarkup = status.qrAvailable
    ? '<div class="qr-wrap"><img class="qr" src="' + status.qrDataUrl + '" alt="QR WhatsApp"></div>'
    : '<div class="waiting"><div class="spinner"></div></div>';
  const heading = status.ready ? 'WhatsApp Terhubung' : 'Scan QR WhatsApp';
  const description = status.ready
    ? 'WhatsApp sudah terhubung dan siap digunakan.'
    : 'Buka WhatsApp di HP, pilih Perangkat tertaut, lalu scan QR ini.';
  res.send(`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp Gateway · IJIN</title><style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif}body{background:#f8f9fa;color:#495057}.page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{width:min(640px,100%);min-height:475px;background:#fff;border:1px solid #ececec;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;text-align:center;padding:42px}.content{width:100%}.title{font-size:14px;font-weight:700;color:#198754;margin-bottom:24px}.qr-wrap{display:flex;justify-content:center;margin-bottom:28px}.qr{width:230px;height:230px;display:block;border:1px solid #dee2e6;border-radius:7px;padding:8px;background:#fff}.waiting{width:230px;height:230px;margin:0 auto 28px;border:1px solid #dee2e6;border-radius:7px;display:flex;align-items:center;justify-content:center;background:#fff}.spinner{width:42px;height:42px;border:4px solid #e9ecef;border-top-color:#198754;border-radius:50%;animation:spin 1s linear infinite}.desc{font-size:16px;line-height:1.6;color:#6c757d;margin-bottom:28px}.status{font-size:13px;color:#6c757d;margin-bottom:18px}.refresh{border:1px solid #adb5bd;background:#fff;color:#6c757d;border-radius:4px;padding:7px 12px;font-size:14px;cursor:pointer}.refresh:hover{background:#f1f3f5}@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body><main class="page"><section class="card"><div class="content"><div class="title">${heading}</div>${qrMarkup}<div class="desc">${description}</div><div class="status">Status: ${status.state}</div><button class="refresh" type="button" onclick="location.reload()">Refresh</button></div></section></main>${status.ready?'':'<script>setTimeout(function(){location.reload()},5000)</script>'}</body></html>`);
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));

app.use(
  bodyParser.json({
    limit: process.env.IJIN_BODY_LIMIT || '256kb'
  })
);

const db = mysql.createPool({
  host: process.env.IJIN_DB_HOST || '192.168.0.33',
  user: process.env.IJIN_DB_USER || '',
  password: process.env.IJIN_DB_PASS || '',
  database: process.env.IJIN_DB_NAME || 'rsiklaten',
  connectionLimit: 10
});

app.post('/send', async (req, res) => {

  const {
    numbers,
    message
  } = req.body;

  if (typeof numbers !== 'string' || typeof message !== 'string' || numbers.trim() === '' || message.trim() === '') {

    return res.status(400).json({
      success: false,
      message: 'numbers dan message wajib diisi'
    });

  }

  try {

    console.log('\n========================================');
    console.log('📨 REQUEST /send');
    console.log('========================================');
    console.log('Numbers :', numbers);
    console.log('Message :', message.substring(0, 100));
    console.log('========================================\n');

    const results = await sendMessage(
      numbers,
      message
    );

    const jobs = results.map((r) => {

      return new Promise((resolve, reject) => {

        const local =
          r.number.startsWith('62')
            ? '0' + r.number.slice(2)
            : r.number;

        db.query(
          `
          UPDATE batal_praktek_detil_wa
          SET status = ?
          WHERE no_hp = ?
          `,
          [
            r.status,
            local
          ],
          (err) => {

            if (err) {
              return reject(err);
            }

            resolve();
          }
        );

      });

    });

    await Promise.all(jobs);

    return res.json({
      success: true,
      data: results
    });

  } catch (err) {

    console.error(
      '❌ /send error:',
      err.message
    );

    return res.status(500).json({
      success: false,
      message: err.message
    });

  }

});

const server = app.listen(
  port,
  '0.0.0.0',
  () => {

    console.log('='.repeat(60));
    console.log('🚀 WhatsApp Gateway Server');
    console.log(`📡 http://192.168.0.93:${port}`);
    console.log('='.repeat(60));

  }
);

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} sedang digunakan proses lain.`);
  } else {
    console.error('❌ Server error:', error);
  }
});

let shuttingDown = false;

async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`🛑 Menghentikan IJIN gateway (${signal})...`);

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
