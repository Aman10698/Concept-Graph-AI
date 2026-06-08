/**
 * Weakness Analysis Service — Gemini AI-powered
 * Uses Google Gemini for root-cause weakness analysis.
 */

// ⚠️  Use ollamaWorkerService (spawns isolated subprocess) NOT ollamaService directly.
// Direct calls run the LLM in the main 2 GB server heap causing OOM crashes.
const ollamaService = require('./ollamaWorkerService');

/**
 * Trace weakness for a single topic using Gemini.
 *
 * @param {string} weakTopic      - The topic the student is struggling with
 * @param {Array<string>} allTopics      - All topics in the curriculum
 * @param {object} evaluationData - Map of { topicName: evaluationResult }
 * @returns {object} Rich weakness analysis from Gemini
 */
const traceDependencyWeakness = async (weakTopic, allTopics = [], evaluationData = {}) => {
  if (!weakTopic) {
    return {
      weakTopic,
      path: [],
      weakestConcept: null,
      recommendations: [],
      error: 'Invalid input — weakTopic is required',
    };
  }

  console.log(`✨ [Gemini] Analysing weakness for: "${weakTopic}"`);

  const result = await ollamaService.analyzeWeakness(weakTopic, allTopics, evaluationData);

  if (!result) {
    console.warn('⚠️  Gemini weakness analysis returned null — using fallback');
    return fallbackWeakness(weakTopic);
  }

  console.log(`✅ [Gemini] Root cause identified: "${result.rootCause}"`);

  // Normalise to the shape the rest of the app expects
  return {
    weakTopic:        result.weakTopic        || weakTopic,
    weakestConcept:   (result.prerequisites   || [])[0]?.concept || weakTopic,
    rootCause:        result.rootCause        || '',
    prerequisites:    result.prerequisites    || [],
    studyPlan:        result.studyPlan        || [],
    estimatedTime:    result.estimatedRevisionTime || '',
    relatedWeakAreas: result.relatedWeakAreas || [],
    path: (result.prerequisites || []).map((p, i) => ({
      level:         i,
      topic:         p.concept,
      weaknessLevel: p.priority === 'high' ? 'critical' : p.priority === 'medium' ? 'moderate' : 'minor',
      why:           p.why,
    })),
    recommendations: buildRecommendations(result),
    recommendedLearningPath: (result.studyPlan || []).map((step, i) => ({
      level: i, topic: step, weaknessScore: 0.5,
    })),
    summary: {
      totalTopicsInChain: (result.prerequisites || []).length,
      criticalWeaknesses: (result.prerequisites || []).filter(p => p.priority === 'high').length,
      moderateWeaknesses: (result.prerequisites || []).filter(p => p.priority === 'medium').length,
      actionable: true,
    },
  };
};

/**
 * Analyse weakness patterns across multiple weak topics.
 */
const analyzeWeaknessPatterns = async (weakTopics, allTopics = [], evaluationData = {}) => {
  if (!weakTopics || !Array.isArray(weakTopics) || weakTopics.length === 0) {
    return {
      weakTopics: [],
      commonWeaknessRoots: [],
      criticalGaps: [],
      analysis: {},
    };
  }

  // Sequential — spawning all workers at once via Promise.all would exhaust RAM.
  // Each worker needs up to 3 GB; firing N simultaneously means N×3 GB simultaneously.
  const traces = [];
  for (const topic of weakTopics) {
    traces.push(await traceDependencyWeakness(topic, allTopics, evaluationData));
  }

  // Find shared root causes
  const rootFreq = {};
  traces.forEach(trace => {
    if (trace.weakestConcept) {
      rootFreq[trace.weakestConcept] = (rootFreq[trace.weakestConcept] || 0) + 1;
    }
  });

  const commonWeaknessRoots = Object.entries(rootFreq)
    .sort((a, b) => b[1] - a[1])
    .map(([concept, count]) => ({
      concept,
      affectsTopics: count,
      impact: `Fixing "${concept}" could improve ${count} topic(s)`,
    }));

  return {
    weakTopics,
    traces,
    commonWeaknessRoots,
    analysis: {
      totalWeakTopics:      weakTopics.length,
      sharedWeaknessRoots:  commonWeaknessRoots.length,
      cascadingWeakness:    commonWeaknessRoots.length > 1,
      criticalConceptCount: commonWeaknessRoots.filter(r => r.affectsTopics > 1).length,
    },
  };
};

/* ── helpers ─────────────────────────────────────────────────────────────── */

const buildRecommendations = (result) => [
  {
    type: 'critical',
    message: result.rootCause || `Strengthen foundational understanding of "${result.weakTopic}".`,
    priority: 'high',
  },
  ...(result.studyPlan || []).map((step, i) => ({
    type:     i === 0 ? 'info' : 'suggestion',
    message:  step,
    priority: i === 0 ? 'high' : 'medium',
    action:   'follow_sequence',
  })),
  {
    type:    'info',
    message: result.estimatedRevisionTime
      ? `Estimated revision time: ${result.estimatedRevisionTime}`
      : 'Work through prerequisites before tackling the main topic.',
    priority: 'low',
  },
];

const fallbackWeakness = (weakTopic) => ({
  weakTopic,
  weakestConcept: weakTopic,
  rootCause: `The student needs to review the fundamentals of "${weakTopic}".`,
  prerequisites: [],
  studyPlan: [
    `Step 1: Review the definition and core principles of "${weakTopic}".`,
    `Step 2: Work through practice examples.`,
    `Step 3: Test your understanding before moving on.`,
  ],
  estimatedTime: '1–2 hours',
  relatedWeakAreas: [],
  path: [],
  recommendations: [],
  recommendedLearningPath: [],
  summary: { totalTopicsInChain: 0, criticalWeaknesses: 0, moderateWeaknesses: 0, actionable: true },
});

const buildLearningPath = (sortedPath) => sortedPath || [];

// Kept for the old weaknessAnalysisService API shape
const analyzeWeakness = async (evaluationData) => {
  const weakTopic = evaluationData?.topic || 'Unknown topic';
  return traceDependencyWeakness(weakTopic, [], {});
};

module.exports = {
  traceDependencyWeakness,
  analyzeWeaknessPatterns,
  analyzeWeakness,
  buildLearningPath,
};
