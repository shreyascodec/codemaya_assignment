'use strict';

const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    tags: [{ type: String, trim: true }],
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Full-text index helps with Atlas search, but we're doing our own TF-IDF
// so this is just a fallback for direct DB queries
documentSchema.index({ title: 'text', content: 'text' });

module.exports = mongoose.model('Document', documentSchema);
