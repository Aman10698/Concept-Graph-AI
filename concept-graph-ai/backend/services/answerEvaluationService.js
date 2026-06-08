/**
 * Answer Evaluation Service — Gemini AI-powered
 * Uses Google Gemini for deep answer evaluation.
 */

// ⚠️  Use ollamaWorkerService (spawns isolated subprocess) NOT ollamaService directly.
// Direct calls buffer the full LLM response in the server's 2 GB heap and crash it.
const ollamaService = require('./ollamaWorkerService');

/**
 * Evaluate a student's answer with Ollama.
 *
 * @param {string} studentAnswer - The answer submitted by the student
 * @param {string} question      - The question that was asked
 * @param {string} topic         - Topic context (used to hint key concepts)
 * @returns {object} Evaluation result { rating, score, scores, feedback, strengths, improvements, missingConcepts }
 */
const evaluateAnswer = async (studentAnswer, question, topic = '') => {
  if (!studentAnswer || typeof studentAnswer !== 'string' || studentAnswer.trim().length < 5) {
    return errorResult('Answer is too short or empty');
  }
  if (!question || typeof question !== 'string') {
    return errorResult('Question not provided for evaluation');
  }

  console.log('✨ [Gemini] Evaluating answer...');

  // Pass topic as a key-concept hint so Ollama knows what to look for
  const keyConcepts = topic ? [topic] : [];

  const result = await ollamaService.evaluateAnswer(question, studentAnswer, keyConcepts);

  if (!result) {
    console.warn('⚠️  Gemini evaluation returned null — falling back');
    return fallbackEvaluation(studentAnswer, topic);
  }

  console.log(`✅ [Gemini] Evaluation: ${result.rating} (score: ${result.score})`);
  return result;
};

/* ── helpers ─────────────────────────────────────────────────────────────── */

const errorResult = (msg) => ({
  rating: 'weak',
  score: 0,
  confidence: 0,
  scores: { accuracy: 0, depth: 0, examples: 0, clarity: 0, keyword: 0, length: 0, understanding: 0 },
  feedback: msg,
  strengths: [],
  improvements: ['Provide a complete and relevant answer.'],
  missingConcepts: [],
  source: 'error',
});

const fallbackEvaluation = (answer, topic) => {
  const wordCount = answer.trim().split(/\s+/).length;
  let score = 30;
  if (wordCount > 30)  score = 50;
  if (wordCount > 80)  score = 65;
  if (wordCount > 150) score = 75;

  const rating = score >= 75 ? 'strong' : score >= 45 ? 'partial' : 'weak';

  return {
    rating,
    score,
    confidence: 40,
    scores: { accuracy: score, depth: score, examples: score, clarity: score, keyword: score, length: score, understanding: score },
    feedback: `Your answer has been reviewed. Aim for more depth and specific examples related to "${topic || 'the topic'}".`,
    strengths: wordCount > 50 ? ['Reasonable length'] : [],
    improvements: ['Add specific examples', 'Explain the underlying concepts more clearly'],
    missingConcepts: [],
    source: 'fallback',
  };
};

/* ── legacy extract helpers (kept for backward compat) ───────────────────── */
const extractKeywords = (text) => {
  return new Set(text.toLowerCase().replace(/[.,!?;:()[\]{}]/g, ' ').split(/\s+/).filter(w => w.length > 2));
};

module.exports = {
  evaluateAnswer,
  extractKeywords,
};
