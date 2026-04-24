/**
 * Backend graph conversion utilities
 * Converts topic data into graph structures
 */

const topicsToGraph = (topicsData) => {
  if (!topicsData || !Array.isArray(topicsData)) {
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];
  const nodeMap = new Map();

  // Create root node
  const rootId = 'root';
  const rootNode = {
    id: rootId,
    name: 'Concept Graph',
    type: 'root',
    level: 0,
    children: [],
  };
  nodes.push(rootNode);
  nodeMap.set(rootId, rootNode);

  // Create topic nodes
  topicsData.forEach((topic, topicIndex) => {
    const topicId = `topic_${topicIndex}`;
    const topicNode = {
      id: topicId,
      name: topic.name,
      type: 'topic',
      parent: rootId,
      level: 1,
      children: [],
    };

    nodes.push(topicNode);
    nodeMap.set(topicId, topicNode);
    rootNode.children.push(topicId);

    // Edge from root to topic
    edges.push({
      id: `edge_${rootId}_${topicId}`,
      source: rootId,
      target: topicId,
      type: 'parent-child',
      weight: 1,
    });

    // Create subtopic nodes
    if (topic.subtopics && Array.isArray(topic.subtopics)) {
      topic.subtopics.forEach((subtopic, subIndex) => {
        const subtopicId = `subtopic_${topicIndex}_${subIndex}`;
        const subtopicNode = {
          id: subtopicId,
          name: subtopic,
          type: 'subtopic',
          parent: topicId,
          level: 2,
          children: [],
        };

        nodes.push(subtopicNode);
        nodeMap.set(subtopicId, subtopicNode);
        topicNode.children.push(subtopicId);

        // Edge from topic to subtopic
        edges.push({
          id: `edge_${topicId}_${subtopicId}`,
          source: topicId,
          target: subtopicId,
          type: 'parent-child',
          weight: 1,
        });
      });
    }
  });

  return {
    nodes,
    edges,
    nodeMap: Object.fromEntries(nodeMap),
    stats: {
      totalNodes: nodes.length,
      rootNodes: 1,
      topics: topicsData.length,
      subtopics: topicsData.reduce((sum, t) => sum + (t.subtopics?.length || 0), 0),
      levels: 3,
    },
  };
};

/**
 * Get node hierarchy
 */
const getNodeHierarchy = (nodes) => {
  const hierarchy = {};
  nodes.forEach((node) => {
    if (!hierarchy[node.type]) {
      hierarchy[node.type] = [];
    }
    hierarchy[node.type].push(node);
  });
  return hierarchy;
};

/**
 * Find node by ID
 */
const findNodeById = (id, nodes) => {
  return nodes.find((node) => node.id === id);
};

/**
 * Find children of a node
 */
const findChildren = (parentId, nodes) => {
  return nodes.filter((node) => node.parent === parentId);
};

/**
 * Build adjacency list for graph algorithms
 */
const buildAdjacencyList = (edges) => {
  const adjacencyList = {};
  edges.forEach((edge) => {
    if (!adjacencyList[edge.source]) {
      adjacencyList[edge.source] = [];
    }
    adjacencyList[edge.source].push(edge.target);
  });
  return adjacencyList;
};

/**
 * Calculate graph depth
 */
const calculateGraphDepth = (nodes) => {
  return Math.max(...nodes.map((n) => n.level || 0)) + 1;
};

/**
 * Convert graph to adjacency matrix
 */
const toAdjacencyMatrix = (nodes, edges) => {
  const nodeIndex = {};
  nodes.forEach((node, idx) => {
    nodeIndex[node.id] = idx;
  });

  const matrix = Array(nodes.length)
    .fill(null)
    .map(() => Array(nodes.length).fill(0));

  edges.forEach((edge) => {
    const sourceIdx = nodeIndex[edge.source];
    const targetIdx = nodeIndex[edge.target];
    if (sourceIdx !== undefined && targetIdx !== undefined) {
      matrix[sourceIdx][targetIdx] = edge.weight || 1;
    }
  });

  return { matrix, nodeIndex };
};

module.exports = {
  topicsToGraph,
  getNodeHierarchy,
  findNodeById,
  findChildren,
  buildAdjacencyList,
  calculateGraphDepth,
  toAdjacencyMatrix,
};
