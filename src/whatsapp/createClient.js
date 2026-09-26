'use strict';

const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const WhatsAppLifecycle = require('./WhatsAppLifecycle');
const { projectRoot } = require('../config/env');

function createWWebClient(clientId, authDir) {
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
    },
    takeoverOnConflict: true,
    takeoverTimeoutMs: 0,
  });
}

function createWhatsAppLifecycle(clientId, authDir) {
  return new WhatsAppLifecycle(
    () => createWWebClient(clientId, authDir),
    {
      onQr: async (qr) => {
        const dataUrl = await QRCode.toDataURL(qr, { width: 240, margin: 1 });
        lifecycleRef.qrDataUrl = dataUrl;
      }
    }
  );
}

let lifecycleRef = null;

module.exports = { createWWebClient };
