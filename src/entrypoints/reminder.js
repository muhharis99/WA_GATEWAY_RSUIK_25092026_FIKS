'use strict';

const express = require('express');
const { createWhatsAppLifecycle } = require('../whatsapp/createClient');
const ReminderGatewayService = require('../services/ReminderGatewayService');
const { createGatewayController } = require('../controllers/GatewayController');
const { renderGatewayPage } = require('../http/gatewayUi');
const { bindShutdownHandlers, gracefulShutdown } = require('../http/gatewayServer');
const config = require('../config/env');

const lifecycle = createWhatsAppLifecycle('dokter-reminder', '.wwebjs_auth');
const service = new ReminderGatewayService(lifecycle);
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: config.bodyLimits.reminder }));

lifecycle.on('qr', () => {});
lifecycle.on('error', (error) => console.error('[REMINDER] WhatsApp error:', error.message || error));

app.get('/', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.send(renderGatewayPage('WhatsApp Gateway · Reminder', lifecycle.status()));
});

app.get('/status', (req, res) => {
  const status = lifecycle.status();
  res.set('Cache-Control', 'no-store');
  res.json({
    success: true,
    state: status.state,
    ready: status.ready,
    hasQr: status.qrAvailable,
    error: status.error,
    incomingQueue: 0,
    mappedContacts: 0
  });
});

app.post('/send', async (req, res) => {
  const phone = String(req.body?.phone || '');
  const doctorId = String(req.body?.doctor_id || '').trim();
  const message = String(req.body?.message || '').trim();

  try {
    const result = await service.send(phone, doctorId, message);
    return res.json({ success: true, message: 'Pesan WhatsApp berhasil dikirim.', ...result });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Gagal mengirim WhatsApp.',
      ...(error.state ? { state: error.state } : {})
    });
  }
});

const server = app.listen(config.ports.reminder, config.host, () => {
  console.log('WhatsApp Reminder gateway berjalan di http://localhost:' + config.ports.reminder);
});

bindShutdownHandlers(() => gracefulShutdown({
  server,
  lifecycle,
  label: 'REMINDER'
}));

void lifecycle.initialize().catch((error) => {
  console.error('[REMINDER] Initialization failed:', error.message || error);
});

module.exports = { app, server, lifecycle, service };
