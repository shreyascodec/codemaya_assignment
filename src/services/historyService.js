'use strict';

const QAHistory = require('../models/QAHistory');

async function saveHistory({ userId, question, answer, sources, confidence }) {
  await QAHistory.create({ userId, question, answer, sources, confidence });
}

async function getRecentHistory(userId) {
  // Sort descending so the most recent question is first — clients usually
  // want "what did I just ask" not "what did I ask 3 weeks ago"
  return QAHistory.find({ userId })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('-__v')
    .lean();
}

module.exports = { saveHistory, getRecentHistory };
