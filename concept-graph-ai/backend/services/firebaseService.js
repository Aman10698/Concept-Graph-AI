const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || 
  path.join(__dirname, '../config/serviceAccountKey.json');

let db = null;

const initializeFirebase = () => {
  try {
    // Check if Firebase is already initialized
    if (admin.apps.length === 0) {
      // Try to initialize with service account file
      if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
        const serviceAccount = JSON.parse(
          process.env.FIREBASE_SERVICE_ACCOUNT_KEY
        );
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      }
    }
    
    db = admin.firestore();
    console.log('✅ Firebase initialized successfully');
    return db;
  } catch (error) {
    console.warn('⚠️  Firebase initialization warning:', error.message);
    console.log('💡 Using local storage fallback');
    return null;
  }
};

// Initialize on module load
const getFirestore = () => {
  if (!db) {
    return initializeFirebase();
  }
  return db;
};

// Store graph data
const saveGraphData = async (userId, graphData) => {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.log('⚠️  Firestore not available, using local storage');
      return { success: true, id: Date.now().toString() };
    }

    const graphRef = firestore
      .collection('users')
      .doc(userId)
      .collection('graphs')
      .doc();

    const graphPayload = {
      ...graphData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await graphRef.set(graphPayload);
    console.log(`✅ Graph saved: ${graphRef.id}`);
    
    return {
      success: true,
      id: graphRef.id,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error saving graph:', error);
    throw error;
  }
};

// Store quiz results
const saveQuizResult = async (userId, quizResult) => {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.log('⚠️  Firestore not available, using local storage');
      return { success: true, id: Date.now().toString() };
    }

    const resultRef = firestore
      .collection('users')
      .doc(userId)
      .collection('quizResults')
      .doc();

    const resultPayload = {
      ...quizResult,
      answeredAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await resultRef.set(resultPayload);
    console.log(`✅ Quiz result saved: ${resultRef.id}`);
    
    return {
      success: true,
      id: resultRef.id,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error saving quiz result:', error);
    throw error;
  }
};

// Update user progress
const updateUserProgress = async (userId, progressData) => {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.log('⚠️  Firestore not available, using local storage');
      return { success: true };
    }

    const progressRef = firestore
      .collection('users')
      .doc(userId)
      .collection('progress')
      .doc('current');

    // Use merge to preserve existing data
    await progressRef.set(
      {
        ...progressData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`✅ User progress updated for: ${userId}`);
    
    return {
      success: true,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('❌ Error updating progress:', error);
    throw error;
  }
};

// Get user progress
const getUserProgress = async (userId) => {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.log('⚠️  Firestore not available');
      return { topics: {}, weakTopics: [] };
    }

    const progressRef = firestore
      .collection('users')
      .doc(userId)
      .collection('progress')
      .doc('current');

    const doc = await progressRef.get();
    
    if (doc.exists) {
      return doc.data();
    }
    
    return { topics: {}, weakTopics: [] };
  } catch (error) {
    console.error('❌ Error getting progress:', error);
    return { topics: {}, weakTopics: [] };
  }
};

// Get user graphs
const getUserGraphs = async (userId) => {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.log('⚠️  Firestore not available');
      return [];
    }

    const snapshot = await firestore
      .collection('users')
      .doc(userId)
      .collection('graphs')
      .orderBy('createdAt', 'desc')
      .get();

    const graphs = [];
    snapshot.forEach(doc => {
      graphs.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return graphs;
  } catch (error) {
    console.error('❌ Error getting graphs:', error);
    return [];
  }
};

// Get user quiz results
const getUserQuizResults = async (userId, topic = null) => {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.log('⚠️  Firestore not available');
      return [];
    }

    let query = firestore
      .collection('users')
      .doc(userId)
      .collection('quizResults');

    if (topic) {
      query = query.where('topic', '==', topic);
    }

    const snapshot = await query
      .orderBy('answeredAt', 'desc')
      .get();

    const results = [];
    snapshot.forEach(doc => {
      results.push({
        id: doc.id,
        ...doc.data(),
      });
    });

    return results;
  } catch (error) {
    console.error('❌ Error getting quiz results:', error);
    return [];
  }
};

// Calculate statistics
const getQuizStatistics = async (userId) => {
  try {
    const firestore = getFirestore();
    if (!firestore) {
      console.log('⚠️  Firestore not available');
      return {
        totalQuestions: 0,
        strongAnswers: 0,
        partialAnswers: 0,
        weakAnswers: 0,
        averageConfidence: 0,
      };
    }

    const results = await getUserQuizResults(userId);

    if (results.length === 0) {
      return {
        totalQuestions: 0,
        strongAnswers: 0,
        partialAnswers: 0,
        weakAnswers: 0,
        averageConfidence: 0,
        topicBreakdown: {},
      };
    }

    const stats = {
      totalQuestions: results.length,
      strongAnswers: 0,
      partialAnswers: 0,
      weakAnswers: 0,
      averageConfidence: 0,
      topicBreakdown: {},
    };

    let totalConfidence = 0;

    results.forEach(result => {
      // Count by rating
      if (result.rating === 'strong') stats.strongAnswers++;
      else if (result.rating === 'partial') stats.partialAnswers++;
      else if (result.rating === 'weak') stats.weakAnswers++;

      // Sum confidence
      totalConfidence += result.confidence || 0;

      // Topic breakdown
      const topic = result.topic.toLowerCase();
      if (!stats.topicBreakdown[topic]) {
        stats.topicBreakdown[topic] = {
          total: 0,
          strong: 0,
          partial: 0,
          weak: 0,
        };
      }

      stats.topicBreakdown[topic].total++;
      if (result.rating === 'strong') stats.topicBreakdown[topic].strong++;
      else if (result.rating === 'partial') stats.topicBreakdown[topic].partial++;
      else if (result.rating === 'weak') stats.topicBreakdown[topic].weak++;
    });

    stats.averageConfidence = Math.round(totalConfidence / results.length);

    return stats;
  } catch (error) {
    console.error('❌ Error calculating statistics:', error);
    return {
      totalQuestions: 0,
      strongAnswers: 0,
      partialAnswers: 0,
      weakAnswers: 0,
      averageConfidence: 0,
    };
  }
};

module.exports = {
  initializeFirebase,
  getFirestore,
  saveGraphData,
  saveQuizResult,
  updateUserProgress,
  getUserProgress,
  getUserGraphs,
  getUserQuizResults,
  getQuizStatistics,
};
