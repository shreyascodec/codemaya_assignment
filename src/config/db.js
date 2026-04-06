'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');

let isConnected = false;

async function connectDB() {
  if (isConnected) return;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI not set');

  // Mongoose 8 no longer needs useNewUrlParser / useUnifiedTopology — removing them
  // avoids the deprecation warning noise in logs
  await mongoose.connect(uri);
  isConnected = true;
  logger.info({ uri: uri.replace(/:\/\/.*@/, '://<credentials>@') }, 'MongoDB connected');
}

function getMongoStatus() {
  // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const states = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
  return states[mongoose.connection.readyState] || 'unknown';
}

module.exports = { connectDB, getMongoStatus };
