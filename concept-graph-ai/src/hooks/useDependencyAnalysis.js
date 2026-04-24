import { useState } from 'react';
import { analyzeDependenciesAPI, formatDependenciesForDisplay } from '../services/dependencyService';

/**
 * Hook to manage dependency analysis state
 */
export const useDependencyAnalysis = () => {
  const [dependencies, setDependencies] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Analyze dependencies for topics
   * @param {Array<string>} topics - Array of topic names
   * @param {string} extractedText - Optional extracted text
   */
  const analyze = async (topics, extractedText = '') => {
    setIsAnalyzing(true);
    setError(null);
    setDependencies(null);

    try {
      const result = await analyzeDependenciesAPI(topics, extractedText);

      if (result.success) {
        const formattedDependencies = formatDependenciesForDisplay(result.data);
        setDependencies(formattedDependencies);
        return formattedDependencies;
      } else {
        setError(result.error);
        return null;
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to analyze dependencies';
      setError(errorMessage);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Clear dependency data
   */
  const clearDependencies = () => {
    setDependencies(null);
    setError(null);
  };

  return {
    dependencies,
    isAnalyzing,
    error,
    analyze,
    clearDependencies,
  };
};

export default useDependencyAnalysis;
