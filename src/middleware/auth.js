'use strict';

const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header missing or malformed' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, iat, exp }
    next();
  } catch (err) {
    // Don't leak whether the token was expired vs tampered — same 401 for both
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authenticate;
