const fs = require('fs');
const path = require('path');
const axios = require('axios');
const qrcodeTerminal = require('qrcode-terminal');
const QRCode = require('qrcode');

/**
 * whatsapp-web.js 1.34.7 currently has a media-send regression where the
 * enumerable MediaData.__x_id can overwrite the outgoing Msg model id.
 * The upstream issue documents deleting message.__x_id after message
 * construction as the workaround.
 *
 * This patch is applied automatically so this project does not require a
 * manual edit inside node_modules every time the gateway is installed.
 */
function patchWhatsAppWebMediaBug() {
  const utilsPath = path.join(
    __dirname,
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

const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');

let client = null;
let clientReady = false;
let isResetting = false;
let initializing = false;

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
      dataPath: path.join(__dirname, '.wwebjs_auth'),
    }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
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
    console.log('\n📸 Scan QR berikut untuk login WhatsApp:\n');
    qrcodeTerminal.generate(qr, { small: true });

    try {
      await QRCode.toFile(path.join(__dirname, 'qr_code.png'), qr);
      console.log('🖼️ QR disimpan: ./qr_code.png');
    } catch (err) {
      console.error('❌ Gagal simpan QR:', err.message);
    }
  });

  newClient.on('authenticated', () => {
    console.log('🔐 WhatsApp authenticated');
  });

  newClient.on('ready', () => {
    clientReady = true;
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

async function initializeClient() {
  if (initializing) return;

  initializing = true;

  try {
    if (!client) {
      client = createClient();
    }

    await client.initialize();
  } catch (err) {
    clientReady = false;
    console.error('❌ Gagal initialize WhatsApp:', err.message);
    throw err;
  } finally {
    initializing = false;
  }
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

  if (!client) {
    client = createClient();
    await client.initialize();
  }

  try {
    await waitUntilConnected(client);
  } catch (err) {
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
client = createClient();
client.initialize().catch((err) => {
  console.error('❌ Initialisasi WhatsApp gagal:', err.message);
});

module.exports = {
  sendMessage,
};