import { useState } from 'react';
import {
  convertTopicsToGraphLocal,
  exportGraphAsJSON,
  exportGraphAsCSV,
  getGraphStatsAPI,
} from '../services/graphService';

export const useGraph = () => {
  const [graph, setGraph] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);

  const convertTopicsToGraph = (topics, subject = '') => {
    setIsConverting(true);
    setError(null);

    try {
      const result = convertTopicsToGraphLocal(topics, subject);
      const graphData = result.data;
      
      setGraph(graphData);
      setStats(graphData.stats);
      
      return graphData;
    } catch (err) {
      const errorMessage = err.message || 'Failed to convert topics to graph';
      setError(errorMessage);
      return null;
    } finally {
      setIsConverting(false);
    }
  };

  const exportAsJSON = async (filename = 'concept-graph.json') => {
    if (!graph) {
      setError('No graph to export');
      return false;
    }

    try {
      return exportGraphAsJSON(graph, filename);
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const exportAsCSV = async (filename = 'concept-graph.csv') => {
    if (!graph) {
      setError('No graph to export');
      return false;
    }

    try {
      return exportGraphAsCSV(graph, filename);
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const clearGraph = () => {
    setGraph(null);
    setStats(null);
    setError(null);
  };

  return {
    graph,
    stats,
    isConverting,
    error,
    convertTopicsToGraph,
    exportAsJSON,
    exportAsCSV,
    clearGraph,
  };
};
