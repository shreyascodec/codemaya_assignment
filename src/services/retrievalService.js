'use strict';

const Document = require('../models/Document');

// Stop words that don't carry semantic weight. Keeping this list short and
// domain-general — product-specific terms like "plan" or "account" are
// meaningful enough to keep.
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

/**
 * Tokenize and normalize text — lowercase, strip non-alphanumeric, filter
 * short tokens. Returns an array that may contain duplicates (needed for TF).
 */
function tokenize(text) {
  return text
    .toLowerCase()
    .split(/[\s\W]+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

/**
 * Term Frequency for a token array. Returns a map of token -> freq/total.
 * Deliberately skipping IDF because our corpus is tiny — adding IDF to 8 docs
 * would over-penalize terms that happen to appear in 7 of them (e.g. "account").
 */
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

/**
 * Query expansion — extract key noun-ish phrases by filtering stop words and
 * generating bigrams from adjacent meaningful tokens. Bigrams help match
 * "refund policy" even when indexed as separate tokens.
 */
function expandQuery(question) {
  const base = tokenize(question);
  const expanded = new Set(base);

  // Add bigrams — "rate limit" becomes "rate_limit" so it doesn't collide with singles
  for (let i = 0; i < base.length - 1; i++) {
    expanded.add(`${base[i]}_${base[i + 1]}`);
  }

  return [...expanded];
}

/**
 * Score a single document against a set of query tokens.
 * Title tokens are weighted 3x — a title match is a strong signal.
 * Tags are weighted 2x.
 */
function scoreDocument(doc, queryTokens) {
  const titleTokens = tokenize(doc.title);
  const contentTokens = tokenize(doc.content);
  const tagTokens = doc.tags.flatMap((tag) => tokenize(tag));

  // Weighted token stream — inflate important fields
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

    // Partial match for prefix/suffix overlap (e.g. "refund" matches "refunds")
    for (const docToken of Object.keys(tf)) {
      if (docToken !== token && (docToken.startsWith(token) || token.startsWith(docToken))) {
        score += tf[docToken] * 0.4;
      }
    }
  }

  return score;
}

/**
 * Character n-gram overlap between two strings — used for semantic re-ranking
 * after the keyword pass. Trigrams are cheap and surprisingly effective for
 * catching morphological variants and misspellings.
 */
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

  // Jaccard-style normalization
  return overlap / Math.max(g1.size + g2.size - overlap, 1);
}

/**
 * Main retrieval function. Returns top docs and a confidence level derived
 * from the top keyword score. Confidence is NOT delegated to the LLM.
 *
 * Pipeline:
 *   1. Expand query tokens (with bigrams)
 *   2. Score all docs with weighted TF
 *   3. Take top topN*2 candidates
 *   4. Re-rank with n-gram overlap (70% keyword, 30% n-gram)
 *   5. Slice to topN, compute confidence from raw keyword score
 */
async function retrieveDocuments(question, topN = 3) {
  const docs = await Document.find({}).lean();

  if (docs.length === 0) return { docs: [], confidence: 'low', topScore: 0 };

  const queryTokens = expandQuery(question);

  // Step 1+2: keyword scoring
  const keywordScored = docs
    .map((doc) => ({ doc, keywordScore: scoreDocument(doc, queryTokens) }))
    .sort((a, b) => b.keywordScore - a.keywordScore)
    .slice(0, Math.min(topN * 2, docs.length)); // candidate pool for re-ranking

  // Step 3: n-gram re-ranking — blended score to avoid keyword score dominating
  const reRanked = keywordScored
    .map((item) => ({
      ...item,
      finalScore: item.keywordScore * 0.7 + ngramOverlap(question, item.doc.content) * 0.3,
    }))
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topN);

  // Confidence derived from keyword score of the best match — intentionally
  // using keywordScore not finalScore so the threshold is consistent regardless
  // of corpus size
  const topScore = reRanked[0]?.keywordScore || 0;
  const confidence = topScore > 0.6 ? 'high' : topScore > 0.3 ? 'medium' : 'low';

  return { docs: reRanked.map((r) => r.doc), confidence, topScore };
}

module.exports = { retrieveDocuments };
