const express  = require('express');
const router   = express.Router();
const Progress = require('../models/Progress');

/**
 * GET /api/progress/:userId
 * Load all saved session data for a user from MongoDB.
 */
router.get('/progress/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    const doc = await Progress.findOne({ userId }).lean();
    if (!doc) {
      return res.json({ success: true, data: null, message: 'No progress found' });
    }

    return res.json({
      success: true,
      data: {
        topicsData:      doc.topicsData      || null,
        questionsData:   doc.questionsData   || null,
        evaluationData:  doc.evaluationData  || {},
        dependencyData:  doc.dependencyData  || null,
        updatedAt:       doc.updatedAt,
      },
    });
  } catch (err) {
    console.error('❌ GET /progress error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/progress/:userId
 * Upsert session data for a user into MongoDB.
 * Body: { topicsData?, questionsData?, evaluationData?, dependencyData? }
 */
router.post('/progress/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ success: false, message: 'userId required' });

    const { topicsData, questionsData, evaluationData, dependencyData } = req.body;

    // Only update fields that were actually sent in the request
    const $set = { updatedAt: new Date() };
    if (topicsData     !== undefined) $set.topicsData     = topicsData;
    if (questionsData  !== undefined) $set.questionsData  = questionsData;
    if (evaluationData !== undefined) $set.evaluationData = evaluationData;
    if (dependencyData !== undefined) $set.dependencyData = dependencyData;

    const doc = await Progress.findOneAndUpdate(
      { userId },
      { $set },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`✅ Progress saved for user: ${userId}`);
    return res.json({ success: true, updatedAt: doc.updatedAt });
  } catch (err) {
    console.error('❌ POST /progress error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/progress/:userId/evaluation
 * Merge (not replace) evaluation data — preserves history across retakes.
 * Body: { evaluationData: { topicName: { rating, score, ... } } }
 */
router.patch('/progress/:userId/evaluation', async (req, res) => {
  try {
    const { userId } = req.params;
    const { evaluationData } = req.body;
    if (!userId || !evaluationData) {
      return res.status(400).json({ success: false, message: 'userId and evaluationData required' });
    }

    // Build merge update: set each key inside evaluationData individually
    const $set = { updatedAt: new Date() };
    Object.entries(evaluationData).forEach(([topic, data]) => {
      $set[`evaluationData.${topic}`] = data;
    });

    await Progress.findOneAndUpdate(
      { userId },
      { $set },
      { upsert: true, returnDocument: 'after' }
    );

    console.log(`✅ Evaluation merged for user: ${userId}`);
    return res.json({ success: true });
  } catch (err) {
    console.error('❌ PATCH /progress/evaluation error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
