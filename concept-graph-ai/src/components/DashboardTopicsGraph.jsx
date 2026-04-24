import React, { useEffect, useRef, useMemo } from 'react';
import { drawCircleLabel } from '../utils/canvasTextUtils';

const DashboardTopicsGraph = ({ topics, evaluationData }) => {
  const containerRef = useRef(null);

  // Prepare graph data
  const graphData = useMemo(() => {
    if (!topics || topics.length === 0) return null;

    return topics.map((topic, idx) => {
      const topicName = typeof topic === 'string' ? topic : topic.name || topic;
      let evaluation = null;

      Object.entries(evaluationData).forEach(([key, evalData]) => {
        if (evalData?.topic?.toLowerCase().includes(topicName.toLowerCase())) {
          evaluation = evalData;
        }
      });

      return {
        name: topicName,
        x: (idx % 5) * 200 + 50,
        y: Math.floor(idx / 5) * 150 + 50,
        rating: evaluation?.rating || 'unevaluated',
        confidence: evaluation?.confidence || 0,
      };
    });
  }, [topics, evaluationData]);

  useEffect(() => {
    if (!graphData || !containerRef.current) return;

    const canvas = document.createElement('canvas');
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(canvas);

    const rect = containerRef.current.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = Math.max(400, Math.ceil(graphData.length / 5) * 150 + 100);

    const ctx = canvas.getContext('2d');

    // Draw nodes
    graphData.forEach((node, idx) => {
      const radius = 40;
      const color =
        node.rating === 'strong'
          ? '#10b981'
          : node.rating === 'partial'
          ? '#f59e0b'
          : node.rating === 'weak'
          ? '#ef4444'
          : '#d1d5db';

      // Draw node circle
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x + radius, node.y + radius, radius, 0, Math.PI * 2);
      ctx.fill();

      // Draw node border
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw text strictly inside the circle using shared utility
      drawCircleLabel(ctx, node.name, node.x + radius, node.y + radius, radius, 11, true);

      // Draw confidence as a small indicator
      if (node.rating !== 'unevaluated') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 10px Arial';
        ctx.fillText(`${node.confidence}%`, node.x + radius, node.y + radius + radius + 15);
      }
    });
  }, [graphData]);

  if (!graphData || graphData.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p className="text-lg">No topics to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-700">Strong</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
          <span className="text-sm text-gray-700">Partial</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500"></div>
          <span className="text-sm text-gray-700">Weak</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-gray-300"></div>
          <span className="text-sm text-gray-700">Not Evaluated</span>
        </div>
      </div>

      <div
        ref={containerRef}
        className="w-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border border-gray-200 overflow-x-auto"
      />
    </div>
  );
};

export default DashboardTopicsGraph;
