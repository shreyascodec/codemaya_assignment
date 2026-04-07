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

    const { docs, confidence } = await retrieveDocuments(trimmedQuestion);

    if (docs.length === 0) {
      return res.json({
        answer: "I don't have information about that in my knowledge base.",
        sources: [],
        confidence: 'low',
      });
    }

    const result = await generateAnswer(trimmedQuestion, docs, confidence);

    const latencyMs = Date.now() - start;

    logger.info({
      event: 'ask',
      requestId: req.requestId,
      userId: req.user.id,
      question: trimmedQuestion.slice(0, 80), 
      latencyMs,
      confidence: result.confidence,  
      sourceCount: result.sources.length,
    });

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
