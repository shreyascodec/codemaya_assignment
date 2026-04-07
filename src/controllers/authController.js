'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function register(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // 12 rounds — slow enough to resist brute-force, fast enough to not time out
    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ email, password: hashed });

    // toJSON() strips the password field — defined on the model schema
    res.status(201).json({ user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    // Password has select:false on the schema — must explicitly opt in for the compare
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      // Same message for "wrong email" and "wrong password" to avoid user enumeration
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user._id.toString(), email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );

    res.json({ token, user: user.toJSON() });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login };
