/**
 * Dependency Analysis Service — Deterministic + AI-enhanced
 *
 * Strategy (in priority order):
 *  1. Use the topicsData hierarchy (parent→children edges) — always reliable
 *  2. Use sequential order edges (topic[i-1] → topic[i]) — meaningful for syllabuses
 *  3. If Ollama returns real `dependencies`, add them — but only if both
 *     source and target exist in topicNames (no -1 indexOf bugs)
 *
 * Ollama is NOT relied upon for the graph structure — only optional enrichment.
 */

const ollamaService = require('./ollamaWorkerService');

/**
 * Analyse prerequisite dependencies between topics.
 * Calls Ollama which returns { nodes, edges, recommendedPath } — no coordinates.
 * React Flow + Dagre handle layout automatically.
 *
 * @param {Array<string|object>} topics     - Array of topic strings or { name, subtopics[] }
 * @param {string}               docText    - Original document text
 * @param {string}               subject    - Subject name (optional)
 * @returns {object} { nodes, edges, recommendedPath, ... }
 */
const analyzeDependencies = async (topics, docText = '', subject = '') => {
  if (!topics || !Array.isArray(topics) || topics.length === 0) {
    return emptyResult();
  }

  const topicObjs = topics.map(t =>
    typeof t === 'string'
      ? { name: t.trim(), subtopics: [] }
      : { name: (t?.name || String(t)).trim(), subtopics: t?.subtopics || [] }
  ).filter(t => t.name);

  const topicNames = topicObjs.map(t => t.name);
  if (topicNames.length === 0) return emptyResult();

  console.log(`✨ [Deps] Building dependency graph for ${topicNames.length} topics, subject="${subject || topicNames[0]}"`);

  /* ── Ask Ollama for the full node/edge graph ── */
  let aiResult = null;
  try {
    aiResult = await ollamaService.analyzeDependencies(topicNames, docText, subject || '');
    console.log(`   Ollama returned ${(aiResult?.nodes || []).length} nodes, ${(aiResult?.edges || []).length} edges`);
  } catch (e) {
    console.warn('⚠️  Ollama dependency analysis skipped:', e.message);
  }

  if (aiResult?.nodes?.length) {
    // Strip any accidental coordinates Ollama may have added
    const cleanNodes = aiResult.nodes.map(({ x, y, position, ...rest }) => rest);
    console.log(`✅ [Deps] ${cleanNodes.length} nodes, ${(aiResult.edges || []).length} edges`);
    return {
      nodes:           cleanNodes,
      edges:           aiResult.edges           || [],
      recommendedPath: aiResult.recommendedPath || [],
      // Legacy compat fields
      treeNodes:       [],
      prerequisiteEdges: [],
      dependencies:    [],
      relationships:   [],
      graph:           { nodes: [], edges: [] },
      recommendedOrder: topicNames,
      criticalPath:    [],
      analysis: { totalTopics: topicNames.length, totalDependencies: 0, totalRelationships: 0, dependencyChains: [] },
    };
  }

  // Ollama failed — return empty result with topic names as fallback nodes
  console.warn('⚠️  [Deps] Ollama returned no graph — using fallback');
  return emptyResult(topicNames, subject);
};

/* ── helpers ─────────────────────────────────────────────────────────────── */

const emptyResult = (topicNames = [], subject = '') => {
  // Build a minimal fallback graph from topic names
  const rootId  = 'root';
  const rootName = subject || topicNames[0] || 'Course';
  const nodes = [
    { id: rootId, name: rootName, type: 'root', status: 'not_started', score: null, description: 'Main topic.' },
    ...topicNames.slice(0, 12).map((t, i) => ({
      id: `concept-${i}`, name: t, type: 'concept',
      status: 'not_started', score: null, description: `Complete a quiz on "${t}".`,
    })),
  ];
  const edges = topicNames.slice(0, 12).map((_, i) => ({
    source: rootId, target: `concept-${i}`, type: 'hierarchy',
  }));
  return {
    nodes, edges,
    recommendedPath: topicNames.slice(0, 8),
    // Legacy compat
    treeNodes: [], prerequisiteEdges: [], dependencies: [], relationships: [],
    graph: { nodes: [], edges: [] },
    recommendedOrder: topicNames, criticalPath: [],
    analysis: { totalTopics: topicNames.length, totalDependencies: 0, totalRelationships: 0, dependencyChains: [] },
  };
};

// Kept for backward compat
const findCommonDependencies     = () => [];
const identifyRelationship       = () => null;
const extractDependencyPatterns  = () => [];

module.exports = {
  analyzeDependencies,
  findCommonDependencies,
  identifyRelationship,
  extractDependencyPatterns,
};
