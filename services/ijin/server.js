const mysql = require('mysql');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const { sendMessage, shutdown: shutdownWhatsApp } = require('./sendMessage');

const app = express();
app.disable('x-powered-by');
const port = 3000;

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

app.listen(
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
