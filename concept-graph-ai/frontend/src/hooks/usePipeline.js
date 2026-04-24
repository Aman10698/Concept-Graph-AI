import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * usePipeline Hook
 * 
 * Comprehensive hook for the complete learning pipeline
 * Handles:
 * - Document upload and processing
 * - Quiz generation and answering
 * - Progress tracking
 * - Statistics and recommendations
 */
export const usePipeline = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentGraph, setCurrentGraph] = useState(null);
  const [currentQuiz, setCurrentQuiz] = useState(null);
  const [progress, setProgress] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [recommendations, setRecommendations] = useState(null);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Phase 1: Process Document
   * Upload → Extract text → Topics → Graph
   */
  const processDocument = useCallback(async (file, userId) => {
    setLoading(true);
    setError(null);
    try {
      console.log('📄 Processing document...');
      
      const formData = new FormData();
      formData.append('document', file);
      formData.append('userId', userId);

      const response = await axios.post(
        `${API_URL}/pipeline/process-document`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        setCurrentGraph(response.data.data);
        console.log('✅ Document processed successfully');
        return {
          success: true,
          data: response.data.data,
          summary: response.data.summary,
        };
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      setError(errorMessage);
      console.error('❌ Error processing document:', errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Phase 2: Generate Quiz
   * Get topics from graph → Generate questions
   */
  const generateQuiz = useCallback(async (userId, graphId = null, topicFilter = null) => {
    setLoading(true);
    setError(null);
    try {
      console.log('📝 Generating quiz...');
      
      const response = await axios.post(`${API_URL}/pipeline/generate-quiz`, {
        userId,
        graphId,
        topicFilter,
      });

      if (response.data.success) {
        setCurrentQuiz(response.data.data);
        console.log('✅ Quiz generated successfully');
        return {
          success: true,
          data: response.data.data,
        };
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      setError(errorMessage);
      console.error('❌ Error generating quiz:', errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Phase 3: Submit Answer
   * Evaluate → Update progress → Save result
   */
  const submitAnswer = useCallback(
    async (userId, question, userAnswer, topic, confidence = 50) => {
      setLoading(true);
      setError(null);
      try {
        console.log('✍️ Submitting answer...');
        
        const response = await axios.post(`${API_URL}/pipeline/submit-answer`, {
          userId,
          question,
          userAnswer,
          topic,
          confidence,
        });

        if (response.data.success) {
          console.log('✅ Answer evaluated successfully');
          return {
            success: true,
            data: response.data.data,
            summary: response.data.summary,
          };
        }
      } catch (err) {
        const errorMessage = err.response?.data?.error || err.message;
        setError(errorMessage);
        console.error('❌ Error submitting answer:', errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  /**
   * Get Dashboard Statistics
   * Total questions, accuracy, weak topics
   */
  const getStatistics = useCallback(async (userId) => {
    setLoading(true);
    setError(null);
    try {
      console.log('📊 Loading statistics...');
      
      const response = await axios.get(
        `${API_URL}/pipeline/statistics/${userId}`
      );

      if (response.data.success) {
        setStatistics(response.data.data);
        console.log('✅ Statistics loaded');
        return {
          success: true,
          data: response.data.data,
        };
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      setError(errorMessage);
      console.error('❌ Error loading statistics:', errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get User Progress
   * Topics mastered, in progress, weak
   */
  const getProgress = useCallback(async (userId) => {
    setLoading(true);
    setError(null);
    try {
      console.log('📈 Loading progress...');
      
      const response = await axios.get(`${API_URL}/pipeline/progress/${userId}`);

      if (response.data.success) {
        setProgress(response.data.data);
        console.log('✅ Progress loaded');
        return {
          success: true,
          data: response.data.data,
        };
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      setError(errorMessage);
      console.error('❌ Error loading progress:', errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get Learning Recommendations
   * Focus topics, review topics, insights
   */
  const getRecommendations = useCallback(async (userId) => {
    setLoading(true);
    setError(null);
    try {
      console.log('💡 Loading recommendations...');
      
      const response = await axios.get(
        `${API_URL}/pipeline/recommendations/${userId}`
      );

      if (response.data.success) {
        setRecommendations(response.data.data);
        console.log('✅ Recommendations loaded');
        return {
          success: true,
          data: response.data.data,
        };
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || err.message;
      setError(errorMessage);
      console.error('❌ Error loading recommendations:', errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    // State
    loading,
    error,
    clearError,
    currentGraph,
    currentQuiz,
    progress,
    statistics,
    recommendations,

    // Methods
    processDocument,
    generateQuiz,
    submitAnswer,
    getStatistics,
    getProgress,
    getRecommendations,
  };
};
