'use strict';

const axios = require('axios');
const { MessageMedia } = require('whatsapp-web.js');
const { normalizeNumber } = require('../utils/normalizeNumber');

class LabGatewayService {
  constructor(lifecycle, options = {}) { this.lifecycle = lifecycle; this.options = options; }

  async send(numbers, message) {
    if (!numbers || !String(message || '').trim()) throw new Error('numbers dan message wajib diisi');
    await this.ensureReady();
    const list = String(numbers).split(',').map((n) => n.trim()).filter(Boolean);
    if (!list.length) throw new Error('Tidak ada nomor WhatsApp yang valid');

    const results = [];
    for (const number of list) {
      let retries = 2;
      while (retries >= 0) {
        try {
          await this.ensureReady();
          await this.sendToOneNumber(number, message);
          results.push({ number: normalizeNumber(number), status: 1, message: 'Terkirim' });
          break;
        } catch (error) {
          if (this.isProtocolError(error) && retries > 0) {
            await this.lifecycle.reset();
            retries -= 1;
            continue;
          }
          results.push({ number, status: 2, message: error.message || 'Gagal mengirim' });
          break;
        }
      }
      if (list.length > 1) await new Promise((resolve) => setTimeout(resolve, this.options.messageDelay || 4000));
    }
    return results;
  }

  async sendToOneNumber(number, message) {
    const noReg = String(message || '').substring(0, 7);
    const caption = String(message || '').substring(7).trim();
    const intl = normalizeNumber(number);
    if (!intl) throw new Error('Nomor WhatsApp kosong atau tidak valid');
    const media = await this.downloadPDF(noReg);
    const resolved = await this.lifecycle.client.getNumberId(intl);
    if (!resolved) throw new Error('Nomor ' + number + ' (' + intl + ') tidak terdaftar di WhatsApp');
    return this.lifecycle.client.sendMessage(resolved._serialized || (intl + '@c.us'), media, {
      caption, sendSeen: false, sendMediaAsDocument: true,
    });
  }

  async downloadPDF(noReg) {
    const url = this.options.pdfUrlBase + noReg + '.pdf';
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: this.options.downloadTimeout || 30000,
      validateStatus: (status) => status >= 200 && status < 300,
    });
    const buffer = Buffer.from(response.data);
    if (!buffer.length) throw new Error('PDF kosong untuk no_reg ' + noReg);
    const maxMb = this.options.pdfMaxMb || 16;
    if (buffer.length / 1024 / 1024 > maxMb) throw new Error('PDF lebih dari ' + maxMb + 'MB');
    return new MessageMedia('application/pdf', buffer.toString('base64'), 'Hasil-Pemeriksaan-Laboratorium-' + noReg + '.pdf');
  }

  async ensureReady() {
    if (this.lifecycle.status().ready) return;
    const state = await this.lifecycle.client?.getState().catch(() => null);
    if (state === 'CONNECTED') { this.lifecycle.state = 'READY'; return; }
    throw new Error('WhatsApp belum READY / CONNECTED. Silakan scan QR atau tunggu koneksi.');
  }

  isProtocolError(error) {
    const message = String(error?.message || error || '');
    return message.includes('Target closed') || message.includes('Protocol error') ||
      message.includes('Session closed') || message.includes('Execution context was destroyed') ||
      error?.name === 'ProtocolError';
  }
}
module.exports = LabGatewayService;
