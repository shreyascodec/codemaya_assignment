'use strict';

const QAHistory = require('../models/QAHistory');

async function saveHistory({ userId, question, answer, sources, confidence }) {
  await QAHistory.create({ userId, question, answer, sources, confidence });
}

async function getRecentHistory(userId) {
  return QAHistory.find({ userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('-__v')
    .lean();
}

module.exports = { saveHistory, getRecentHistory };
