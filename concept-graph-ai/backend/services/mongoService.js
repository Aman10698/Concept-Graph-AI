const mongoose = require('mongoose');
const Graph      = require('../models/Graph');
const QuizResult = require('../models/QuizResult');
const Progress   = require('../models/Progress');

// ── Connection ────────────────────────────────────────────────
const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/conceptgraph';
  try {
    await mongoose.connect(uri);
    console.log(`✅ MongoDB connected: ${uri}`);
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

// ── Graph ─────────────────────────────────────────────────────
const saveGraphData = async (userId, graphData) => {
  try {
    const graph = await Graph.create({
      userId,
      topicsData:    graphData.topicsData,
      extractedText: graphData.extractedText,
      title:         graphData.title || 'Untitled Graph',
    });
    console.log(`✅ Graph saved: ${graph._id}`);
    return { success: true, id: graph._id.toString() };
  } catch (err) {
    console.error('❌ Error saving graph:', err.message);
    throw err;
  }
};

const getUserGraphs = async (userId) => {
  try {
    return await Graph.find({ userId }).sort({ createdAt: -1 }).lean();
  } catch (err) {
    console.error('❌ Error getting graphs:', err.message);
    return [];
  }
};

// ── Quiz Results ──────────────────────────────────────────────
const saveQuizResult = async (userId, quizResult) => {
  try {
    const result = await QuizResult.create({ userId, ...quizResult });
    console.log(`✅ Quiz result saved: ${result._id}`);
    return { success: true, id: result._id.toString() };
  } catch (err) {
    console.error('❌ Error saving quiz result:', err.message);
    throw err;
  }
};

const getUserQuizResults = async (userId, topic = null) => {
  try {
    const query = { userId };
    if (topic) query.topic = topic;
    return await QuizResult.find(query).sort({ createdAt: -1 }).lean();
  } catch (err) {
    console.error('❌ Error getting quiz results:', err.message);
    return [];
  }
};

const getQuizStatistics = async (userId) => {
  try {
    const results = await getUserQuizResults(userId);
    if (!results.length) return { totalQuestions: 0, strongAnswers: 0, partialAnswers: 0, weakAnswers: 0, averageConfidence: 0 };

    let strong = 0, partial = 0, weak = 0, totalConf = 0;
    const topicBreakdown = {};

    results.forEach((r) => {
      if (r.rating === 'strong')  strong++;
      else if (r.rating === 'partial') partial++;
      else if (r.rating === 'weak')    weak++;
      totalConf += r.confidence || 0;

      const t = (r.topic || 'unknown').toLowerCase();
      if (!topicBreakdown[t]) topicBreakdown[t] = { total: 0, strong: 0, partial: 0, weak: 0 };
      topicBreakdown[t].total++;
      if (r.rating === 'strong')  topicBreakdown[t].strong++;
      else if (r.rating === 'partial') topicBreakdown[t].partial++;
      else if (r.rating === 'weak')    topicBreakdown[t].weak++;
    });

    return {
      totalQuestions:   results.length,
      strongAnswers:    strong,
      partialAnswers:   partial,
      weakAnswers:      weak,
      averageConfidence: Math.round(totalConf / results.length),
      topicBreakdown,
    };
  } catch (err) {
    console.error('❌ Error calculating statistics:', err.message);
    return { totalQuestions: 0, strongAnswers: 0, partialAnswers: 0, weakAnswers: 0, averageConfidence: 0 };
  }
};

// ── Progress (full session state for a user) ──────────────────
const updateUserProgress = async (userId, progressData) => {
  try {
    await Progress.findOneAndUpdate(
      { userId },
      { $set: { ...progressData, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    console.log(`✅ Progress updated for: ${userId}`);
    return { success: true };
  } catch (err) {
    console.error('❌ Error updating progress:', err.message);
    throw err;
  }
};

const getUserProgress = async (userId) => {
  try {
    const doc = await Progress.findOne({ userId }).lean();
    return doc || { topics: {}, weakTopics: [] };
  } catch (err) {
    console.error('❌ Error getting progress:', err.message);
    return { topics: {}, weakTopics: [] };
  }
};

module.exports = {
  connectDB,
  saveGraphData,
  getUserGraphs,
  saveQuizResult,
  getUserQuizResults,
  getQuizStatistics,
  updateUserProgress,
  getUserProgress,
};
