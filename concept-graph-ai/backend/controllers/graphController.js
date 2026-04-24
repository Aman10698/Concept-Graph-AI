const { topicsToGraph, getNodeHierarchy } = require('../utils/graphConverter');

const convertTopicsToGraph = async (req, res) => {
  try {
    const { topics } = req.body;

    if (!topics || !Array.isArray(topics)) {
      return res.status(400).json({
        success: false,
        message: 'Topics array is required',
      });
    }

    const graph = topicsToGraph(topics);

    res.status(200).json({
      success: true,
      message: 'Graph created successfully',
      data: {
        nodes: graph.nodes,
        edges: graph.edges,
        hierarchy: getNodeHierarchy(graph.nodes),
        stats: graph.stats,
      },
    });
  } catch (error) {
    console.error('Graph conversion error:', error);
    res.status(500).json({
      success: false,
      message: 'Error converting topics to graph',
      error: error.message,
    });
  }
};

const getGraphStats = async (req, res) => {
  try {
    const { nodes, edges } = req.body;

    if (!nodes || !edges) {
      return res.status(400).json({
        success: false,
        message: 'Nodes and edges are required',
      });
    }

    const stats = {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      nodeTypes: {},
      levels: Math.max(...nodes.map((n) => n.level || 0)) + 1,
    };

    nodes.forEach((node) => {
      stats.nodeTypes[node.type] = (stats.nodeTypes[node.type] || 0) + 1;
    });

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating stats',
      error: error.message,
    });
  }
};

module.exports = {
  convertTopicsToGraph,
  getGraphStats,
};
