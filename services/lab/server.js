const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(path.join(PROJECT_ROOT, '.env'));
  } catch (error) {
    console.warn('⚠️ .env LAB tidak dapat dimuat:', error.message || error);
  }
}

const fs = require('fs');
const { sendMessage, shutdown: shutdownWhatsApp, getStatus: getWhatsAppStatus } = require('./sendMessage');

const app = express();
const port = 9000;

app.disable('x-powered-by');

const qrPath = path.join(__dirname, 'qr_code.png');

app.get('/', (req, res) => {
  const status = getWhatsAppStatus();
  const qr = status.qrAvailable
    ? '<img src="/qr.png?t=' + Date.now() + '" alt="QR WhatsApp LAB" style="max-width:360px;width:100%;border:1px solid #ddd;border-radius:16px;padding:10px;background:#fff">'
    : '';

  const body = status.ready
    ? '<div style="font-size:72px;color:#198754">✓</div><h2>WhatsApp LAB siap digunakan</h2><p>Gateway port 9000 sudah terhubung.</p>'
    : status.qrAvailable
      ? '<h2>Scan QR WhatsApp LAB</h2><p>Buka WhatsApp di HP → Perangkat tertaut → Tautkan perangkat.</p>' + qr
      : '<h2>Menyiapkan WhatsApp LAB...</h2><p>Status: ' + status.state + '</p>';

  res.send('<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gateway LAB</title><style>body{font-family:Arial,sans-serif;background:#f5f7f9;margin:0}.wrap{max-width:760px;margin:40px auto;padding:20px}.card{background:#fff;border-radius:18px;padding:32px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08)}.badge{display:inline-block;padding:7px 12px;border-radius:999px;background:#e8f5ee;color:#198754;font-weight:700}code{background:#f0f0f0;padding:2px 6px;border-radius:6px}</style></head><body><div class="wrap"><div class="card"><div class="badge">LAB · PORT 9000</div>' + body + '<p style="color:#6c757d">Status: <code>' + status.state + '</code></p><button onclick="location.reload()" style="padding:10px 18px;border:1px solid #198754;background:#198754;color:#fff;border-radius:8px;cursor:pointer">Refresh</button></div></div>' + (status.ready ? '' : '<script>setTimeout(function(){location.reload()},3000)</script>') + '</body></html>');
});

app.get('/qr.png', (req, res) => {
  if (!fs.existsSync(qrPath)) return res.status(404).send('QR belum tersedia');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  return res.sendFile(qrPath);
});

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(bodyParser.json({ limit: process.env.LAB_BODY_LIMIT || '256kb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: process.env.LAB_BODY_LIMIT || '256kb' }));

// Dipertahankan sesuai konfigurasi gateway lama Anda.
// Saat ini endpoint /send tidak membutuhkan query ke database ini.
const db = mysql.createPool({
  host: process.env.LAB_DB_HOST || '192.168.0.33',
  user: process.env.LAB_DB_USER || '',
  password: process.env.LAB_DB_PASS || '',
  database: process.env.LAB_DB_NAME || 'rsiklaten',
  connectionLimit: 10,
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'WhatsApp Gateway',
    status: 'online',
    endpoint: 'POST /send',
  });
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
