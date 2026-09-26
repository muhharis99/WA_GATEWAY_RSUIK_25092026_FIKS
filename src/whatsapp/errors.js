'use strict';

function isRecoverableBrowserError(error) {
  const message = String(error?.message || error || '');
  return (
    message.includes('Execution context was destroyed') ||
    message.includes('Navigating frame was detached') ||
    message.includes('Session closed') ||
    message.includes('Target closed') ||
    message.includes('Protocol error')
  );
}

module.exports = { isRecoverableBrowserError };
