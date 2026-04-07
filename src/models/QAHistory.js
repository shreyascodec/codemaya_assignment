'use strict';

const mongoose = require('mongoose');

const qaHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    sources: [{ type: String }], 
    confidence: { type: String, enum: ['high', 'medium', 'low'], required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);  

qaHistorySchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

module.exports = mongoose.model('QAHistory', qaHistorySchema);
