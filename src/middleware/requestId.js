'use strict';

const { v4: uuidv4 } = require('uuid');

// Attach a per-request trace ID early in the middleware chain so it shows up
// in both response headers and log lines without having to thread it manually
function requestId(req, res, next) {
  const id = uuidv4();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

module.exports = requestId;
