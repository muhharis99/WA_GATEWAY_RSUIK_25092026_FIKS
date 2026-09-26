'use strict';

const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const WhatsAppLifecycle = require('./WhatsAppLifecycle');
const { projectRoot } = require('../config/env');

function createWWebClient(clientId, authDir, options = {}) {
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

module.exports = { createWWebClient, createWhatsAppLifecycle };
