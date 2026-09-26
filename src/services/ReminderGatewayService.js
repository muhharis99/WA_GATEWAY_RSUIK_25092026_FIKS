'use strict';

const { normalizeNumber } = require('../utils/normalizeNumber');

class ReminderGatewayService {
  constructor(lifecycle) { this.lifecycle = lifecycle; }

  async send(phone, doctorId, message) {
    const normalized = normalizeNumber(phone);
    if (!normalized || !/^62\d{8,15}$/.test(normalized)) {
      const error = new Error('Format nomor WhatsApp tidak valid.'); error.statusCode = 422; throw error;
    }
    if (!String(message || '').trim()) {
      const error = new Error('Pesan WhatsApp kosong.'); error.statusCode = 422; throw error;
    }
    if (!this.lifecycle.status().ready) {
      const error = new Error('WhatsApp belum terhubung. Scan QR terlebih dahulu.');
      error.statusCode = 503; error.state = this.lifecycle.status().state; throw error;
    }
    const numberId = await this.lifecycle.client.getNumberId(normalized);
    if (!numberId) { const error = new Error('Nomor tidak terdaftar di WhatsApp.'); error.statusCode = 404; throw error; }
    const sent = await this.lifecycle.client.sendMessage(numberId._serialized, String(message).trim(), { sendSeen: false });
    return { phone: normalized, doctorId: String(doctorId || '').trim(), messageId: sent?.id?._serialized || null };
  }
}
module.exports = ReminderGatewayService;
