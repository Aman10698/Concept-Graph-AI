const dependencyAnalysisService = require('../services/dependencyAnalysisService');

/**
 * POST /api/analyze-dependencies
 * Generates a prerequisite dependency tree via Ollama.
 * Works for both single-topic (weak topic analysis) and full-course mode.
 */
const analyzeDependenciesController = async (req, res) => {
  try {
    const { topics, extractedText, subject } = req.body;

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ success: false, message: 'Topics array is required' });
    }

    console.log(`🔍 Dependency analysis: ${topics.length} topic(s), subject="${subject || topics[0]}"`);

    const result = await dependencyAnalysisService.analyzeDependencies(
      topics,
      extractedText || '',
      subject || (topics.length === 1 ? topics[0] : '')
    );

    res.status(200).json({
      success: true,
      message:  `Dependencies analysed (${topics.length} topic${topics.length > 1 ? 's' : ''})`,
      data:     result,
    });
  } catch (error) {
    console.error('Dependency analysis error:', error);
    res.status(500).json({ success: false, message: 'Error analyzing dependencies', error: error.message });
  }
};

module.exports = { analyzeDependenciesController };
