'use strict';

const Document = require('../models/Document');

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'up',
  'about', 'into', 'through', 'during', 'before', 'after', 'above',
  'below', 'between', 'out', 'off', 'over', 'under', 'again', 'then',
  'once', 'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'either',
  'not', 'no', 'what', 'how', 'when', 'where', 'who', 'which', 'that',
  'this', 'these', 'those', 'it', 'its', 'my', 'your', 'their', 'our',
  'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'her', 'us',
  'if', 'as', 'than', 'just', 'also', 'very', 'any', 'all', 'each',
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[\s\W]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function computeTF(tokens) {
  const freq = {};
  tokens.forEach((t) => { freq[t] = (freq[t] || 0) + 1; });
  const total = tokens.length || 1;
  const tf = {};
  for (const [term, count] of Object.entries(freq)) {
    tf[term] = count / total;
  }
  return tf;
}

function expandQuery(question) {
  const base = tokenize(question);
  const expanded = new Set(base);

  for (let i = 0; i < base.length - 1; i++) {
    expanded.add(`${base[i]}_${base[i + 1]}`);
  }

  return [...expanded];
}

function scoreDocument(doc, queryTokens) {
  const titleTokens = tokenize(doc.title);
  const contentTokens = tokenize(doc.content);
  const tagTokens = doc.tags.flatMap((tag) => tokenize(tag));

  const weightedTokens = [
    ...titleTokens, ...titleTokens, ...titleTokens,
    ...tagTokens, ...tagTokens,
    ...contentTokens,
  ];

  const tf = computeTF(weightedTokens);

  let score = 0;
  for (const token of queryTokens) {
    if (tf[token]) {
      score += tf[token];
    }

    for (const docToken of Object.keys(tf)) {
      if (docToken !== token && (docToken.startsWith(token) || token.startsWith(docToken))) {
        score += tf[docToken] * 0.4;
      }
    }
  }

  return score;
}

function ngramOverlap(s1, s2, n = 3) {
  const ngrams = (str) => {
    const result = new Set();
    const normalized = str.toLowerCase().replace(/\s+/g, ' ');
    for (let i = 0; i <= normalized.length - n; i++) {
      result.add(normalized.slice(i, i + n));
    }
    return result;
  };

  const g1 = ngrams(s1);
  const g2 = ngrams(s2);
  let overlap = 0;
  g1.forEach((g) => { if (g2.has(g)) overlap++; });

  return overlap / Math.max(g1.size + g2.size - overlap, 1);
}

async function retrieveDocuments(question, topN = 3) {
  const docs = await Document.find({}).lean();

  if (docs.length === 0) return { docs: [], confidence: 'low', topScore: 0 };

  const queryTokens = expandQuery(question);

  const keywordScored = docs
    .map((doc) => ({ doc, keywordScore: scoreDocument(doc, queryTokens) }))
    .sort((a, b) => b.keywordScore - a.keywordScore)
      .slice(0, Math.min(topN * 2, docs.length)); 

  const reRanked = keywordScored
    .map((item) => ({
      ...item,
      finalScore: item.keywordScore * 0.7 + ngramOverlap(question, item.doc.content) * 0.3,
    }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topN);

  const topKw = reRanked[0]?.keywordScore || 0;
  const topFinal = reRanked[0]?.finalScore || 0;
  // TF keyword scores stay < ~0.2 for most queries; combine with reranked score (trigram overlap).
  // High = strong lexical + overlap — typical good in-KB answers land here.
  const confidence =
    topKw >= 0.13 || topFinal >= 0.13
      ? 'high'
      : topKw >= 0.06 || topFinal >= 0.07
        ? 'medium'
        : 'low';

  return { docs: reRanked.map((r) => r.doc), confidence, topScore: topKw };
}

module.exports = { retrieveDocuments };
