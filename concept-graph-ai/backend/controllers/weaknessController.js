const {
  traceDependencyWeakness,
  analyzeWeaknessPatterns,
} = require('../services/weaknessAnalysisService');
const ollamaService = require('../services/ollamaService');

/**
 * POST /api/trace-weakness
 * Gemini-powered root-cause analysis — traces why a topic is weak
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

    // ── Try Gemini (primary) ──────────────────────────────────────────────────
    try {
      console.log(`✨ Gemini analysing weakness for "${weakTopic}"...`);
      const aiAnalysis = await ollamaService.analyzeWeakness(
        weakTopic,
        allTopics,
        evaluationData || {}
      );

      if (aiAnalysis && aiAnalysis.prerequisites) {
        // Also run rule-based for path data, merge with AI insights
        const ruleResult = await traceDependencyWeakness(weakTopic, allTopics, evaluationData || {});
        result = {
          ...ruleResult,
          rootCause:             aiAnalysis.rootCause             || ruleResult.weakestConcept,
          prerequisites:         aiAnalysis.prerequisites         || [],
          studyPlan:             aiAnalysis.studyPlan             || [],
          estimatedRevisionTime: aiAnalysis.estimatedRevisionTime || 'Unknown',
          relatedWeakAreas:      aiAnalysis.relatedWeakAreas      || [],
          aiAnalysis:            true,
          source:                'gemini',
        };
        console.log(`✅ Gemini identified root cause: "${aiAnalysis.rootCause}"`);
      }
    } catch (geminiErr) {
      console.warn('⚠️  Gemini unavailable for weakness analysis:', geminiErr.message);
    }

    // ── Fallback: rule-based ──────────────────────────────────────────────────
    if (!result) {
      console.log('📊 Using rule-based weakness analysis...');
      result = await traceDependencyWeakness(weakTopic, allTopics, evaluationData || {});
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

    const result = await analyzeWeaknessPatterns(weakTopics, allTopics, evaluationData || {});

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
