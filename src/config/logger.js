'use strict';

const pino = require('pino');

// Pretty-print in dev, structured JSON in prod — pino is fast enough that
// we don't bother with sampling even at high request rates
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
    },
  }),
});

module.exports = logger;
