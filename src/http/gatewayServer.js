'use strict';

function bindShutdownHandlers(cleanup) {
  let shuttingDown = false;
  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    await cleanup(signal);
  };
  process.once('SIGINT', () => { void shutdown('SIGINT'); });
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.on('uncaughtException', (error) => console.error('Uncaught exception:', error.stack || error.message || error));
  process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));
}

async function gracefulShutdown({ server, lifecycle, closeDatabase }) {
  let forced = false;
  const timeout = setTimeout(() => { forced = true; process.exit(1); }, 15000);
  timeout.unref?.();
  try {
    await lifecycle?.shutdown();
  } finally {
    if (closeDatabase) await closeDatabase();
    if (server && !forced) await new Promise((resolve) => server.close(resolve));
    clearTimeout(timeout);
  }
}

module.exports = { gracefulShutdown, bindShutdownHandlers };
