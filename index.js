'use strict';

require('dotenv').config();

const express = require('express');
const { connectDB } = require('./src/config/db');
const { buildRateLimiter } = require('./src/middleware/rateLimiter');
const requestId = require('./src/middleware/requestId');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/config/logger');

const authRoutes = require('./src/routes/auth');
const askRoutes = require('./src/routes/ask');
const docsRoutes = require('./src/routes/docs');
const healthRoutes = require('./src/routes/health');

const app = express();

app.use(express.json());
app.use(requestId);

app.use('/api/auth', authRoutes);
app.use('/api/ask', askRoutes);
app.use('/api/docs', docsRoutes);
app.use('/api/health', healthRoutes);

// 404 fallthrough before the error handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

async function start() {
  await connectDB();
  // Build rate limiter after DB is up so Redis connection failures don't block startup
  await buildRateLimiter();

  const port = parseInt(process.env.PORT || '3000', 10);
  app.listen(port, () => {
    logger.info({ port, env: process.env.NODE_ENV }, 'Server started');
  });
}

// Allow importing app in tests without triggering the full start() lifecycle
if (require.main === module) {
  start().catch((err) => {
    logger.error({ err: err.message }, 'Fatal startup error');
    process.exit(1);
  });
}

module.exports = app;
