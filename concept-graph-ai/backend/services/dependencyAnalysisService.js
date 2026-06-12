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

  const topicNames = topics.map(t =>
    typeof t === 'string'
      ? t.trim()
      : (t?.name || String(t)).trim()
  ).filter(Boolean);

  if (topicNames.length === 0) return emptyResult();

  console.log(`✨ [Deps] Building Multi-Step dependency graph for ${topicNames.length} topics, subject="${subject || topicNames[0]}"`);

  try {
    // Step 1: Extract Atomic Concepts for all target topics
    const allConcepts = new Set(topicNames);
    const extractionPromises = topicNames.map(async t => {
      const prereqs = await ollamaService.extractAtomicConcepts(t);
      return { topic: t, prereqs: prereqs || [] };
    });

    const extractionResults = await Promise.all(extractionPromises);
    
    const candidatePairs = [];
    
    for (const { topic, prereqs } of extractionResults) {
      for (const p of prereqs) {
        allConcepts.add(p);
        candidatePairs.push({ source: p, target: topic });
      }
    }

    // Also check pairs among the original topics sequentially
    for (let i = 0; i < topicNames.length - 1; i++) {
      candidatePairs.push({ source: topicNames[i], target: topicNames[i+1] });
    }

    const uniqueConcepts = Array.from(allConcepts);
    console.log(`   Step 1: Extracted ${uniqueConcepts.length} total concepts.`);

    // Step 2: Dependency Verification
    console.log(`   Step 2: Verifying ${candidatePairs.length} candidate edges...`);
    const verifiedEdges = [];
    
    const verificationPromises = candidatePairs.map(async pair => {
      const { source, target } = pair;
      if (source === target) return null;
      const result = await ollamaService.verifyDependencyEdge(source, target);
      if (result && result.required && result.confidence > 80) {
        return {
          id: `e-${source}-${target}`,
          source,
          target,
          type: 'prerequisite',
          confidence: result.confidence
        };
      }
      return null;
    });

    const verificationResults = await Promise.all(verificationPromises);
    const rawEdges = verificationResults.filter(Boolean);
    
    const edgeSet = new Set();
    for (const e of rawEdges) {
      if (!edgeSet.has(e.id)) {
        edgeSet.add(e.id);
        verifiedEdges.push(e);
      }
    }

    // Step 3: Graph Cleanup (Remove Cycles)
    console.log(`   Step 3: Graph Cleanup (Cycle removal)...`);
    const safeEdges = removeCycles(verifiedEdges);

    // Step 4: Assign Bloom's Level
    console.log(`   Step 4: Assigning Bloom's Taxonomy levels...`);
    const bloomPromises = uniqueConcepts.map(async concept => {
      const level = await ollamaService.assignBloomLevel(concept);
      return { concept, level };
    });
    const bloomResults = await Promise.all(bloomPromises);
    const bloomMap = {};
    for (const b of bloomResults) bloomMap[b.concept] = b.level;

    const cleanNodes = uniqueConcepts.map(name => ({
      id: name,
      name,
      type: 'concept',
      status: 'not_started',
      score: null,
      description: `Cognitive Level: ${bloomMap[name]}`,
      bloomLevel: bloomMap[name]
    }));

    console.log(`✅ [Deps] Completed Multi-Step Pipeline: ${cleanNodes.length} nodes, ${safeEdges.length} edges`);

    return {
      nodes: cleanNodes,
      edges: safeEdges,
      recommendedPath: [],
      treeNodes: [],
      prerequisiteEdges: [],
      dependencies: [],
      relationships: [],
      graph: { nodes: [], edges: [] },
      recommendedOrder: uniqueConcepts,
      criticalPath: [],
      analysis: { totalTopics: uniqueConcepts.length, totalDependencies: safeEdges.length, totalRelationships: 0, dependencyChains: [] },
    };

  } catch (err) {
    console.warn('⚠️  Ollama multi-step dependency analysis failed:', err.message);
    return emptyResult(topicNames, subject);
  }
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

const removeCycles = (edges) => {
  edges.sort((a, b) => b.confidence - a.confidence);
  const safeAdj = {};
  const safeEdges = [];

  for (const e of edges) {
    if (!safeAdj[e.source]) safeAdj[e.source] = [];
    if (hasPath(safeAdj, e.target, e.source)) {
      console.log(`   Dropped cycle-creating edge: ${e.source} -> ${e.target} (conf: ${e.confidence})`);
      continue;
    }
    safeAdj[e.source].push(e.target);
    safeEdges.push(e);
  }
  return safeEdges;
};

const hasPath = (adj, start, end) => {
  if (start === end) return true;
  const visited = new Set();
  const queue = [start];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === end) return true;
    if (!visited.has(cur)) {
      visited.add(cur);
      for (const neighbor of (adj[cur] || [])) {
        queue.push(neighbor);
      }
    }
  }
  return false;
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
