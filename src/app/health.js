'use strict';

function healthFromLifecycle(lifecycle) {
  const status = lifecycle.status();
  return {
    success: true,
    status: 'online',
    state: status.state,
    ready: status.ready,
    qrAvailable: status.qrAvailable,
    error: status.error || null,
  };
}

module.exports = { healthFromLifecycle };
