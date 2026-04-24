const express = require('express');
const ollamaService = require('../services/ollamaService');

const router = express.Router();

/**
 * POST /api/learning-path
 * Generate a step-by-step recovery learning path for weak topics.
 *
 * Body: {
 *   weakTopics:    string[]   — topics the student is weak in
 *   allTopics:     string[]   — all topics in the session
 *   dependencies:  object[]   — [{ source, target, type }]
 *   extractedText: string     — original document text (optional)
 * }
 */
router.post('/learning-path', async (req, res) => {
  try {
    const { weakTopics, allTopics, dependencies = [], extractedText = '' } = req.body;

    if (!weakTopics || !Array.isArray(weakTopics) || weakTopics.length === 0) {
      return res.status(400).json({ success: false, message: 'weakTopics array is required' });
    }
    if (!allTopics || !Array.isArray(allTopics) || allTopics.length === 0) {
      return res.status(400).json({ success: false, message: 'allTopics array is required' });
    }

    const isRunning = await ollamaService.testOllamaConnection();
    if (!isRunning) {
      // Fallback: build simple paths from dependency data without Ollama
      const paths = weakTopics.map(weakTopic => {
        const prereqs = dependencies
          .filter(r => r.target === weakTopic)
          .map(r => r.source);
        const steps = [
          ...prereqs.map((p, i) => ({
            order: i + 1, topic: p, action: 'Revise',
            reason: `"${p}" is a prerequisite for "${weakTopic}"`,
          })),
          { order: prereqs.length + 1, topic: weakTopic, action: 'Practice',
            reason: `Now practice "${weakTopic}" with your refreshed knowledge` },
        ];
        return {
          weakTopic,
          summary: `Revise ${prereqs.length} prerequisite(s) before practising ${weakTopic}.`,
          estimatedTime: `${steps.length + 1} hours`,
          steps,
        };
      });
      return res.json({ success: true, data: { paths }, source: 'fallback' });
    }

    console.log(`🦙 Generating learning paths for: ${weakTopics.join(', ')}`);
    const paths = await ollamaService.generateLearningPath(
      weakTopics,
      allTopics,
      dependencies,
      extractedText
    );

    res.json({
      success: true,
      data: { paths },
      source: 'ollama',
    });
  } catch (err) {
    console.error('Learning path error:', err.message);
    res.status(500).json({ success: false, message: 'Failed to generate learning path', error: err.message });
  }
});

module.exports = router;
