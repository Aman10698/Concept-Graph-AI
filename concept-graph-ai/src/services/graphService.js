import axios from 'axios';
import { topicsToGraph, getGraphStats, exportGraphToJSON, exportGraphToCSV } from '../utils/graphConverter';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

/**
 * Convert topics to graph using backend API
 */
export const convertTopicsToGraphAPI = async (topics) => {
  try {
    if (!topics || !Array.isArray(topics)) {
      throw new Error('Invalid topics data');
    }

    const response = await axios.post(`${API_BASE_URL}/graph/convert`, {
      topics,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message ||
      error.message ||
      'Failed to convert topics to graph'
    );
  }
};

/**
 * Convert topics to graph locally (client-side)
 */
export const convertTopicsToGraphLocal = (topics, subject = '') => {
  try {
    const graph = topicsToGraph(topics, subject);
    return {
      success: true,
      data: {
        nodes: graph.nodes,
        edges: graph.edges,
        stats: getGraphStats(graph.nodes, graph.edges),
      },
    };
  } catch (error) {
    throw new Error(error.message || 'Failed to convert topics to graph');
  }
};

/**
 * Export graph as JSON
 */
export const exportGraphAsJSON = (graph, filename = 'graph.json') => {
  try {
    const json = exportGraphToJSON(graph);
    downloadFile(json, filename, 'application/json');
    return true;
  } catch (error) {
    console.error('Export error:', error);
    return false;
  }
};

/**
 * Export graph as CSV
 */
export const exportGraphAsCSV = (graph, filename = 'graph.csv') => {
  try {
    const csv = exportGraphToCSV(graph);
    downloadFile(csv, filename, 'text/csv');
    return true;
  } catch (error) {
    console.error('Export error:', error);
    return false;
  }
};

/**
 * Helper function to download file
 */
const downloadFile = (content, filename, type) => {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

/**
 * Get graph statistics from backend
 */
export const getGraphStatsAPI = async (nodes, edges) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/graph/stats`, {
      nodes,
      edges,
    });

    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message ||
      error.message ||
      'Failed to get graph stats'
    );
  }
};
