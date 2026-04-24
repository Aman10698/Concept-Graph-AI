import { useState } from 'react';
import { extractTopicsFromText } from '../services/topicService';

export const useTopicExtraction = () => {
  const [topics, setTopics] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const extract = async (text) => {
    if (!text || text.trim().length === 0) {
      setError('No text provided');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await extractTopicsFromText(text);
      setTopics(result.data);
      return result.data;
    } catch (err) {
      const errorMessage = err.message || 'Failed to extract topics';
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const clearTopics = () => {
    setTopics(null);
    setError(null);
  };

  return {
    extract,
    topics,
    isLoading,
    error,
    clearTopics,
  };
};
