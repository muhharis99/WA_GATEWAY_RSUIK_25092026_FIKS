const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const { sendMessage, shutdown: shutdownWhatsApp } = require('./sendMessage');

const app = express();
const port = 9000;

app.disable('x-powered-by');

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
