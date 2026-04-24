const {
  traceDependencyWeakness,
  analyzeWeaknessPatterns,
} = require('../services/weaknessAnalysisService');
const ollamaService = require('../services/ollamaService');

/**
 * POST /api/trace-weakness
 * Ollama-powered root-cause analysis — traces why a topic is weak
 * and identifies prerequisite gaps with a concrete study plan.
 */
const traceWeaknessController = async (req, res) => {
  try {
    const { weakTopic, allTopics, evaluationData } = req.body;

    if (!weakTopic || typeof weakTopic !== 'string') {
      return res.status(400).json({ success: false, message: 'Weak topic is required' });
    }
    if (!allTopics || !Array.isArray(allTopics) || allTopics.length < 1) {
      return res.status(400).json({ success: false, message: 'Topics array is required' });
    }

    let result = null;

    // ── Try Ollama (primary) ─────────────────────────────────────
    try {
      const isRunning = await ollamaService.testOllamaConnection();
      if (isRunning) {
        console.log(`🦙 Ollama analysing weakness for "${weakTopic}"...`);
        const aiAnalysis = await ollamaService.analyzeWeakness(
          weakTopic,
          allTopics,
          evaluationData || {}
        );

        if (aiAnalysis && aiAnalysis.prerequisites) {
          // Also run rule-based for path data, merge with AI insights
          const ruleResult = traceDependencyWeakness(weakTopic, allTopics, evaluationData || {});
          result = {
            ...ruleResult,
            // Ollama-enhanced fields
            rootCause:            aiAnalysis.rootCause            || ruleResult.weakestConcept,
            prerequisites:        aiAnalysis.prerequisites        || [],
            studyPlan:            aiAnalysis.studyPlan            || [],
            estimatedRevisionTime: aiAnalysis.estimatedRevisionTime || 'Unknown',
            relatedWeakAreas:     aiAnalysis.relatedWeakAreas     || [],
            aiAnalysis:           true,
            source:               'ollama',
          };
          console.log(`✅ Ollama identified root cause: "${aiAnalysis.rootCause}"`);
        }
      }
    } catch (ollamaErr) {
      console.warn('⚠️  Ollama unavailable for weakness analysis:', ollamaErr.message);
    }

    // ── Fallback: rule-based ──────────────────────────────────────
    if (!result) {
      console.log('📊 Using rule-based weakness analysis...');
      result = traceDependencyWeakness(weakTopic, allTopics, evaluationData || {});
      result.source = 'rule-based';
    }

    res.status(200).json({
      success: true,
      message: 'Weakness traced successfully',
      data: result,
    });
  } catch (error) {
    console.error('Weakness trace error:', error);
    res.status(500).json({ success: false, message: 'Error tracing weakness', error: error.message });
  }
};

/**
 * POST /api/analyze-weakness-patterns
 */
const analyzeWeaknessPattersController = async (req, res) => {
  try {
    const { weakTopics, allTopics, evaluationData } = req.body;

    if (!weakTopics || !Array.isArray(weakTopics)) {
      return res.status(400).json({ success: false, message: 'Weak topics array is required' });
    }
    if (!allTopics || !Array.isArray(allTopics)) {
      return res.status(400).json({ success: false, message: 'All topics array is required' });
    }

    const result = analyzeWeaknessPatterns(weakTopics, allTopics, evaluationData || {});

    res.status(200).json({
      success: true,
      message: 'Weakness patterns analyzed successfully',
      data: result,
    });
  } catch (error) {
    console.error('Weakness pattern analysis error:', error);
    res.status(500).json({ success: false, message: 'Error analyzing weakness patterns', error: error.message });
  }
};

module.exports = {
  traceWeaknessController,
  analyzeWeaknessPattersController,
};
