'use strict';

const EventEmitter = require('events');
const { isRecoverableBrowserError } = require('./errors');

class WhatsAppLifecycle extends EventEmitter {
  constructor(createClient, options = {}) {
    super();
    this.createClient = createClient;
    this.client = null;
    this.state = 'STARTING';
    this.qrDataUrl = null;
    this.lastError = null;
    this.initializing = null;
    this.recoveryTimer = null;
    this.shuttingDown = false;
    this.maxAttempts = options.maxAttempts || 4;
    this.retryDelayMs = options.retryDelayMs || 5000;
    this.recoveryDelayMs = options.recoveryDelayMs || 3000;
    this.onQr = options.onQr || null;
  }

  async initialize() {
    if (this.shuttingDown) throw new Error('WhatsApp lifecycle is shutting down');
    if (this.initializing) return this.initializing;

    this.initializing = (async () => {
      for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
        try {
          if (!this.client) this.attachClient(this.createClient());
          this.state = 'STARTING';
          this.lastError = null;
          this.emit('state', this.state, { attempt });
          await this.client.initialize();
          return this.client;
        } catch (error) {
          this.lastError = error.message || String(error);
          this.emit('initialization_error', error, { attempt });
          if (!isRecoverableBrowserError(error) || attempt >= this.maxAttempts) {
            this.state = 'ERROR';
            this.emit('state', this.state, { attempt });
            throw error;
          }
          await this.safeDestroy();
          await this.delay(this.retryDelayMs);
        }
      }
      throw new Error('WhatsApp initialization failed');
    })();

    try {
      return await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  attachClient(client) {
    this.client = client;
    client.on('qr', async (qr) => {
      try {
        if (this.onQr) await this.onQr(qr);
        this.emit('qr', qr);
      } catch (error) {
        this.lastError = error.message || String(error);
        this.emit('error', error);
      }
    });
    client.on('authenticated', () => {
      this.qrDataUrl = null;
      this.lastError = null;
      this.state = 'AUTHENTICATED';
      this.emit('authenticated');
      this.emit('state', this.state);
    });
    client.on('ready', () => {
      this.qrDataUrl = null;
      this.lastError = null;
      this.state = 'READY';
      this.emit('ready');
      this.emit('state', this.state);
    });
    client.on('auth_failure', (message) => {
      this.state = 'AUTH_FAILURE';
      this.lastError = String(message || 'Authentication failure');
      this.emit('auth_failure', message);
      this.emit('state', this.state);
    });
    client.on('disconnected', (reason) => {
      this.state = 'DISCONNECTED';
      this.qrDataUrl = null;
      this.lastError = String(reason || 'Disconnected');
      this.emit('disconnected', reason);
      this.emit('state', this.state);
      this.scheduleRecovery(reason);
    });
    client.on('change_state', (state) => {
      this.emit('change_state', state);
      if (state === 'CONNECTED') {
        this.state = 'READY';
        this.emit('state', this.state);
      } else if (['DISCONNECTED', 'UNPAIRED', 'UNPAIRED_IDLE'].includes(state)) {
        this.state = 'DISCONNECTED';
        this.emit('state', this.state);
      }
    });
    client.on('error', (error) => {
      this.lastError = error?.message || String(error);
      this.emit('error', error);
      if (isRecoverableBrowserError(error)) this.scheduleRecovery(error);
    });
  }

  scheduleRecovery(reason = '') {
    if (this.shuttingDown || this.recoveryTimer) return;
    this.recoveryTimer = setTimeout(async () => {
      this.recoveryTimer = null;
      try {
        await this.safeDestroy();
        await this.delay(2000);
        await this.initialize();
      } catch (error) {
        this.lastError = error.message || String(error);
        this.state = 'ERROR';
        this.emit('recovery_error', error);
      }
    }, this.recoveryDelayMs);
    this.recoveryTimer.unref?.();
  }

  async safeDestroy() {
    const oldClient = this.client;
    this.client = null;
    this.qrDataUrl = null;
    try {
      if (oldClient) await oldClient.destroy();
    } catch (error) {
      if (!isRecoverableBrowserError(error)) this.emit('destroy_error', error);
    }
  }

  async reset() {
    if (this.shuttingDown) throw new Error('WhatsApp lifecycle is shutting down');
    await this.safeDestroy();
    await this.delay(2000);
    return this.initialize();
  }

  status() {
    return {
      state: this.state,
      ready: this.state === 'READY',
      qrAvailable: Boolean(this.qrDataUrl),
      qrDataUrl: this.qrDataUrl,
      error: this.lastError,
    };
  }

  async shutdown() {
    this.shuttingDown = true;
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
    this.recoveryTimer = null;
    await this.safeDestroy();
    this.state = 'STOPPED';
    this.emit('state', this.state);
  }

  async delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = WhatsAppLifecycle;
