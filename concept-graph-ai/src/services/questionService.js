import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Generate questions from topics using backend API
 */
export const generateQuestionsAPI = async (topics, extractedText = '') => {
  try {
    if (!topics || !Array.isArray(topics)) {
      throw new Error('Topics must be an array');
    }

    if (topics.length === 0) {
      throw new Error('At least one topic is required');
    }

    const response = await axios.post(`${API_BASE_URL}/questions`, {
      topics,
      extractedText,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message ||
      error.message ||
      'Failed to generate questions'
    );
  }
};

/**
 * Format questions for display
 */
export const formatQuestionsForDisplay = (questionsData) => {
  if (!questionsData || !questionsData.data) {
    return null;
  }

  const { questions, questionsByType, questionsByDifficulty } = questionsData.data;

  return {
    questions,
    grouped: {
      byType: questionsByType,
      byDifficulty: questionsByDifficulty,
    },
    stats: {
      total: questions.length,
      types: Object.keys(questionsByType).length,
      difficulties: Object.keys(questionsByDifficulty).length,
    },
  };
};
