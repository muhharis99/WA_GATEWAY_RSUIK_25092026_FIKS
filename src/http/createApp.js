'use strict';

const express = require('express');
const cors = require('cors');

function createCorsMiddleware(corsOrigin) {
  const configured = String(corsOrigin || '').split(',').map((value) => value.trim()).filter(Boolean);

  return cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (configured.includes('*')) return callback(null, true);
      if (configured.includes(origin)) return callback(null, true);
      return callback(new Error('CORS origin not allowed'), false);
    }
  });
}

function createApp({ bodyLimit = '256kb', corsOrigin = '', routes }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(createCorsMiddleware(corsOrigin));
  app.use(express.json({ limit: bodyLimit }));
  app.use(routes);
  return app;
}

module.exports = { createApp, createCorsMiddleware };
