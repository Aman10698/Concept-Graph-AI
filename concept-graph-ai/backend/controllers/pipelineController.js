/**
 * Pipeline Controller
 * 
 * Orchestrates the complete workflow:
 * Upload → Extract → Topics → Graph → Quiz → Evaluate → Update
 */

const fs = require('fs');
const path = require('path');
const { processingWorkflow, quizWorkflow } = require('../services/workflowService');
const mongoService = require('../services/mongoService');

/**
 * ENDPOINT 1: Process Complete Document
 * POST /api/pipeline/process-document
 * 
 * Flow:
 * 1. Upload file
 * 2. Extract text
 * 3. Extract topics
 * 4. Analyze dependencies
 * 5. Create graph
 * 6. Save to database
 */
const processDocument = async (req, res) => {
  const filePath = req.file?.path;
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    console.log(`\n📋 Processing document for user: ${userId}`);
    console.log(`📁 File: ${req.file.originalname}`);

    // Run the complete processing workflow
    const result = await processingWorkflow.processDocument(
      req.file.path,
      req.file.mimetype,
      userId
    );

    // ★ Delete temp file — text is already saved to MongoDB by the workflow
    try { fs.unlinkSync(req.file.path); } catch (_) {}

    // Do NOT return the full text in the response (can be 100KB+)
    const { text: _text, ...dataWithoutText } = result.data;

    res.status(200).json({
      success: true,
      message: 'Document processed successfully',
      data: dataWithoutText,
      summary: result.summary,
    });
  } catch (error) {
    if (filePath) { try { fs.unlinkSync(filePath); } catch (_) {} }
    console.error('❌ Pipeline error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing document',
      error: error.message,
    });
  }
};

/**
 * ENDPOINT 2: Generate Quiz from Topics
 * POST /api/pipeline/generate-quiz
 * 
 * Flow:
 * 1. Get topics from user's graphs
 * 2. Generate questions
 * 3. Return quiz interface
 */
const generateQuiz = async (req, res) => {
  try {
    const { userId, graphId, topicFilter } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    console.log(`\n📝 Generating quiz for user: ${userId}`);

    // Get user's graphs or use specific one
    let topics = [];
    if (graphId) {
      const graphs = await mongoService.getUserGraphs(userId);
      const graph = graphs.find(g => g._id?.toString() === graphId || g.id === graphId);
      if (graph) topics = graph.topics || [];
    } else if (topicFilter) {
      topics = Array.isArray(topicFilter) ? topicFilter : [topicFilter];
    } else {
      // Get topics from most recent graph
      const graphs = await mongoService.getUserGraphs(userId);
      if (graphs.length > 0) topics = graphs[0].topics || [];
    }

    if (topics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No topics found. Please process a document first.',
      });
    }

    // Generate questions
    const questions = await processingWorkflow.extractTopics(topics);

    console.log(`✅ Generated quiz with ${topics.length} topics`);

    res.status(200).json({
      success: true,
      message: 'Quiz generated successfully',
      data: {
        topics,
        questionCount: topics.length,
        sessionId: Date.now().toString(),
      },
    });
  } catch (error) {
    console.error('❌ Quiz generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating quiz',
      error: error.message,
    });
  }
};

/**
 * ENDPOINT 3: Submit Quiz Answer
 * POST /api/pipeline/submit-answer
 * 
 * Flow:
 * 1. Evaluate answer
 * 2. Analyze weaknesses
 * 3. Update progress
 * 4. Save result
 * 5. Return feedback
 */
const submitAnswer = async (req, res) => {
  try {
    const { userId, question, userAnswer, topic, confidence } = req.body;

    if (!userId || !question || !userAnswer || !topic) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userId, question, userAnswer, topic',
      });
    }

    console.log(`\n✍️  Processing answer for user: ${userId}`);
    console.log(`📚 Topic: ${topic}`);

    // Run the quiz workflow
    const result = await quizWorkflow.processQuizAnswer(userId, {
      question,
      userAnswer,
      topic,
      confidence: confidence || 50,
    });

    res.status(200).json({
      success: true,
      message: 'Answer processed successfully',
      data: {
        evaluation: result.data.evaluation,
        feedback: result.data.evaluation.feedback,
        rating: result.data.evaluation.rating,
        progress: result.data.progress,
      },
      summary: result.summary,
    });
  } catch (error) {
    console.error('❌ Answer submission error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing answer',
      error: error.message,
    });
  }
};

/**
 * ENDPOINT 4: Get Dashboard Statistics
 * GET /api/pipeline/statistics/:userId
 * 
 * Returns:
 * - Total questions answered
 * - Accuracy by topic
 * - Weak topics
 * - Progress trends
 */
const getStatistics = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    console.log(`\n📊 Getting statistics for user: ${userId}`);

    // Get statistics
    const stats    = await mongoService.getQuizStatistics(userId);
    const progress = await mongoService.getUserProgress(userId);
    const graphs   = await mongoService.getUserGraphs(userId);

    console.log(`✅ Statistics retrieved successfully`);

    res.status(200).json({
      success: true,
      message: 'Statistics retrieved successfully',
      data: {
        quizStats: stats,
        progress,
        graphs: graphs.map(g => ({
          id: g._id?.toString() || g.id,
          topics: (g.topics || []).length,
          relationships: (g.relationships || []).length,
          createdAt: g.createdAt,
        })),
      },
    });
  } catch (error) {
    console.error('❌ Statistics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving statistics',
      error: error.message,
    });
  }
};

/**
 * ENDPOINT 5: Get User Learning Progress
 * GET /api/pipeline/progress/:userId
 * 
 * Returns:
 * - Topics mastered
 * - Topics in progress
 * - Weak topics
 * - Recommendations
 */
const getProgress = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    console.log(`\n📈 Getting progress for user: ${userId}`);

    // Get progress data
    const progress = await mongoService.getUserProgress(userId);
    const stats    = await mongoService.getQuizStatistics(userId);

    // Categorize topics
    const topicsSummary = {
      mastered: [],
      inProgress: [],
      weak: [],
    };

    Object.entries(progress.topics || {}).forEach(([topic, data]) => {
      const summary = {
        name: topic,
        masteryLevel: data.masteryLevel,
        confidence: data.confidence,
        attempts: data.attempts,
      };

      if (data.masteryLevel === 'advanced') {
        topicsSummary.mastered.push(summary);
      } else if (data.masteryLevel === 'intermediate') {
        topicsSummary.inProgress.push(summary);
      } else {
        topicsSummary.weak.push(summary);
      }
    });

    console.log(`✅ Progress retrieved successfully`);

    res.status(200).json({
      success: true,
      message: 'Progress retrieved successfully',
      data: {
        overall: {
          totalTopics: Object.keys(progress.topics || {}).length,
          masteredCount: topicsSummary.mastered.length,
          inProgressCount: topicsSummary.inProgress.length,
          weakCount: topicsSummary.weak.length,
        },
        byCategory: topicsSummary,
        quizStats: {
          totalAnswered: stats.totalQuestions,
          accuracy: ((stats.strongAnswers / stats.totalQuestions) * 100 || 0).toFixed(1),
          averageConfidence: stats.averageConfidence,
        },
        weakTopics: progress.weakTopics || [],
      },
    });
  } catch (error) {
    console.error('❌ Progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving progress',
      error: error.message,
    });
  }
};

/**
 * ENDPOINT 6: Get Learning Recommendations
 * GET /api/pipeline/recommendations/:userId
 * 
 * Returns:
 * - Topics to focus on
 * - Topics with highest weak rate
 * - Suggested next topics based on dependencies
 */
const getRecommendations = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required',
      });
    }

    console.log(`\n💡 Getting recommendations for user: ${userId}`);

    // Get data
    const progress = await mongoService.getUserProgress(userId);
    const stats    = await mongoService.getQuizStatistics(userId);
    const graphs   = await mongoService.getUserGraphs(userId);

    // Generate recommendations
    const recommendations = {
      focusTopics: [],
      reviewTopics: [],
      nextTopics: [],
      insights: [],
    };

    // Topics to focus on (weak or not started)
    Object.entries(progress.topics || {}).forEach(([topic, data]) => {
      if (data.masteryLevel === 'beginner' || data.masteryLevel === 'intermediate') {
        recommendations.focusTopics.push({
          topic,
          reason: `Current level: ${data.masteryLevel}`,
          confidence: data.confidence,
        });
      }
    });

    // Topics to review (weak score)
    Object.entries(stats.topicBreakdown || {}).forEach(([topic, breakdown]) => {
      const weakRate = (breakdown.weak / breakdown.total) * 100;
      if (weakRate > 30) {
        recommendations.reviewTopics.push({
          topic: topic.charAt(0).toUpperCase() + topic.slice(1),
          weakRate: weakRate.toFixed(1),
          attempts: breakdown.total,
        });
      }
    });

    // Add insights
    if (stats.totalQuestions === 0) {
      recommendations.insights.push('Start by processing a document to extract topics!');
    }

    if (recommendations.focusTopics.length > 0) {
      recommendations.insights.push(
        `Focus on ${recommendations.focusTopics.length} topics to improve your mastery.`
      );
    }

    if (stats.averageConfidence < 60) {
      recommendations.insights.push('Your confidence is below 60%. Practice more to build confidence.');
    }

    console.log(`✅ Recommendations generated successfully`);

    res.status(200).json({
      success: true,
      message: 'Recommendations generated successfully',
      data: recommendations,
    });
  } catch (error) {
    console.error('❌ Recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating recommendations',
      error: error.message,
    });
  }
};

module.exports = {
  processDocument,
  generateQuiz,
  submitAnswer,
  getStatistics,
  getProgress,
  getRecommendations,
};
