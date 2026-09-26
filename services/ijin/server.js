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
  const qrMarkup = status.qrAvailable
    ? '<div class="qr-wrap"><img class="qr" src="/qr.png?t=' + Date.now() + '" alt="QR WhatsApp"></div>'
    : '<div class="waiting"><div class="spinner"></div></div>';
  const heading = status.ready ? 'WhatsApp Terhubung' : 'Scan QR WhatsApp';
  const description = status.ready
    ? 'WhatsApp sudah terhubung dan siap digunakan.'
    : 'Buka WhatsApp di HP, pilih Perangkat tertaut, lalu scan QR ini.';
  res.send(\`<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>WhatsApp Gateway · IJIN</title><style>
*{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif}body{background:#f8f9fa;color:#495057}.page{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{width:min(640px,100%);min-height:475px;background:#fff;border:1px solid #ececec;border-radius:6px;box-shadow:0 2px 10px rgba(0,0,0,.06);display:flex;align-items:center;justify-content:center;text-align:center;padding:42px}.content{width:100%}.title{font-size:14px;font-weight:700;color:#198754;margin-bottom:24px}.qr-wrap{display:flex;justify-content:center;margin-bottom:28px}.qr{width:230px;height:230px;display:block;border:1px solid #dee2e6;border-radius:7px;padding:8px;background:#fff}.waiting{width:230px;height:230px;margin:0 auto 28px;border:1px solid #dee2e6;border-radius:7px;display:flex;align-items:center;justify-content:center;background:#fff}.spinner{width:42px;height:42px;border:4px solid #e9ecef;border-top-color:#198754;border-radius:50%;animation:spin 1s linear infinite}.desc{font-size:16px;line-height:1.6;color:#6c757d;margin-bottom:28px}.status{font-size:13px;color:#6c757d;margin-bottom:18px}.refresh{border:1px solid #adb5bd;background:#fff;color:#6c757d;border-radius:4px;padding:7px 12px;font-size:14px;cursor:pointer}.refresh:hover{background:#f1f3f5}@keyframes spin{to{transform:rotate(360deg)}}
</style></head><body><main class="page"><section class="card"><div class="content"><div class="title">\${heading}</div>\${qrMarkup}<div class="desc">\${description}</div><div class="status">Status: \${status.state}</div><button class="refresh" type="button" onclick="location.reload()">Refresh</button></div></section></main>\${status.ready?'':'<script>setTimeout(function(){location.reload()},5000)</script>'}</body></html>\`);
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
