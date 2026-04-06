'use strict';

const { Router } = require('express');
const authenticate = require('../middleware/auth');
const { rateLimiterMiddleware } = require('../middleware/rateLimiter');
const { ask, history } = require('../controllers/askController');

const router = Router();

// Auth runs before rate limiting so we can key the limiter on req.user.id
router.use(authenticate);
router.use(rateLimiterMiddleware);

router.post('/', ask);
router.get('/history', history);

module.exports = router;
