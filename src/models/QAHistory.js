'use strict';

const mongoose = require('mongoose');

const qaHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    sources: [{ type: String }], // doc ObjectId strings
    confidence: { type: String, enum: ['high', 'medium', 'low'], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// TTL index — history older than 90 days auto-expires, avoids unbounded growth
qaHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('QAHistory', qaHistorySchema);
