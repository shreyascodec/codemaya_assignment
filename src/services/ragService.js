'use strict';

const { ChatOpenAI } = require('@langchain/openai');
const { PromptTemplate } = require('@langchain/core/prompts');
const { z } = require('zod');

const answerSchema = z.object({
  answer: z.string().describe('The answer derived strictly from the provided context documents'),
  sources: z
    .array(z.string())
    .describe('MongoDB _id strings of the documents you drew information from'),
  confidence: z
    .enum(['high', 'medium', 'low'])
    .describe('Confidence level — use the exact value provided in the system message'),
});

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
      temperature: 0, 
    });
    llmWithStructuredOutput = llm.withStructuredOutput(answerSchema, {
      name: 'answer_question',
    });
  }
  return llmWithStructuredOutput;
}

function formatContext(docs) {
  return docs
    .map(
      (doc, i) =>
        `[Document ${i + 1}]\nID: ${doc._id}\nTitle: ${doc.title}\nTags: ${doc.tags.join(', ')}\n\n${doc.content}`
    )
    .join('\n\n---\n\n');
}

async function generateAnswer(question, docs, confidence) {
  const context = formatContext(docs);
  const systemPrompt = await systemPromptTemplate.format({ context, confidence });

  const llm = getLlm();

  const result = await llm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ]);

  return {
    answer: result.answer,
    sources: result.sources,
    confidence, 
  };
}

module.exports = { generateAnswer };
