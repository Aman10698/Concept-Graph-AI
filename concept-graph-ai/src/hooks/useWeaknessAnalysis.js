import { useState } from 'react';
import { traceWeaknessAPI, analyzeWeaknessPatternsAPI } from '../services/weaknessService';

/**
 * Hook to manage weakness analysis state
 */
export const useWeaknessAnalysis = () => {
  const [weaknessTrace, setWeaknessTrace] = useState(null);
  const [weaknessPatterns, setWeaknessPatterns] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Trace a weak topic back to its weakest foundation
   * @param {string} weakTopic - The topic marked as weak
   * @param {Array<string>} allTopics - All available topics
   * @param {object} evaluationData - Evaluation ratings
   */
  const traceWeakness = async (weakTopic, allTopics, evaluationData = {}) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await traceWeaknessAPI(weakTopic, allTopics, evaluationData);

      if (result.success) {
        setWeaknessTrace(result.data);
        return result.data;
      } else {
        setError(result.error);
        return null;
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to trace weakness';
      setError(errorMessage);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Analyze weakness patterns across multiple topics
   * @param {Array<string>} weakTopics - Multiple weak topics
   * @param {Array<string>} allTopics - All available topics
   * @param {object} evaluationData - Evaluation ratings
   */
  const analyzePatterns = async (weakTopics, allTopics, evaluationData = {}) => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeWeaknessPatternsAPI(weakTopics, allTopics, evaluationData);

      if (result.success) {
        setWeaknessPatterns(result.data);
        return result.data;
      } else {
        setError(result.error);
        return null;
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to analyze patterns';
      setError(errorMessage);
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  };

  /**
   * Clear weakness analysis data
   */
  const clearWeaknessData = () => {
    setWeaknessTrace(null);
    setWeaknessPatterns(null);
    setError(null);
  };

  return {
    weaknessTrace,
    weaknessPatterns,
    isAnalyzing,
    error,
    traceWeakness,
    analyzePatterns,
    clearWeaknessData,
  };
};

export default useWeaknessAnalysis;
