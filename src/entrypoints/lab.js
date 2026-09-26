'use strict';

const { createWhatsAppLifecycle } = require('../whatsapp/createClient');
const LabGatewayService = require('../services/LabGatewayService');
const { renderGatewayPage } = require('../http/gatewayUi');
const { createApp } = require('../http/createApp');
const { bindShutdownHandlers, gracefulShutdown } = require('../http/gatewayServer');
const config = require('../config/env');

const lifecycle = createWhatsAppLifecycle('lab-gateway', '.wwebjs_auth_lab', { patchMediaBug: true });
const service = new LabGatewayService(lifecycle, {
  messageDelay: config.lab.messageDelay,
  readyTimeout: config.lab.readyTimeout,
  downloadTimeout: config.lab.downloadTimeout,
  pdfMaxMb: config.lab.pdfMaxMb,
  pdfUrlBase: config.lab.pdfUrlBase,
});
const app = createApp({ bodyLimit: config.bodyLimits.lab, corsOrigin: config.corsOrigin });

app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.send(renderGatewayPage('WhatsApp Gateway · Lab', lifecycle.status()));
});

app.get('/health', (req, res) => {
  const status = lifecycle.status();
  res.json({
    success: true,
    status: 'online',
    state: status.state === 'READY' ? 'READY' : status.state === 'DISCONNECTED' ? 'STARTING' : status.state,
    ready: status.ready,
    qrAvailable: status.qrAvailable,
    error: status.error || null,
  });
});

app.post('/send', async (req, res) => {
  const { numbers, message } = req.body || {};
  if (typeof numbers !== 'string' || typeof message !== 'string' || !numbers.trim() || !message.trim()) {
    return res.status(400).json({ success: false, message: 'numbers dan message wajib diisi' });
  }

  try {
    const results = await service.send(numbers, message);
    const allSuccess = results.length > 0 && results.every((item) => item.status === 1);
    return res.status(allSuccess ? 200 : 207).json({ success: allSuccess, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Gagal mengirim pesan' });
  }
});

const server = app.listen(config.ports.lab, '0.0.0.0', () => {
  console.log('WhatsApp LAB gateway berjalan di http://localhost:' + config.ports.lab);
});

bindShutdownHandlers(() => gracefulShutdown({
  server,
  lifecycle,
  label: 'LAB'
}));

void lifecycle.initialize().catch((error) => {
  console.error('[LAB] Initialization failed:', error.message || error);
});

module.exports = { app, server, lifecycle, service };
