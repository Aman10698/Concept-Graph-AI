import { useState } from 'react';
import { handleAPIError, createUserFriendlyError, retryableRequest } from '../utils/errorHandler';

export const useErrorHandler = () => {
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const handleError = (err) => {
    const errorResponse = handleAPIError(err);
    const userMessage = createUserFriendlyError(errorResponse);
    
    setError({
      ...errorResponse,
      userMessage,
    });

    return errorResponse;
  };

  const clearError = () => {
    setError(null);
    setRetryCount(0);
  };

  const executeWithErrorHandling = async (fn) => {
    setIsLoading(true);
    clearError();

    try {
      const result = await retryableRequest(fn, 3);
      setIsLoading(false);
      return result;
    } catch (err) {
      handleError(err);
      setIsLoading(false);
      return null;
    }
  };

  return {
    error,
    isLoading,
    retryCount,
    handleError,
    clearError,
    executeWithErrorHandling,
  };
};
