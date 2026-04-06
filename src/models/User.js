'use strict';

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true }, // bcrypt hash — never return this field
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

// Explicitly exclude password from any toJSON() call so it can't accidentally
// leak into a response even if someone does res.json(user)
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
