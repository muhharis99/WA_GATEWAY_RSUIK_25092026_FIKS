'use strict';

const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const WhatsAppLifecycle = require('./WhatsAppLifecycle');
const { projectRoot } = require('../config/env');

function patchWhatsAppWebMediaBug() {
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
    return;
  }

  let source = fs.readFileSync(utilsPath, 'utf8');

  if (source.includes('delete message.__x_id;')) {
    return;
  }

  const markerRegex = /(\.\.\.extraOptions,\r?\n\s*\};)/;
  if (!markerRegex.test(source)) {
    return;
  }

  const backupPath = utilsPath + '.backup';
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(utilsPath, backupPath);
  }

  source = source.replace(
    markerRegex,
    '$1\n        // Workaround whatsapp-web.js media regression (MediaData.__x_id)\n        delete message.__x_id;'
  );

  fs.writeFileSync(utilsPath, source, 'utf8');
}

function createWWebClient(clientId, authDir, options = {}) {
  if (options.patchMediaBug) {
    patchWhatsAppWebMediaBug();
  }

  return new Client({
    authStrategy: new LocalAuth({
      clientId,
      dataPath: path.join(projectRoot, authDir),
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
      ...(options.puppeteer || {}),
    },
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
    ...(options.client || {}),
  });
}

function createWhatsAppLifecycle(clientId, authDir, options = {}) {
  return new WhatsAppLifecycle(
    () => createWWebClient(clientId, authDir, options),
    {
      maxAttempts: options.maxAttempts || 4,
      retryDelayMs: options.retryDelayMs || 5000,
      recoveryDelayMs: options.recoveryDelayMs || 3000,
      onQr: async (qr) => QRCode.toDataURL(qr, { width: 240, margin: 1 }),
    }
  );
}

module.exports = { createWWebClient, createWhatsAppLifecycle, patchWhatsAppWebMediaBug };
