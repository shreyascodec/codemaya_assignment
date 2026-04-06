'use strict';

const { Router } = require('express');
const { getMongoStatus } = require('../config/db');
const { getRedisStatus } = require('../config/redis');

const router = Router();

router.get('/', async (_req, res) => {
  const [mongoStatus, redisStatus] = await Promise.all([
    Promise.resolve(getMongoStatus()),
    getRedisStatus(),
  ]);

  const healthy = mongoStatus === 'connected';

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    uptime: Math.floor(process.uptime()),
    mongoStatus,
    redisStatus,
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
