'use strict';

const { normalizeNumber } = require('../utils/normalizeNumber');

class IjinGatewayService {
  constructor(lifecycle, repository, options = {}) {
    this.lifecycle = lifecycle;
    this.repository = repository;
    this.delayMs = options.delayMs || 0;
  }

  async send(numbers, message) {
    if (!numbers || !message) throw new Error('Nomor dan pesan wajib diisi.');
    if (!this.lifecycle.status().ready) {
      const state = await this.lifecycle.client?.getState().catch(() => null);
      if (state !== 'CONNECTED') throw new Error('WhatsApp belum READY / CONNECTED. Silakan scan QR atau tunggu koneksi.');
    }

    const list = String(numbers).split(',').map((n) => n.trim()).filter(Boolean);
    const results = [];
    for (const number of list) {
      try {
        const intl = normalizeNumber(number);
        if (!intl) throw new Error('Nomor WhatsApp kosong atau tidak valid');
        const numberId = await this.lifecycle.client.getNumberId(intl);
        if (!numberId) throw new Error('Nomor ' + number + ' tidak terdaftar di WhatsApp');
        await this.lifecycle.client.sendMessage(numberId._serialized || (intl + '@c.us'), String(message), { sendSeen: false });
        results.push({ number: intl, status: 1, message: 'Terkirim' });
      } catch (error) {
        results.push({ number, status: 2, message: error.message || 'Gagal mengirim pesan' });
      }
      if (this.delayMs > 0 && list.length > 1) await new Promise((resolve) => setTimeout(resolve, this.delayMs));
    }
    return results;
  }
}

module.exports = IjinGatewayService;
