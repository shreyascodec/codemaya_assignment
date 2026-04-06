'use strict';

const logger = require('../config/logger');
const { retrieveDocuments } = require('../services/retrievalService');
const { generateAnswer } = require('../services/ragService');
const { saveHistory, getRecentHistory } = require('../services/historyService');

async function ask(req, res, next) {
  const start = Date.now();

  try {
    const { question } = req.body;

    if (!question || typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({ error: 'question is required and must be a non-empty string' });
    }

    const trimmedQuestion = question.trim();

    // Retrieval first — confidence comes from here, not from the LLM
    const { docs, confidence } = await retrieveDocuments(trimmedQuestion);

    // Short-circuit if corpus is empty — no point calling the LLM with no context
    if (docs.length === 0) {
      return res.json({
        answer: "I don't have information about that in my knowledge base.",
        sources: [],
        confidence: 'low',
      });
    }

    const result = await generateAnswer(trimmedQuestion, docs, confidence);

    const latencyMs = Date.now() - start;

    // Structured log — shipped to whatever sink pino is configured for
    logger.info({
      event: 'ask',
      requestId: req.requestId,
      userId: req.user.id,
      question: trimmedQuestion.slice(0, 80), // truncate so logs don't bloat
      latencyMs,
      confidence: result.confidence,
      sourceCount: result.sources.length,
    });

    // Persist to history async — don't await so it doesn't add latency to the response
    saveHistory({
      userId: req.user.id,
      question: trimmedQuestion,
      answer: result.answer,
      sources: result.sources,
      confidence: result.confidence,
    }).catch((err) => logger.warn({ err: err.message }, 'Failed to save QA history'));

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function history(req, res, next) {
  try {
    const items = await getRecentHistory(req.user.id);
    res.json({ history: items });
  } catch (err) {
    next(err);
  }
}

module.exports = { ask, history };
