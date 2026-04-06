'use strict';

const logger = require('../config/logger');

// Central error handler — must be registered LAST in the Express chain.
// Only the message goes to the client; stack traces stay in the logs.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;

  logger.error({
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    status,
    err: {
      message: err.message,
      // Include stack in logs always — just never in the response
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
