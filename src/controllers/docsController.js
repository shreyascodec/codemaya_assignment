'use strict';

const Document = require('../models/Document');

async function listDocs(req, res, next) {
  try {
    const docs = await Document.find({}).sort({ createdAt: -1 }).lean();
    res.json({ count: docs.length, documents: docs });
  } catch (err) {
    next(err);
  }
}

module.exports = { listDocs };
