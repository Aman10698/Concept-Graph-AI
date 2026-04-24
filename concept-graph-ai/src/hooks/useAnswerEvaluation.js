import { useState } from 'react';
import { evaluateAnswerAPI, formatEvaluationForDisplay } from '../services/evaluationService';

/**
 * Hook to manage answer evaluation state
 */
export const useAnswerEvaluation = () => {
  const [evaluation, setEvaluation] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Evaluate a student's answer
   * @param {string} studentAnswer - Student's submitted answer
   * @param {string} concept - The concept being evaluated
   * @param {string} topic - Optional parent topic
   */
  const evaluate = async (studentAnswer, concept, topic = '', question = '') => {
    setIsEvaluating(true);
    setError(null);
    setEvaluation(null);

    try {
      const result = await evaluateAnswerAPI(studentAnswer, concept, topic, question);

      if (result.success) {
        const formattedEvaluation = formatEvaluationForDisplay(result.data);
        setEvaluation(formattedEvaluation);
        return formattedEvaluation;
      } else {
        setError(result.error);
        return null;
      }
    } catch (err) {
      const errorMessage = err.message || 'Failed to evaluate answer';
      setError(errorMessage);
      return null;
    } finally {
      setIsEvaluating(false);
    }
  };

  /**
   * Clear evaluation state
   */
  const clearEvaluation = () => {
    setEvaluation(null);
    setError(null);
  };

  return {
    evaluation,
    isEvaluating,
    error,
    evaluate,
    clearEvaluation,
  };
};

export default useAnswerEvaluation;
