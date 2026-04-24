/**
 * Dependency Analysis Service — 100% Ollama-powered
 * Replaces the hardcoded CS/Math dictionary with AI-driven prerequisite mapping.
 */

const ollamaService = require('./ollamaService');

/**
 * Analyse prerequisite dependencies between topics using Ollama.
 *
 * @param {Array<string|object>} topics - Array of topic strings or { name } objects
 * @param {string} docText              - Original document text (gives Ollama real context)
 * @returns {object} { dependencies, relationships, graph, analysis }
 */
const analyzeDependencies = async (topics, docText = '', subject = '') => {
  if (!topics || !Array.isArray(topics) || topics.length === 0) {
    return emptyResult();
  }

  // Normalise: accept both string arrays and topic objects
  const topicNames = topics
    .map(t => (typeof t === 'string' ? t.trim() : (t?.name || String(t)).trim()))
    .filter(Boolean);

  if (topicNames.length === 0) return emptyResult();

  console.log('🤖 [Ollama] Analysing topic dependencies...');

  const aiResult = await ollamaService.analyzeDependencies(topicNames, docText, subject || '');

  if (!aiResult || (!Array.isArray(aiResult.dependencies) && !Array.isArray(aiResult.treeNodes))) {
    console.warn('⚠️  Ollama dependency analysis failed — returning empty graph');
    return emptyResult(topicNames);
  }

  // Map Ollama output → internal graph structure
  const relationships = (aiResult.dependencies || []).map(dep => ({
    source:      dep.from   || dep.source || '',
    target:      dep.to     || dep.target || '',
    type:        dep.strength === 'required' ? 'requires' : 'helpful',
    confidence:  dep.strength === 'required' ? 0.95 : 0.7,
    description: dep.reason || `${dep.from} → ${dep.to}`,
  })).filter(r => r.source && r.target);

  const dependencies = relationships.map(r => ({
    prerequisite: r.source,
    topic:        r.target,
    confidence:   r.confidence,
    description:  r.description,
  }));

  // Build graph nodes & edges
  const graphNodes = topicNames.map((topic, idx) => ({
    id:    `topic-${idx}`,
    label: topic,
    type:  'topic',
    difficulty: (aiResult.topicDifficulty || []).find(d => d.topic === topic)?.difficulty || 1,
    estimatedHours: (aiResult.topicDifficulty || []).find(d => d.topic === topic)?.estimatedHours || null,
  }));

  const graphEdges = relationships.map((rel, idx) => ({
    id:         `edge-${idx}`,
    source:     `topic-${topicNames.indexOf(rel.source)}`,
    target:     `topic-${topicNames.indexOf(rel.target)}`,
    type:       rel.type,
    confidence: rel.confidence,
  }));

  console.log(`✅ [Ollama] Found ${relationships.length} dependency relationships`);

  return {
    treeNodes:    aiResult.treeNodes    || [],   // hierarchical tree for RootCauseGraph
    dependencies,
    relationships,
    graph: { nodes: graphNodes, edges: graphEdges },
    recommendedOrder: aiResult.recommendedOrder || [],
    criticalPath:     aiResult.criticalPath     || [],
    analysis: {
      totalTopics:         topicNames.length,
      totalDependencies:   dependencies.length,
      totalRelationships:  relationships.length,
      dependencyChains:    [],
    },
  };
};

/* ── helpers ─────────────────────────────────────────────────────────────── */

const emptyResult = (topicNames = []) => ({
  dependencies: [],
  relationships: [],
  graph: {
    nodes: topicNames.map((t, i) => ({ id: `topic-${i}`, label: t, type: 'topic' })),
    edges: [],
  },
  recommendedOrder: topicNames,
  criticalPath: [],
  analysis: { totalTopics: topicNames.length, totalDependencies: 0, totalRelationships: 0, dependencyChains: [] },
});

// Kept for backward compat with weaknessAnalysisService imports
const findCommonDependencies = () => [];
const identifyRelationship   = () => null;
const extractDependencyPatterns = () => [];

module.exports = {
  analyzeDependencies,
  findCommonDependencies,
  identifyRelationship,
  extractDependencyPatterns,
};
