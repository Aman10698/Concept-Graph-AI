import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Service to evaluate student answers
 */

/**
 * Call backend to evaluate student answer
 * @param {string} studentAnswer - Student's submitted answer
 * @param {string} concept - The concept/topic being tested
 * @param {string} topic - Optional parent topic for context
 * @returns {Promise<object>} Evaluation result with rating and feedback
 */
export const evaluateAnswerAPI = async (studentAnswer, concept, topic = '', question = '') => {
  try {
    const response = await axios.post(`${API_BASE_URL}/evaluate-answer`, {
      studentAnswer,
      concept,
      topic,
      question,   // actual question text so Ollama evaluates in full context
    });

    if (response.data.success) {
      return {
        success: true,
        data: response.data.data,
      };
    } else {
      return {
        success: false,
        error: response.data.message,
      };
    }
  } catch (error) {
    console.error('Answer evaluation error:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to evaluate answer',
    };
  }
};

/**
 * Format evaluation results for display
 * @param {object} evaluation - Raw evaluation data from API
 * @returns {object} Formatted evaluation for UI
 */
export const formatEvaluationForDisplay = (evaluation) => {
  if (!evaluation) return null;

  // Ollama returns: accuracy, depth, examples, clarity
  // Legacy rule-based returns: keyword, length, understanding
  const scores = evaluation.scores || {};

  return {
    rating:          evaluation.rating    || 'unknown',
    score:           evaluation.score     || 0,
    confidence:      evaluation.confidence ?? evaluation.score ?? 0,
    feedback:        evaluation.feedback  || '',
    strengths:       evaluation.strengths       || [],
    improvements:    evaluation.improvements    || [],
    missingConcepts: evaluation.missingConcepts || [],
    source:          evaluation.source    || 'unknown',
    scores: {
      // Ollama schema (primary)
      accuracy:      scores.accuracy      ?? scores.keyword      ?? 0,
      depth:         scores.depth         ?? scores.length       ?? 0,
      examples:      scores.examples      ?? scores.understanding ?? 0,
      clarity:       scores.clarity       ?? 0,
      // Legacy keys kept for any old references
      keyword:       scores.keyword       ?? scores.accuracy     ?? 0,
      length:        scores.length        ?? scores.depth        ?? 0,
      understanding: scores.understanding ?? scores.examples     ?? 0,
    },
    details: evaluation.details || {},
  };
};
