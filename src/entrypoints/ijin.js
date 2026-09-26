'use strict';

const mysql = require('mysql');
const { createWhatsAppLifecycle } = require('../whatsapp/createClient');
const IjinGatewayService = require('../services/IjinGatewayService');
const IjinRepository = require('../repositories/IjinRepository');
const { renderGatewayPage } = require('../http/gatewayUi');
const { createApp } = require('../http/createApp');
const { bindShutdownHandlers, gracefulShutdown } = require('../http/gatewayServer');
const config = require('../config/env');

const lifecycle = createWhatsAppLifecycle('ijin-gateway', '.wwebjs_auth_ijin');
const db = mysql.createPool(config.databases.ijin);
const repository = new IjinRepository(db);
const service = new IjinGatewayService(lifecycle, repository);
const app = createApp({ bodyLimit: config.bodyLimits.ijin, corsOrigin: config.corsOrigin });

app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.send(renderGatewayPage('WhatsApp Gateway · Ijin', lifecycle.status()));
});

app.get('/health', (req, res) => {
  const status = lifecycle.status();
  res.json({
    success: true,
    status: 'online',
    state: status.state,
    ready: status.ready,
    qrAvailable: status.qrAvailable,
    error: status.error || null
  });
});

app.post('/send', async (req, res) => {
  const { numbers, message } = req.body || {};
  if (typeof numbers !== 'string' || typeof message !== 'string' || !numbers.trim() || !message.trim()) {
    return res.status(400).json({ success: false, message: 'numbers dan message wajib diisi' });
  }

  try {
    const results = await service.send(numbers, message);

    for (const item of results) {
      const hp = String(item.number || '').trim();
      if (!hp) continue;
      const local = hp.startsWith('62') ? '0' + hp.slice(2) : hp;
      try {
        await repository.updateStatus(local, item.status);
      } catch (error) {
        console.warn('[IJIN] Database update warning:', error.message || error);
      }
    }

    const allSuccess = results.length > 0 && results.every((item) => item.status === 1);
    return res.status(allSuccess ? 200 : 207).json({ success: allSuccess, data: results });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Gagal mengirim pesan' });
  }
});

const server = app.listen(config.ports.ijin, '0.0.0.0', () => {
  console.log('WhatsApp IJIN gateway berjalan di http://localhost:' + config.ports.ijin);
});

bindShutdownHandlers(() => gracefulShutdown({
  server,
  lifecycle,
  closeDatabase: () => repository.close(),
  label: 'IJIN'
}));

void lifecycle.initialize().catch((error) => {
  console.error('[IJIN] Initialization failed:', error.message || error);
});

module.exports = { app, server, lifecycle, service, repository };
