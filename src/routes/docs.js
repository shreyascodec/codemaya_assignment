'use strict';

const { Router } = require('express');
const { listDocs } = require('../controllers/docsController');

const router = Router();

router.get('/', listDocs);

module.exports = router;
