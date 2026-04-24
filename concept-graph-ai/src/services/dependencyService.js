import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Service to analyze topic dependencies
 */

/**
 * Call backend to analyze dependencies
 * @param {Array<string>} topics - Array of topic names
 * @param {string} extractedText - Optional extracted text
 * @returns {Promise<object>} Dependency analysis result
 */
export const analyzeDependenciesAPI = async (topics, extractedText = '') => {
  try {
    const response = await axios.post(`${API_BASE_URL}/analyze-dependencies`, {
      topics,
      extractedText,
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
    console.error('Dependency analysis error:', error);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to analyze dependencies',
    };
  }
};

/**
 * Format dependency data for display
 * @param {object} dependencyData - Raw dependency data from API
 * @returns {object} Formatted data for UI
 */
export const formatDependenciesForDisplay = (dependencyData) => {
  if (!dependencyData) return null;

  return {
    dependencies:     dependencyData.dependencies     || [],
    relationships:    dependencyData.relationships    || [],
    graph:            dependencyData.graph            || { nodes: [], edges: [] },
    analysis:         dependencyData.analysis         || {},
    recommendedOrder: dependencyData.recommendedOrder || [],
    criticalPath:     dependencyData.criticalPath     || [],
    topicDifficulty:  dependencyData.topicDifficulty  || [],
  };
};
