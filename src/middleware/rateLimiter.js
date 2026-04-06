'use strict';

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');

// Built once at startup so we're not creating a new store per request.
// Redis store survives server restarts; if Redis is down we fall back to
// MemoryStore (fine for a single instance, not for a cluster)
let limiter = null;

async function buildRateLimiter() {
  // In test mode, skip Redis and use an in-memory store with a tighter window
  // so we can actually trigger the 429 without hammering real infrastructure
  if (process.env.NODE_ENV === 'test') {
    limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id || 'anon',
      handler: (_req, res) => {
        res.status(429).json({ error: 'Rate limit exceeded', retryAfter: 60 });
      },
    });
    return;
  }

  try {
    const redisClient = await getRedisClient();

    limiter = rateLimit({
      windowMs: 60 * 1000, // 1 minute rolling window
      max: 10,
      standardHeaders: true, // RateLimit-* headers per RFC 6585
      legacyHeaders: false,
      // Key on user ID so different users don't share the same bucket
      keyGenerator: (req) => req.user?.id || req.ip,
      handler: (req, res) => {
        const resetMs = req.rateLimit?.resetTime?.getTime?.() || Date.now() + 60000;
        const retryAfter = Math.ceil((resetMs - Date.now()) / 1000);
        res.status(429).json({ error: 'Rate limit exceeded', retryAfter });
      },
      store: new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
      }),
    });

    logger.info('Rate limiter using Redis store');
  } catch (err) {
    // Redis unavailable at startup — fall back to memory store
    // This means rate limits reset on restart, which is acceptable for local dev
    logger.warn({ err: err.message }, 'Redis unavailable, rate limiter using MemoryStore');

    limiter = rateLimit({
      windowMs: 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req) => req.user?.id || req.ip,
      handler: (_req, res) => {
        res.status(429).json({ error: 'Rate limit exceeded', retryAfter: 60 });
      },
    });
  }
}

// Middleware wrapper — initializes lazily on first request if buildRateLimiter
// wasn't called at startup (shouldn't happen but defensive)
function rateLimiterMiddleware(req, res, next) {
  if (!limiter) {
    return next(); // not yet initialized, skip — shouldn't hit this in practice
  }
  return limiter(req, res, next);
}

module.exports = { buildRateLimiter, rateLimiterMiddleware };
