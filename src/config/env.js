'use strict';

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');

function loadDotEnv(filePath = path.join(projectRoot, '.env')) {
  if (!fs.existsSync(filePath)) return;
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile(filePath);
      return;
    }
  } catch (_) {}
  for (const raw of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}
loadDotEnv();

function int(name, fallback) {
  const n = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = {
  projectRoot,
  host: process.env.WA_HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  ports: {
    reminder: int('REMINDER_GATEWAY_PORT', 3210),
    lab: int('LAB_GATEWAY_PORT', 9000),
    ijin: int('IJIN_GATEWAY_PORT', 3000),
  },
  bodyLimits: {
    reminder: process.env.REMINDER_BODY_LIMIT || '128kb',
    lab: process.env.LAB_BODY_LIMIT || '256kb',
    ijin: process.env.IJIN_BODY_LIMIT || '256kb',
  },
  databases: {
    lab: {
      host: process.env.LAB_DB_HOST || '192.168.0.33',
      user: process.env.LAB_DB_USER || '',
      password: process.env.LAB_DB_PASS || '',
      database: process.env.LAB_DB_NAME || 'rsiklaten',
      connectionLimit: int('LAB_DB_CONNECTION_LIMIT', 10),
    },
    ijin: {
      host: process.env.IJIN_DB_HOST || '192.168.0.33',
      user: process.env.IJIN_DB_USER || '',
      password: process.env.IJIN_DB_PASS || '',
      database: process.env.IJIN_DB_NAME || 'rsiklaten',
      connectionLimit: int('IJIN_DB_CONNECTION_LIMIT', 10),
    },
  },
  lab: {
    messageDelay: int('LAB_MESSAGE_DELAY', 4000),
    readyTimeout: int('LAB_READY_TIMEOUT', 60000),
    downloadTimeout: int('LAB_DOWNLOAD_TIMEOUT', 30000),
    pdfMaxMb: int('LAB_PDF_MAX_MB', 16),
    pdfUrlBase:
      process.env.LAB_PDF_BASE_URL ||
      'http://192.168.0.16/serverx/assets/rme/pdf/172.16.18.18/Hasil-Pemeriksaan-Laboratorium-',
  },
};
