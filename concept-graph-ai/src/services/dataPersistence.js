/**
 * Data Persistence Utility
 * Handles automatic saving of data as users interact with the app
 */

import {
  saveGraphData,
  saveQuizResult,
  updateTopicMastery,
  addWeakTopic,
} from '../services/databaseService';

/**
 * Save graph data when concepts are extracted
 */
export const persistGraphData = async (userId, topicsData, extractedText) => {
  try {
    const graphData = {
      topics: topicsData.topics || [],
      extractedText: extractedText.substring(0, 10000), // Limit text size
      topicCount: topicsData.topics?.length || 0,
      savedAt: new Date().toISOString(),
    };

    return await saveGraphData(userId, graphData, `graph_${Date.now()}`);
  } catch (error) {
    console.error('Error persisting graph data:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Save quiz result when an answer is evaluated
 */
export const persistQuizResult = async (userId, questionData, answerEvaluation) => {
  try {
    const quizResult = {
      question: questionData.question,
      topic: questionData.topic || 'General',
      questionType: questionData.type || 'general',
      difficulty: questionData.difficulty || 'intermediate',
      userAnswer: answerEvaluation.userAnswer || '',
      rating: answerEvaluation.rating || 'unevaluated',
      confidence: answerEvaluation.confidence || 0,
      scores: answerEvaluation.scores || {},
      feedback: answerEvaluation.feedback || '',
      answeredAt: new Date().toISOString(),
    };

    const result = await saveQuizResult(userId, quizResult);

    // Update progress based on answer
    if (answerEvaluation.rating) {
      await updateTopicMastery(
        userId,
        questionData.topic || 'General',
        answerEvaluation.rating,
        answerEvaluation.confidence || 0
      );
    }

    return result;
  } catch (error) {
    console.error('Error persisting quiz result:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Track weak topics from quiz results
 */
export const persistWeakTopicDetection = async (userId, weakTopic, rootCause) => {
  try {
    return await addWeakTopic(userId, weakTopic, rootCause);
  } catch (error) {
    console.error('Error persisting weak topic:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Batch save multiple quiz results
 */
export const batchPersistQuizResults = async (userId, results) => {
  try {
    const promises = results.map((result) =>
      saveQuizResult(userId, {
        ...result,
        batchSavedAt: new Date().toISOString(),
      })
    );

    await Promise.all(promises);
    return { success: true, message: `Saved ${results.length} quiz results` };
  } catch (error) {
    console.error('Error batch persisting results:', error);
    return { success: false, error: error.message };
  }
};

const dataPersistenceService = {
  persistGraphData,
  persistQuizResult,
  persistWeakTopicDetection,
  batchPersistQuizResults,
};
export default dataPersistenceService;
