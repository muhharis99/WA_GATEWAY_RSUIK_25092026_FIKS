'use strict';

const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const WhatsAppLifecycle = require('./WhatsAppLifecycle');
const { projectRoot } = require('../config/env');

function getBrowserCandidates() {
  const candidates = [];

  if (process.env.CHROME_EXECUTABLE_PATH) {
    candidates.push(process.env.CHROME_EXECUTABLE_PATH);
  }

  // Prefer an explicitly configured or installed system Chrome.
  // The Puppeteer-bundled browser may be missing when install scripts were skipped.

  if (process.platform === 'win32') {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const localAppData = process.env.LOCALAPPDATA || '';

    candidates.push(
      path.join(programFiles, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFilesX86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(localAppData, 'Google', 'Chrome', 'Application', 'chrome.exe'),
      path.join(programFiles, 'Chromium', 'Application', 'chrome.exe')
    );
  }

  if (process.platform === 'linux') {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser'
    );
  }

  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    );
  }

  return [...new Set(candidates.filter(Boolean))];
}

function resolveBrowserExecutable() {
  const candidates = getBrowserCandidates();
  const found = candidates.find((candidate) => candidate && fs.existsSync(candidate));

  return found || null;
}

function clearWebCache() {
  const cacheDir = path.join(projectRoot, '.wwebjs_cache');

  try {
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      console.log('[WHATSAPP] Cleared stale WhatsApp Web cache:', cacheDir);
    }
  } catch (error) {
    console.warn('[WHATSAPP] Could not clear WhatsApp Web cache:', error.message || error);
  }
}

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

  if (options.clearWebCache !== false) {
    clearWebCache();
  }

  const executablePath = resolveBrowserExecutable();

  if (executablePath) {
    console.log('[WHATSAPP] Browser executable:', executablePath);
  } else {
    console.warn(
      '[WHATSAPP] Chrome/Chromium executable tidak ditemukan. ' +
      'Set CHROME_EXECUTABLE_PATH atau install Google Chrome/Chromium.'
    );
  }

  return new Client({
    authStrategy: new LocalAuth({
      clientId,
      dataPath: path.join(projectRoot, authDir),
    }),
    webVersionCache: { type: 'none' },
    // Let the installed/bundled Chrome provide its real current User-Agent.
    // whatsapp-web.js 1.34.7 otherwise applies an old default Chrome UA.
    userAgent: false,
    puppeteer: {
      ...(executablePath ? { executablePath } : {}),
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
        '--disable-features=TranslateUI',
        '--disable-blink-features=AutomationControlled'
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
      authenticatedReadyTimeoutMs: options.authenticatedReadyTimeoutMs || 90000,
      onQr: async (qr) => QRCode.toDataURL(qr, { width: 240, margin: 1 }),
    }
  );
}

module.exports = {
  createWWebClient,
  createWhatsAppLifecycle,
  patchWhatsAppWebMediaBug,
  resolveBrowserExecutable,
  clearWebCache,
};
