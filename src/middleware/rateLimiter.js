'use strict';

const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');

let limiter = null;

async function buildRateLimiter() {
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
      windowMs: 60 * 1000, 
      max: 10,
      standardHeaders: true, 
      legacyHeaders: false,
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

function rateLimiterMiddleware(req, res, next) {
  if (!limiter) {
    return next(); 
  }
  return limiter(req, res, next);
}

module.exports = { buildRateLimiter, rateLimiterMiddleware };
