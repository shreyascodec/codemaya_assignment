'use strict';

const logger = require('../config/logger');

function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  logger.error({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    status,
    err: {
      message: err.message,
      stack: err.stack,
    },
  });

  res.status(status).json({
    error: process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal server error'
      : err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
