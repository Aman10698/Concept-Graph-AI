import { useState } from 'react';
import { generateQuestionsAPI, formatQuestionsForDisplay } from '../services/questionService';

export const useQuestionGeneration = () => {
  const [questions, setQuestions] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [questionsData, setQuestionsData] = useState(null);

  const generate = async (topics, extractedText = '') => {
    if (!topics || topics.length === 0) {
      setError('Topics are required to generate questions');
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateQuestionsAPI(topics, extractedText);
      const formatted = formatQuestionsForDisplay(result);
      
      setQuestionsData(formatted);
      setQuestions(result.data.questions);

      return formatted;
    } catch (err) {
      const errorMessage = err.message || 'Failed to generate questions';
      setError(errorMessage);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const clearQuestions = () => {
    setQuestions(null);
    setQuestionsData(null);
    setError(null);
  };

  return {
    questions,
    questionsData,
    isGenerating,
    error,
    generate,
    clearQuestions,
  };
};
