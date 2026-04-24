/**
 * Graph conversion utilities
 * Converts topic data into graph structures with nodes and edges
 */

const generateUniqueId = (prefix = 'node') => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Convert topics data to graph structure
 * @param {Object} topicsData - Topics data from API
 * @returns {Object} Graph with nodes and edges
 */
const topicsToGraph = (topicsData, subject = '') => {
  if (!topicsData || !Array.isArray(topicsData)) {
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];
  const nodeMap    = new Map();
  const seenLabels = new Set();

  const topicNames = topicsData.map(t => (typeof t === 'string' ? t : t.name || 'Topic'));

  // Use the passed subject if available; never fall back to topics[0] to avoid duplication
  const rootLabel = (subject && subject.trim()) ? subject.trim()
    : topicNames.length === 1 ? topicNames[0]
    : 'Concept Map';

  // ── Helper: normalise a subtopic to a string ─────────────────
  const normalise = (s) => {
    if (typeof s === 'string') return s.trim();
    if (s && typeof s === 'object') return (s.name || s.title || JSON.stringify(s)).trim();
    return String(s).trim();
  };

  // ── Root node ─────────────────────────────────────────────────
  const rootId = 'root-topic';
  const rootNode = {
    id: rootId,
    label: rootLabel,
    type: 'root',
    parent: null,
    data: { name: rootLabel, isRoot: true, level: 0 },
  };
  nodes.push(rootNode);
  nodeMap.set(rootId, rootNode);
  seenLabels.add(rootLabel.toLowerCase());

  // ── Topic + subtopic nodes ─────────────────────────────────────
  topicsData.forEach((topic, topicIndex) => {
    const topicName = typeof topic === 'string' ? topic : (topic.name || `Topic ${topicIndex + 1}`);

    // Skip duplicate topic names
    if (seenLabels.has(topicName.toLowerCase())) return;
    seenLabels.add(topicName.toLowerCase());

    const topicId   = `topic-${topicIndex}`;
    const rawSubs   = Array.isArray(topic.subtopics) ? topic.subtopics : [];
    const subtopics = rawSubs
      .map(normalise)
      .filter(s => s.length > 0);

    const topicNode = {
      id: topicId,
      label: topicName,
      type: 'topic',
      parent: rootId,
      data: {
        name: topicName,
        level: 1,
        topicIndex,
        subtopicCount: subtopics.length,
        parentTopic: rootLabel,
      },
    };
    nodes.push(topicNode);
    nodeMap.set(topicId, topicNode);

    edges.push({
      id:     `edge-root-${topicId}`,
      source: rootId,
      target: topicId,
      type:   'parent-child',
      data:   { relationship: 'parent-child' },
    });

    // ── Subtopics (all of them, globally deduplicated) ──────────
    subtopics.forEach((sub, subIndex) => {
      // Skip if this label was already added anywhere in this graph
      if (seenLabels.has(sub.toLowerCase())) return;
      seenLabels.add(sub.toLowerCase());

      const subId   = `subtopic-${topicIndex}-${subIndex}`;
      const subNode = {
        id:     subId,
        label:  sub,
        type:   'subtopic',
        parent: topicId,
        data: {
          name: sub,
          level: 2,
          topicIndex,
          subIndex,
          parentTopic: topicName,
        },
      };
      nodes.push(subNode);
      nodeMap.set(subId, subNode);

      edges.push({
        id:     `edge-${topicId}-${subId}`,
        source: topicId,
        target: subId,
        type:   'parent-child',
        data:   { relationship: 'parent-child', parentNode: topicId },
      });
    });
  });

  return { nodes, edges, nodeMap };
};

/**
 * Get parent node
 * @param {String} nodeId - Node ID
 * @param {Map} nodeMap - Node map
 * @returns {Object} Parent node or null
 */
const getParentNode = (nodeId, nodeMap) => {
  const node = nodeMap.get(nodeId);
  if (!node || !node.parent) return null;
  return nodeMap.get(node.parent);
};

/**
 * Get child nodes
 * @param {String} nodeId - Parent node ID
 * @param {Array} nodes - All nodes
 * @returns {Array} Child nodes
 */
const getChildNodes = (nodeId, nodes) => {
  return nodes.filter((node) => node.parent === nodeId);
};

/**
 * Get full path from root to node
 * @param {String} nodeId - Node ID
 * @param {Map} nodeMap - Node map
 * @returns {Array} Path of nodes from root to target
 */
const getNodePath = (nodeId, nodeMap) => {
  const path = [];
  let currentId = nodeId;
  let maxIterations = 100; // Prevent infinite loops

  while (currentId && maxIterations--) {
    const node = nodeMap.get(currentId);
    if (!node) break;
    path.unshift(node);
    currentId = node.parent;
  }

  return path;
};

/**
 * Find nodes by name (search)
 * @param {String} searchTerm - Search term
 * @param {Array} nodes - All nodes
 * @returns {Array} Matching nodes
 */
const searchNodes = (searchTerm, nodes) => {
  const term = searchTerm.toLowerCase();
  return nodes.filter((node) => node.label.toLowerCase().includes(term));
};

/**
 * Get graph statistics
 * @param {Array} nodes - All nodes
 * @param {Array} edges - All edges
 * @returns {Object} Graph statistics
 */
const getGraphStats = (nodes, edges) => {
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    rootNodes: nodes.filter((n) => n.type === 'root').length,
    topicNodes: nodes.filter((n) => n.type === 'topic').length,
    subtopicNodes: nodes.filter((n) => n.type === 'subtopic').length,
    levels: Math.max(...nodes.map((n) => n.data?.level || 0)) + 1,
    avgSubtopicsPerTopic:
      nodes.length > 0
        ? nodes.filter((n) => n.type === 'subtopic').length /
          Math.max(nodes.filter((n) => n.type === 'topic').length, 1)
        : 0,
  };
};

/**
 * Export graph to JSON
 * @param {Object} graph - Graph object
 * @returns {String} JSON string
 */
const exportGraphToJSON = (graph) => {
  return JSON.stringify(
    {
      nodes: graph.nodes,
      edges: graph.edges,
      stats: getGraphStats(graph.nodes, graph.edges),
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
};

/**
 * Export graph to CSV
 * @param {Object} graph - Graph object
 * @returns {String} CSV string
 */
const exportGraphToCSV = (graph) => {
  let csv = 'id,label,type,parent,level\n';

  graph.nodes.forEach((node) => {
    const level = node.data?.level || 0;
    csv += `"${node.id}","${node.label}","${node.type}","${node.parent || ''}",${level}\n`;
  });

  csv += '\n# Edges\n';
  csv += 'source,target,type,relationship\n';

  graph.edges.forEach((edge) => {
    csv += `"${edge.source}","${edge.target}","${edge.type}","${edge.data?.relationship || ''}"\n`;
  });

  return csv;
};

module.exports = {
  topicsToGraph,
  getParentNode,
  getChildNodes,
  getNodePath,
  searchNodes,
  getGraphStats,
  exportGraphToJSON,
  exportGraphToCSV,
  generateUniqueId,
};
