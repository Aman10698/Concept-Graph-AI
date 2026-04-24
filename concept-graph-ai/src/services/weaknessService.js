import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Service to analyze weakness traces
 */

/**
 * Trace weakness through dependency chain
 * @param {string} weakTopic - The topic marked as weak
 * @param {Array<string>} allTopics - All available topics
 * @param {object} evaluationData - Evaluation data with ratings
 * @returns {Promise<object>} Weakness trace result
 */
export const traceWeaknessAPI = async (weakTopic, allTopics, evaluationData = {}) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/trace-weakness`, {
      weakTopic,
      allTopics,
      evaluationData,
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
    console.error('Weakness trace error:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to trace weakness',
    };
  }
};

/**
 * Analyze weakness patterns across multiple topics
 * @param {Array<string>} weakTopics - Multiple weak topics
 * @param {Array<string>} allTopics - All available topics
 * @param {object} evaluationData - Evaluation data
 * @returns {Promise<object>} Pattern analysis result
 */
export const analyzeWeaknessPatternsAPI = async (
  weakTopics,
  allTopics,
  evaluationData = {}
) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/analyze-weakness-patterns`, {
      weakTopics,
      allTopics,
      evaluationData,
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
    console.error('Weakness pattern analysis error:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to analyze patterns',
    };
  }
};
