import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../config/firebase';

/**
 * Database Service for Firestore operations
 * Handles storing and retrieving:
 * - Graph data (topics and relationships)
 * - Quiz results (answers and scores)
 * - User progress (mastery levels and weak topics)
 */

// ============= GRAPH DATA =============

/**
 * Save or update graph data for a user
 * @param {string} userId - User ID
 * @param {object} graphData - Topics and relationships
 * @param {string} documentName - Optional custom document name (default: "graphs")
 */
export const saveGraphData = async (userId, graphData, documentName = `graph_${Date.now()}`) => {
  try {
    const graphRef = doc(db, 'users', userId, 'graphs', documentName);
    await setDoc(graphRef, {
      ...graphData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { success: true, message: 'Graph data saved successfully' };
  } catch (error) {
    console.error('Error saving graph data:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all graph data for a user
 * @param {string} userId - User ID
 */
export const getGraphData = async (userId) => {
  try {
    const graphsRef = collection(db, 'users', userId, 'graphs');
    const snapshot = await getDocs(graphsRef);
    const graphs = [];
    snapshot.forEach((doc) => {
      graphs.push({
        id: doc.id,
        ...doc.data(),
      });
    });
    return { success: true, data: graphs };
  } catch (error) {
    console.error('Error retrieving graph data:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get a specific graph by ID
 * @param {string} userId - User ID
 * @param {string} graphId - Graph ID
 */
export const getGraphById = async (userId, graphId) => {
  try {
    const graphRef = doc(db, 'users', userId, 'graphs', graphId);
    const snapshot = await getDoc(graphRef);
    if (snapshot.exists()) {
      return { success: true, data: { id: snapshot.id, ...snapshot.data() } };
    } else {
      return { success: false, error: 'Graph not found' };
    }
  } catch (error) {
    console.error('Error retrieving graph:', error);
    return { success: false, error: error.message };
  }
};

// ============= QUIZ RESULTS =============

/**
 * Save quiz result for a user
 * @param {string} userId - User ID
 * @param {object} quizResult - Quiz result data including answers, scores, etc.
 */
export const saveQuizResult = async (userId, quizResult) => {
  try {
    const resultRef = doc(db, 'users', userId, 'quizResults', `result_${Date.now()}`);
    await setDoc(resultRef, {
      ...quizResult,
      answeredAt: serverTimestamp(),
    });
    return { success: true, message: 'Quiz result saved successfully' };
  } catch (error) {
    console.error('Error saving quiz result:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all quiz results for a user
 * @param {string} userId - User ID
 * @param {object} options - Filter options (topic, dateRange, etc.)
 */
export const getQuizResults = async (userId, options = {}) => {
  try {
    let queryRef = collection(db, 'users', userId, 'quizResults');

    // Apply filters if provided
    if (options.topic) {
      queryRef = query(queryRef, where('topic', '==', options.topic));
    }

    const snapshot = await getDocs(queryRef);
    const results = [];
    snapshot.forEach((doc) => {
      results.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    // Sort by date (newest first)
    results.sort((a, b) => {
      const timeA = a.answeredAt?.toDate?.() || new Date(0);
      const timeB = b.answeredAt?.toDate?.() || new Date(0);
      return timeB - timeA;
    });

    return { success: true, data: results };
  } catch (error) {
    console.error('Error retrieving quiz results:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get quiz statistics for a user
 * @param {string} userId - User ID
 */
export const getQuizStatistics = async (userId) => {
  try {
    const { success, data: results } = await getQuizResults(userId);
    if (!success) return { success: false, error: 'Failed to fetch results' };

    const stats = {
      totalQuestions: results.length,
      strongAnswers: 0,
      partialAnswers: 0,
      weakAnswers: 0,
      averageConfidence: 0,
      topicBreakdown: {},
    };

    let totalConfidence = 0;

    results.forEach((result) => {
      const rating = result.rating || 'unevaluated';
      stats[`${rating}Answers`] = (stats[`${rating}Answers`] || 0) + 1;
      totalConfidence += result.confidence || 0;

      // Topic breakdown
      const topic = result.topic || 'Uncategorized';
      if (!stats.topicBreakdown[topic]) {
        stats.topicBreakdown[topic] = { total: 0, strong: 0, partial: 0, weak: 0 };
      }
      stats.topicBreakdown[topic].total++;
      stats.topicBreakdown[topic][rating]++;
    });

    stats.averageConfidence =
      results.length > 0 ? Math.round(totalConfidence / results.length) : 0;

    return { success: true, data: stats };
  } catch (error) {
    console.error('Error calculating quiz statistics:', error);
    return { success: false, error: error.message };
  }
};

// ============= USER PROGRESS =============

/**
 * Save or update user progress
 * @param {string} userId - User ID
 * @param {object} progress - Progress data (topics, mastery levels, etc.)
 */
export const saveUserProgress = async (userId, progress) => {
  try {
    const progressRef = doc(db, 'users', userId, 'progress', 'current');
    await setDoc(
      progressRef,
      {
        ...progress,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { success: true, message: 'Progress saved successfully' };
  } catch (error) {
    console.error('Error saving progress:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get user progress
 * @param {string} userId - User ID
 */
export const getUserProgress = async (userId) => {
  try {
    const progressRef = doc(db, 'users', userId, 'progress', 'current');
    const snapshot = await getDoc(progressRef);
    if (snapshot.exists()) {
      return { success: true, data: snapshot.data() };
    } else {
      return { success: true, data: null };
    }
  } catch (error) {
    console.error('Error retrieving progress:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update topic mastery level
 * @param {string} userId - User ID
 * @param {string} topic - Topic name
 * @param {string} masteryLevel - 'strong' | 'partial' | 'weak' | 'unevaluated'
 * @param {number} confidence - Confidence percentage
 */
export const updateTopicMastery = async (userId, topic, masteryLevel, confidence) => {
  try {
    const progressRef = doc(db, 'users', userId, 'progress', 'current');
    await setDoc(
      progressRef,
      {
        topics: {
          [topic]: {
            masteryLevel,
            confidence,
            lastUpdated: serverTimestamp(),
          },
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { success: true, message: `Updated ${topic} mastery to ${masteryLevel}` };
  } catch (error) {
    console.error('Error updating mastery:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Add weak topic to tracking
 * @param {string} userId - User ID
 * @param {string} topic - Topic name
 * @param {string} rootCause - Root cause topic
 */
export const addWeakTopic = async (userId, topic, rootCause) => {
  try {
    const progressRef = doc(db, 'users', userId, 'progress', 'current');
    await setDoc(
      progressRef,
      {
        weakTopics: arrayUnion({
          topic,
          rootCause,
          identifiedAt: serverTimestamp(),
        }),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
    return { success: true, message: `Added ${topic} to weak topics` };
  } catch (error) {
    console.error('Error adding weak topic:', error);
    return { success: false, error: error.message };
  }
};

// ============= USER DATA BACKUPS =============

/**
 * Create a complete backup of user learning data
 * @param {string} userId - User ID
 */
export const createUserDataBackup = async (userId) => {
  try {
    const [graphs, results, progress, stats] = await Promise.all([
      getGraphData(userId),
      getQuizResults(userId),
      getUserProgress(userId),
      getQuizStatistics(userId),
    ]);

    const backup = {
      userId,
      graphs: graphs.data || [],
      quizResults: results.data || [],
      progress: progress.data || null,
      statistics: stats.data || null,
      backupAt: new Date().toISOString(),
    };

    const backupRef = doc(db, 'users', userId, 'backups', `backup_${Date.now()}`);
    await setDoc(backupRef, backup);

    return { success: true, data: backup, message: 'Backup created successfully' };
  } catch (error) {
    console.error('Error creating backup:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Export user data as JSON
 * @param {string} userId - User ID
 */
export const exportUserData = async (userId) => {
  try {
    const { success, data } = await createUserDataBackup(userId);
    if (!success) throw new Error('Failed to export data');

    // Create downloadable JSON
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `concept-graph-export-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return { success: true, message: 'Data exported successfully' };
  } catch (error) {
    console.error('Error exporting data:', error);
    return { success: false, error: error.message };
  }
};

const databaseService = {
  // Graph operations
  saveGraphData,
  getGraphData,
  getGraphById,
  // Quiz operations
  saveQuizResult,
  getQuizResults,
  getQuizStatistics,
  // Progress operations
  saveUserProgress,
  getUserProgress,
  updateTopicMastery,
  addWeakTopic,
  // Backup operations
  createUserDataBackup,
  exportUserData,
};
export default databaseService;
