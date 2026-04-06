'use strict';

// Mock OpenAI before any module that imports it is loaded.
// withStructuredOutput returns a chain — we just need it to resolve to a valid shape.
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    withStructuredOutput: jest.fn().mockReturnValue({
      invoke: jest.fn().mockResolvedValue({
        answer: 'Refunds are processed within 5–7 business days to the original payment method.',
        sources: [],   // filled in by our override anyway
        confidence: 'high',
      }),
    }),
  })),
}));

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Connect before requiring the app so MONGODB_URI is already set
let mongoServer;
let app;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongoServer.getUri();

  // Seed a couple of documents so retrieval actually finds something
  const { connectDB } = require('../src/config/db');
  await connectDB();

  const Document = require('../src/models/Document');
  await Document.insertMany([
    {
      title: 'Refund Policy',
      content: 'Refunds are processed within 5–7 business days. We offer a 14-day money-back guarantee on new subscriptions.',
      tags: ['refund', 'billing', 'cancellation'],
    },
    {
      title: 'Subscription Plans',
      content: 'Starter plan costs $29/month. Growth plan costs $99/month. Enterprise is custom pricing.',
      tags: ['plans', 'pricing', 'starter', 'growth'],
    },
  ]);

  // Seed a test user
  const User = require('../src/models/User');
  const hash = await bcrypt.hash('testpassword123', 10); // 10 rounds — fast for tests
  await User.create({ email: 'test@example.com', password: hash });

  // Build rate limiter (uses MemoryStore in test env)
  const { buildRateLimiter } = require('../src/middleware/rateLimiter');
  await buildRateLimiter();

  app = require('../index');
}, 30000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

// Generate a valid JWT directly — no need to go through /api/auth/login for every test
function makeToken(payload = {}) {
  return jwt.sign(
    { id: new mongoose.Types.ObjectId().toString(), email: 'test@example.com', ...payload },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );
}

// ─── POST /api/ask ────────────────────────────────────────────────────────────

describe('POST /api/ask', () => {
  test('returns correct shape for valid JWT and question', async () => {
    const token = makeToken();

    const res = await request(app)
      .post('/api/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({ question: 'What is the refund policy?' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      answer: expect.any(String),
      sources: expect.any(Array),
      confidence: expect.stringMatching(/^(high|medium|low)$/),
    });

    // X-Request-Id should always be present
    expect(res.headers['x-request-id']).toBeDefined();
  });

  test('returns 401 when Authorization header is missing', async () => {
    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'What is the refund policy?' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 401 for a tampered / invalid JWT', async () => {
    const res = await request(app)
      .post('/api/ask')
      .set('Authorization', 'Bearer this.is.not.a.valid.jwt')
      .send({ question: 'What are the plans?' });

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when question is missing', async () => {
    const token = makeToken();

    const res = await request(app)
      .post('/api/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('triggers 429 after exceeding rate limit', async () => {
    // Use a unique user ID so this test doesn't interfere with others
    const token = makeToken({ id: new mongoose.Types.ObjectId().toString() });
    const headers = { Authorization: `Bearer ${token}` };
    const body = { question: 'What is the refund policy?' };

    // Fire 11 requests in series — the 11th should hit the limit
    // MemoryStore in test mode is synchronous enough that this is reliable
    let lastResponse;
    for (let i = 0; i < 11; i++) {
      lastResponse = await request(app).post('/api/ask').set(headers).send(body);
    }

    expect(lastResponse.status).toBe(429);
    expect(lastResponse.body).toHaveProperty('error');
    expect(lastResponse.body).toHaveProperty('retryAfter');
  }, 20000);
});

// ─── GET /api/ask/history ─────────────────────────────────────────────────────

describe('GET /api/ask/history', () => {
  test('returns history array for authenticated user', async () => {
    const token = makeToken();

    const res = await request(app)
      .get('/api/ask/history')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('history');
    expect(Array.isArray(res.body.history)).toBe(true);
  });

  test('returns 401 without token', async () => {
    const res = await request(app).get('/api/ask/history');
    expect(res.status).toBe(401);
  });
});

// ─── GET /api/docs ────────────────────────────────────────────────────────────

describe('GET /api/docs', () => {
  test('returns document list with count', async () => {
    const res = await request(app).get('/api/docs');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('count');
    expect(res.body).toHaveProperty('documents');
    expect(Array.isArray(res.body.documents)).toBe(true);
    expect(res.body.count).toBeGreaterThan(0);
  });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────

describe('GET /api/health', () => {
  test('returns status and uptime', async () => {
    const res = await request(app).get('/api/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('mongoStatus');
    expect(res.body).toHaveProperty('timestamp');
  });
});

// ─── Auth endpoints ───────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  test('registers a new user and returns user without password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'newuser@example.com', password: 'securepassword123' });

    expect(res.status).toBe(201);
    expect(res.body.user).toHaveProperty('email', 'newuser@example.com');
    expect(res.body.user).not.toHaveProperty('password');
    expect(res.body.user).toHaveProperty('_id');
  });

  test('rejects duplicate email with 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'anotherpassword' });

    expect(res.status).toBe(409);
  });
});

describe('POST /api/auth/login', () => {
  test('returns JWT token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'testpassword123' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('rejects wrong password with 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });
});
