'use strict';

const express = require('express');
const cors = require('cors');

function createApp({ bodyLimit = '256kb', corsOrigin = '*', routes }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: bodyLimit }));
  app.use(routes);
  return app;
}

module.exports = { createApp };
