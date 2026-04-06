# Smart Q&A API

A RAG-based question-answering API built with Node.js, LangChain, and MongoDB. Ask it a question, it retrieves the most relevant docs from the knowledge base, passes them as context to GPT-4o-mini, and returns a structured, grounded answer — refusing to answer anything outside the seeded documents.

---

## Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- Redis (local or managed)
- An OpenAI API key

---

## Local Setup

```bash
git clone <repo-url>
cd smart-qa-api
npm install
cp .env.example .env
# Fill in MONGODB_URI, OPENAI_API_KEY, JWT_SECRET, REDIS_URL in .env

npm run seed    # drops and re-inserts the 8 knowledge base documents
npm start       # starts on PORT (default 3000)
```

---

## Docker (recommended)

Set `OPENAI_API_KEY` and `JWT_SECRET` in your environment or a `.env` file, then:

```bash
docker-compose up --build
```

This spins up the app, MongoDB, and Redis in one command. Seed data must be run separately:

```bash
docker-compose exec app node seed.js
```

---

## API Reference

### Auth

**Register**
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"yourpassword"}'
```
```json
{ "user": { "_id": "...", "email": "you@example.com", "createdAt": "..." } }
```

**Login**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","password":"yourpassword"}'
```
```json
{ "token": "<jwt>", "user": { "_id": "...", "email": "..." } }
```

---

### Ask (requires JWT)

```bash
curl -X POST http://localhost:3000/api/ask \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <token>' \
  -d '{"question":"What is the refund policy?"}'
```
```json
{
  "answer": "We offer a 14-day money-back guarantee. Refunds are processed within 5–7 business days...",
  "sources": ["664f1a2b3c4d5e6f7a8b9c0d"],
  "confidence": "high"
}
```

Rate limit: 10 requests/minute per user. Exceeding returns:
```json
{ "error": "Rate limit exceeded", "retryAfter": 45 }
```

---

### Q&A History

```bash
curl http://localhost:3000/api/ask/history \
  -H 'Authorization: Bearer <token>'
```
```json
{
  "history": [
    {
      "_id": "...",
      "question": "What is the refund policy?",
      "answer": "...",
      "sources": ["..."],
      "confidence": "high",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### Documents

```bash
curl http://localhost:3000/api/docs
```
```json
{ "count": 8, "documents": [ { "_id": "...", "title": "...", "tags": [...] } ] }
```

---

### Health

```bash
curl http://localhost:3000/api/health
```
```json
{
  "status": "ok",
  "uptime": 142,
  "mongoStatus": "connected",
  "redisStatus": "connected",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Running Tests

```bash
npm test
```

Tests use `mongodb-memory-server` (no real DB needed) and mock the OpenAI API (no key needed, no cost).

---

## Architecture Notes

### Retrieval Scoring

Retrieval is TF-IDF without the IDF part — computing term frequency against a weighted token stream where title tokens count 3× and tag tokens count 2×. IDF was skipped intentionally: with 8 documents, a term appearing in 7 of them (e.g. "account") would be unfairly penalized against terms that only appear once.

Before scoring, the query goes through **query expansion**: stop words are removed, bigrams of adjacent meaningful tokens are generated (so "rate limit" also scores as the bigram `rate_limit`), and both are matched against each document.

After the initial keyword pass, the top `N*2` candidates are **re-ranked** using character trigram overlap between the question and document content. The final score blends keyword (70%) and trigram (30%) signals.

### Confidence Derivation

Confidence is determined by the top document's raw keyword score **before** the LLM is called:
- `score > 0.6` → `high`
- `score > 0.3` → `medium`
- otherwise → `low`

This value is injected into the LangChain prompt and returned in the response. The LLM's own confidence output is overridden — the retrieval quality signal is more reliable than a language model's self-assessment.

### LLM Grounding

The system prompt hard-restricts the LLM to the provided context documents and instructs it to respond with `"I don't have information about that in my knowledge base."` for out-of-scope questions. Structured output is enforced via `ChatOpenAI.withStructuredOutput(zodSchema)`, which uses OpenAI function-calling rather than prompt-based JSON — more reliable and less prone to formatting failures.
