import { useState } from 'react';
import {
  saveGraphData,
  getGraphData,
  saveQuizResult,
  getQuizResults,
  getQuizStatistics,
  saveUserProgress,
  getUserProgress,
  updateTopicMastery,
  addWeakTopic,
  createUserDataBackup,
  exportUserData,
} from '../services/databaseService';
import { useAuth } from '../context/AuthContext';

/**
 * Hook for managing graph data storage and retrieval
 */
export const useGraphStorage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveGraph = async (graphData, documentName) => {
    if (!user) {
      setError('User not authenticated');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await saveGraphData(user.uid, graphData, documentName);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Error saving graph';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const loadGraphs = async () => {
    if (!user) {
      setError('User not authenticated');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getGraphData(user.uid);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Error loading graphs';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  return { saveGraph, loadGraphs, isLoading, error };
};

/**
 * Hook for managing quiz results storage and retrieval
 */
export const useQuizStorage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveResult = async (quizResult) => {
    if (!user) {
      setError('User not authenticated');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await saveQuizResult(user.uid, quizResult);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Error saving quiz result';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const loadResults = async (options) => {
    if (!user) {
      setError('User not authenticated');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getQuizResults(user.uid, options);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Error loading quiz results';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const getStats = async () => {
    if (!user) {
      setError('User not authenticated');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getQuizStatistics(user.uid);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Error loading statistics';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  return { saveResult, loadResults, getStats, isLoading, error };
};

/**
 * Hook for managing user progress tracking
 */
export const useProgressTracking = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const saveProgress = async (progress) => {
    if (!user) {
      setError('User not authenticated');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await saveUserProgress(user.uid, progress);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Error saving progress';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const loadProgress = async () => {
    if (!user) {
      setError('User not authenticated');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getUserProgress(user.uid);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Error loading progress';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const updateMastery = async (topic, masteryLevel, confidence) => {
    if (!user) {
      setError('User not authenticated');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await updateTopicMastery(user.uid, topic, masteryLevel, confidence);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Error updating mastery';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const markWeakTopic = async (topic, rootCause) => {
    if (!user) {
      setError('User not authenticated');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await addWeakTopic(user.uid, topic, rootCause);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Error marking weak topic';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  return { saveProgress, loadProgress, updateMastery, markWeakTopic, isLoading, error };
};

/**
 * Hook for data backup and export
 */
export const useDataBackup = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const backup = async () => {
    if (!user) {
      setError('User not authenticated');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await createUserDataBackup(user.uid);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Error creating backup';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const exportData = async () => {
    if (!user) {
      setError('User not authenticated');
      return { success: false };
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await exportUserData(user.uid);
      if (!result.success) {
        setError(result.error);
      }
      return result;
    } catch (err) {
      const errorMsg = err.message || 'Error exporting data';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  return { backup, exportData, isLoading, error };
};

export default {
  useGraphStorage,
  useQuizStorage,
  useProgressTracking,
  useDataBackup,
};
