'use strict';

const { createClient } = require('redis');
const logger = require('./logger');

let client = null;
let isReady = false;

/** Prefer 127.0.0.1 over localhost so Node does not resolve to ::1 (IPv6) while Redis listens on IPv4 only. */
const DEFAULT_REDIS_URL = 'redis://127.0.0.1:6379';

async function getRedisClient() {
  if (client && isReady) return client;

  const url = process.env.REDIS_URL || DEFAULT_REDIS_URL;

  const newClient = createClient({
    url,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 8) return false;
        return Math.min(retries * 100, 2000);
      },
    },
  });

  newClient.on('error', (err) => {
    logger.warn({ err: err.message }, 'Redis error');
    isReady = false;
  });

  newClient.on('ready', () => {
    isReady = true;
    logger.info('Redis connected');
  });

  newClient.on('end', () => {
    isReady = false;
  });

  try {
    await newClient.connect();
    client = newClient;
    return client;
  } catch (err) {
    await newClient.quit().catch(() => {});
    client = null;
    isReady = false;
    throw err;
  }
}

async function getRedisStatus() {
  if (!client) return 'disconnected';
  try {
    await client.ping();
    return 'connected';
  } catch {
    return 'disconnected';
  }
}

module.exports = { getRedisClient, getRedisStatus };
