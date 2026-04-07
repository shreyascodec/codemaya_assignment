'use strict';

const { Router } = require('express');
const authenticate = require('../middleware/auth');
const { rateLimiterMiddleware } = require('../middleware/rateLimiter');
const { ask, history } = require('../controllers/askController');

const router = Router();

router.use(authenticate);
router.use(rateLimiterMiddleware);

router.post('/', ask);
router.get('/history', history);

module.exports = router;
