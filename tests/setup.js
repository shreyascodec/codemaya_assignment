'use strict';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-that-is-long-enough-32chars';
process.env.JWT_EXPIRES_IN = '1d';
process.env.LOG_LEVEL = 'silent'; // suppress pino output during tests
