const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(path.join(PROJECT_ROOT, '.env'));
  } catch (error) {
    console.warn('⚠️ .env IJIN tidak dapat dimuat:', error.message || error);
  }
}

const fs = require('fs');
const { sendMessage, shutdown: shutdownWhatsApp, getStatus: getWhatsAppStatus } = require('./sendMessage');

const app = express();
app.disable('x-powered-by');
const port = 3000;

const qrPath = path.join(__dirname, 'qr_code.png');

app.get('/', (req, res) => {
  const status = getWhatsAppStatus();
  const qr = status.qrAvailable
    ? '<img src="/qr.png?t=' + Date.now() + '" alt="QR WhatsApp IJIN" style="max-width:360px;width:100%;border:1px solid #ddd;border-radius:16px;padding:10px;background:#fff">'
    : '';

  const body = status.ready
    ? '<div style="font-size:72px;color:#198754">✓</div><h2>WhatsApp IJIN siap digunakan</h2><p>Gateway port 3000 sudah terhubung.</p>'
    : status.qrAvailable
      ? '<h2>Scan QR WhatsApp IJIN</h2><p>Buka WhatsApp di HP → Perangkat tertaut → Tautkan perangkat.</p>' + qr
      : '<h2>Menyiapkan WhatsApp IJIN...</h2><p>Status: ' + status.state + '</p>';

  res.send('<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gateway IJIN Dokter</title><style>body{font-family:Arial,sans-serif;background:#f5f7f9;margin:0}.wrap{max-width:760px;margin:40px auto;padding:20px}.card{background:#fff;border-radius:18px;padding:32px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08)}.badge{display:inline-block;padding:7px 12px;border-radius:999px;background:#e8f5ee;color:#198754;font-weight:700}code{background:#f0f0f0;padding:2px 6px;border-radius:6px}</style></head><body><div class="wrap"><div class="card"><div class="badge">IJIN DOKTER · PORT 3000</div>' + body + '<p style="color:#6c757d">Status: <code>' + status.state + '</code></p><button onclick="location.reload()" style="padding:10px 18px;border:1px solid #198754;background:#198754;color:#fff;border-radius:8px;cursor:pointer">Refresh</button></div></div>' + (status.ready ? '' : '<script>setTimeout(function(){location.reload()},3000)</script>') + '</body></html>');
});

app.get('/qr.png', (req, res) => {
  if (!fs.existsSync(qrPath)) return res.status(404).send('QR belum tersedia');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  return res.sendFile(qrPath);
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
