'use strict';

const { createClient } = require('redis');
const logger = require('./logger');

let client = null;
let isReady = false;

async function getRedisClient() {
  if (client && isReady) return client;

  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  client = createClient({ url });

  client.on('error', (err) => {
    logger.warn({ err: err.message }, 'Redis error');
    isReady = false;
  });

  client.on('ready', () => {
    isReady = true;
    logger.info('Redis connected');
  });

  client.on('end', () => {
    isReady = false;
  });

  await client.connect();
  return client;
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
