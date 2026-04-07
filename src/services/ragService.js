'use strict';

const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { z } = require('zod');

// Response shape is validated by Zod before it ever reaches the controller.
// withStructuredOutput() uses OpenAI function-calling under the hood, which
// is more reliable than prompting for JSON and parsing it yourself.
const answerSchema = z.object({
  answer: z.string().describe('The answer derived strictly from the provided context documents'),
  sources: z
    .array(z.string())
    .describe('MongoDB _id strings of the documents you drew information from'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('Confidence level — use the exact value provided in the system message'),
});

// PromptTemplate lets us swap context or instructions without rewriting the chain.
// The {confidence} token is injected by the retrieval service, not guessed by the LLM.
const SYSTEM_TEMPLATE = `You are a product support assistant for a SaaS platform. \
Your ONLY knowledge source is the context documents provided below. \
Do not use any external knowledge, make assumptions, or speculate beyond what is written.

Rules:
- If the answer is clearly present in the context, answer it directly and cite source IDs.
- If the answer is partially present, answer what you can and be explicit about gaps.
- If the answer is NOT present at all, respond with exactly: \
"I don't have information about that in my knowledge base."
- Never fabricate facts, pricing, dates, or feature names.
- Confidence is pre-determined by the retrieval system as "{confidence}" — \
use this exact value in the confidence field.

Context documents:
{context}`;

const systemPromptTemplate = PromptTemplate.fromTemplate(SYSTEM_TEMPLATE);

let llmWithStructuredOutput = null;

function getLlm() {
  if (!llmWithStructuredOutput) {
    const llm = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0, // zero temp for deterministic, grounded answers
    });
    // withStructuredOutput binds a Zod schema to the model via function-calling —
    // the response is parsed and validated before we ever see it
    llmWithStructuredOutput = llm.withStructuredOutput(answerSchema, {
      name: 'answer_question',
    });
  }
  return llmWithStructuredOutput;
}

/**
 * Format retrieved docs into the context block that goes into the prompt.
 * Including the _id makes it easy for the LLM to cite sources correctly.
 */
function formatContext(docs) {
  return docs
    .map(
      (doc, i) =>
        `[Document ${i + 1}]\nID: ${doc._id}\nTitle: ${doc.title}\nTags: ${doc.tags.join(', ')}\n\n${doc.content}`
    )
    .join('\n\n---\n\n');
}

/**
 * Run the RAG chain: build the prompt, call the LLM, validate the response.
 * Confidence is passed in from the retrieval service and injected into the
 * prompt so the LLM echoes it back — we override the LLM's confidence field
 * with the retrieval-derived value after the call for safety.
 */
async function generateAnswer(question, docs, confidence) {
  const context = formatContext(docs);
  const systemPrompt = await systemPromptTemplate.format({ context, confidence });

  const llm = getLlm();

  const result = await llm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ]);

  // Only include IDs that actually exist in the retrieved set — prevents the LLM
  // from hallucinating doc IDs it never saw, which would confuse any client
  // trying to fetch the source documents
  const validIds = new Set(docs.map((d) => d._id.toString()));
  const sanitizedSources = (result.sources || []).filter((id) => validIds.has(id));

  // If the LLM answered but cited nothing, fall back to all retrieved IDs —
  // better to over-attribute than to return an answer with no traceable source
  const sources = sanitizedSources.length > 0 ? sanitizedSources : docs.map((d) => d._id.toString());

  // Retrieval confidence overrides whatever the LLM returned — belt and suspenders
  return {
    answer: result.answer,
    sources,
    confidence, // always from retrieval, never from LLM output
  };
}

module.exports = { generateAnswer };
