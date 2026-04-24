import React, { useState } from 'react';

/* ── colour helpers ─────────────────────────────────────────── */
const NODE_TYPE_META = {
  root:     { accent: '#6366f1', bg: 'rgba(99,102,241,0.08)',  icon: '🗺️',  label: 'Root',     badge: 't-badge-purple' },
  topic:    { accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)',  icon: '📌',  label: 'Topic',    badge: 't-badge-blue'   },
  subtopic: { accent: '#22c55e', bg: 'rgba(34,197,94,0.08)',   icon: '📎',  label: 'Subtopic', badge: 't-badge-green'  },
};

const EVAL_ACCENT = {
  strong:  '#22c55e',
  partial: '#f59e0b',
  weak:    '#ef4444',
};

function getAccent(type, nodeName, evaluationData) {
  for (const [, ev] of Object.entries(evaluationData)) {
    if (ev?.rating && nodeName && ev.topic?.toLowerCase().includes(nodeName.toLowerCase())) {
      return EVAL_ACCENT[ev.rating] ?? null;
    }
  }
  return NODE_TYPE_META[type]?.accent ?? '#9ca3af';
}

/* ── stat pill ──────────────────────────────────────────────── */
const StatPill = ({ label, value, color, bg }) => (
  <div style={{
    flex: 1, minWidth: 100,
    background: bg,
    border: `1.5px solid ${color}22`,
    borderLeft: `4px solid ${color}`,
    borderRadius: 12, padding: '14px 18px',
  }}>
    <p style={{ fontSize: '0.72rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</p>
    <p style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
  </div>
);

/* ── NodeHierarchyTree ──────────────────────────────────────── */
/**
 * Renders the graph nodes in a 3-column visual hierarchy:
 *   Root  →  Topics  →  Subtopics
 * Connected by curved SVG lines between columns.
 */
const NodeHierarchyTree = ({ nodes, evaluationData = {} }) => {
  const [hoveredId, setHoveredId] = React.useState(null);

  if (!nodes?.length) return null;

  const roots     = nodes.filter(n => n.type === 'root');
  const topics    = nodes.filter(n => n.type === 'topic');
  const subtopics = nodes.filter(n => n.type === 'subtopic');

  // --- layout constants ---
  const COL_W   = 200;   // px per column (rough)
  const NODE_H  = 44;    // px per node pill + gap
  const PAD_Y   = 16;
  const COL_GAP = 80;    // gap between columns

  // Column x centres (SVG coordinate space)
  const x0 = 0;
  const x1 = COL_W + COL_GAP;
  const x2 = (COL_W + COL_GAP) * 2;

  const maxRows  = Math.max(roots.length, topics.length, subtopics.length);
  const svgH     = Math.max(120, maxRows * NODE_H + PAD_Y * 2);
  const svgW     = x2 + COL_W;

  // Centre Y for a given index in a column of `total` items
  const cy = (idx, total) => PAD_Y + (svgH - PAD_Y * 2) * (idx + 0.5) / total;

  // Node pill colours, using eval override
  const pillStyle = (node) => {
    const eval_ = Object.values(evaluationData).find(
      e => e?.topic?.toLowerCase().includes(node.label.toLowerCase())
    );
    const accent = eval_
      ? (EVAL_ACCENT[eval_.rating] ?? NODE_TYPE_META[node.type]?.accent)
      : NODE_TYPE_META[node.type]?.accent ?? '#9ca3af';
    return { accent, bg: `${accent}14`, border: `${accent}44` };
  };

  // Build edge list: root→topics, topic→subtopics
  const edges = [];
  roots.forEach((root, ri) => {
    topics.forEach((topic, ti) => {
      if (topic.parent === root.id || !topic.parent) {
        edges.push({
          x1: x0 + COL_W, y1: cy(ri, roots.length),
          x2: x1,         y2: cy(ti, topics.length),
          accent: NODE_TYPE_META.topic.accent,
        });
      }
    });
  });
  subtopics.forEach((sub, si) => {
    const pIdx = topics.findIndex(t => t.id === sub.parent);
    if (pIdx >= 0) {
      edges.push({
        x1: x1 + COL_W, y1: cy(pIdx, topics.length),
        x2: x2,         y2: cy(si, subtopics.length),
        accent: NODE_TYPE_META.subtopic.accent,
      });
    }
  });

  const renderColumn = (colNodes, xStart, total) =>
    colNodes.map((node, idx) => {
      const { accent, bg, border } = pillStyle(node);
      const meta = NODE_TYPE_META[node.type] ?? NODE_TYPE_META.subtopic;
      const yMid = cy(idx, total);
      const isHov = hoveredId === node.id;
      return (
        <g key={node.id}
           onMouseEnter={() => setHoveredId(node.id)}
           onMouseLeave={() => setHoveredId(null)}
           style={{ cursor: 'default' }}>
          {/* pill background */}
          <rect
            x={xStart} y={yMid - 18}
            width={COL_W} height={36}
            rx={10}
            fill={isHov ? `${accent}22` : bg}
            stroke={border}
            strokeWidth={isHov ? 2 : 1.5}
            style={{ transition: 'fill 0.18s, stroke-width 0.18s' }}
          />
          {/* left accent bar */}
          <rect x={xStart} y={yMid - 18} width={4} height={36} rx={2} fill={accent} />
          {/* icon */}
          <text x={xStart + 14} y={yMid + 5} fontSize={14} textAnchor="middle">{meta.icon}</text>
          {/* label */}
          <text
            x={xStart + 26} y={yMid + 1}
            fontSize={11.5} fontWeight={600}
            fill="var(--text-primary)"
            dominantBaseline="middle"
          >
            {node.label.length > 20 ? node.label.slice(0, 19) + '…' : node.label}
          </text>
          {/* sublabel */}
          {node.data && (
            <text
              x={xStart + 26} y={yMid + 12}
              fontSize={9} fill="var(--text-muted)"
              dominantBaseline="middle"
            >
              {node.data.level === 0
                ? 'root'
                : node.type === 'topic'
                ? `${node.data.subtopicCount ?? 0} subtopics`
                : `↳ ${node.data.parentTopic?.slice(0, 16) ?? ''}`}
            </text>
          )}
          {/* hover tooltip box */}
          {isHov && (
            <g>
              <rect x={xStart} y={yMid - 54} width={COL_W} height={30} rx={6}
                fill="white" stroke={border} strokeWidth={1.5}
                filter="drop-shadow(0 2px 6px rgba(0,0,0,0.12))"
              />
              <text x={xStart + COL_W / 2} y={yMid - 39} fontSize={10} fontWeight={600}
                fill={accent} textAnchor="middle" dominantBaseline="middle">
                {node.label} · Level {node.data?.level ?? '?'}
              </text>
            </g>
          )}
        </g>
      );
    });

  return (
    <div style={{ overflowX: 'auto', width: '100%' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, justifyContent: 'center' }}>
        {[
          { label: 'Root',      count: roots.length,     color: NODE_TYPE_META.root.accent },
          { label: 'Topics',    count: topics.length,    color: NODE_TYPE_META.topic.accent },
          { label: 'Subtopics', count: subtopics.length, color: NODE_TYPE_META.subtopic.accent },
        ].map(({ label, count, color }) => (
          <div key={label} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 999,
            background: `${color}12`, border: `1.5px solid ${color}33`,
            fontSize: '0.78rem', fontWeight: 600, color,
          }}>
            <span style={{ fontSize: '1.1rem', fontWeight: 800 }}>{count}</span>
            {label}
          </div>
        ))}
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        style={{ minWidth: svgW, display: 'block', fontFamily: 'inherit' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="hierEdge1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={NODE_TYPE_META.root.accent}   stopOpacity="0.5" />
            <stop offset="100%" stopColor={NODE_TYPE_META.topic.accent} stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="hierEdge2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={NODE_TYPE_META.topic.accent}    stopOpacity="0.5" />
            <stop offset="100%" stopColor={NODE_TYPE_META.subtopic.accent} stopOpacity="0.5" />
          </linearGradient>
        </defs>

        {/* connector curves */}
        {edges.map((e, i) => {
          const mx = (e.x1 + e.x2) / 2;
          const isRight = e.x1 > COL_W; // topic→subtopic edge
          return (
            <path
              key={i}
              d={`M ${e.x1} ${e.y1} C ${mx} ${e.y1}, ${mx} ${e.y2}, ${e.x2} ${e.y2}`}
              fill="none"
              stroke={isRight ? 'url(#hierEdge2)' : 'url(#hierEdge1)'}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.7}
            />
          );
        })}

        {/* column headers */}
        {[
          { label: '🗺️ Root',      x: x0,    n: roots.length },
          { label: '📌 Topics',    x: x1,    n: topics.length },
          { label: '📎 Subtopics', x: x2,    n: subtopics.length },
        ].map(({ label, x, n }) => n > 0 && (
          <text key={label} x={x + COL_W / 2} y={8} textAnchor="middle"
            fontSize={10} fontWeight={700} fill="var(--text-muted)"
            style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {label}
          </text>
        ))}

        {/* divider lines between columns */}
        {[x0 + COL_W + COL_GAP / 2, x1 + COL_W + COL_GAP / 2].map(xd => (
          <line key={xd} x1={xd} y1={PAD_Y} x2={xd} y2={svgH - PAD_Y}
            stroke="rgba(99,102,241,0.1)" strokeWidth={1} strokeDasharray="4 4" />
        ))}

        {/* nodes */}
        {renderColumn(roots,     x0, roots.length)}
        {renderColumn(topics,    x1, topics.length)}
        {renderColumn(subtopics, x2, subtopics.length)}
      </svg>
    </div>
  );
};

/* ── main component ─────────────────────────────────────────── */
const GraphViewer = ({ graph, stats, onExport, evaluationData = {} }) => {
  const [expandedNodes, setExpandedNodes] = useState(new Set(['root-topic']));

  if (!graph?.nodes) {
    return (
      <div className="t-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🗺️</div>
        <p style={{ color: 'var(--text-secondary)' }}>No graph data to display.</p>
      </div>
    );
  }

  const toggle = (id) => setExpandedNodes(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const rootNodes   = graph.nodes.filter(n => n.type === 'root');
  const childrenOf  = (id) => graph.nodes.filter(n => n.parent === id);

  /* recursive tree renderer */
  const renderNode = (nodeId, depth = 0) => {
    const node     = graph.nodes.find(n => n.id === nodeId);
    const children = childrenOf(nodeId);
    const expanded = expandedNodes.has(nodeId);
    if (!node) return null;

    const meta   = NODE_TYPE_META[node.type] ?? NODE_TYPE_META.subtopic;
    const accent = getAccent(node.type, node.label, evaluationData);

    return (
      <div key={nodeId} style={{ marginLeft: depth * 24 }}>
        <div
          onClick={() => children.length && toggle(nodeId)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', marginBottom: 6,
            borderRadius: 10,
            background: meta.bg,
            border: `1.5px solid ${accent}33`,
            borderLeft: `3px solid ${accent}`,
            cursor: children.length ? 'pointer' : 'default',
            transition: 'box-shadow 0.18s',
          }}
        >
          {/* chevron */}
          {children.length > 0 ? (
            <span style={{ fontSize: '0.7rem', color: accent, flexShrink: 0, width: 14, textAlign: 'center', transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          ) : (
            <span style={{ width: 14 }} />
          )}

          {/* icon */}
          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{meta.icon}</span>

          {/* label */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.label}
            </p>
            {node.data && (
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1 }}>
                {node.data.level === 0
                  ? 'Root concept'
                  : node.data.level === 1
                  ? `Topic · ${node.data.subtopicCount ?? children.length} subtopics`
                  : `Subtopic of ${node.data.parentTopic}`}
              </p>
            )}
          </div>

          {children.length > 0 && (
            <span className={`t-badge ${meta.badge}`} style={{ flexShrink: 0 }}>{children.length}</span>
          )}
        </div>

        {expanded && children.map(c => renderNode(c.id, depth + 1))}
      </div>
    );
  };

  const rootNode = rootNodes[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Stats row ── */}
      {stats && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <StatPill label="Total Nodes" value={stats.totalNodes}    color="#6366f1" bg="rgba(99,102,241,0.06)" />
          <StatPill label="Topics"      value={stats.topicNodes}    color="#3b82f6" bg="rgba(59,130,246,0.06)" />
          <StatPill label="Subtopics"   value={stats.subtopicNodes} color="#22c55e" bg="rgba(34,197,94,0.06)"  />
          <StatPill label="Edges"       value={stats.totalEdges}    color="#a855f7" bg="rgba(168,85,247,0.06)" />
        </div>
      )}

      {/* ── Graph hierarchy tree ── */}
      <div className="t-card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Graph Hierarchy</h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Click any node to expand / collapse its children</p>
          </div>
          {onExport && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => onExport('json')} className="t-btn t-btn-ghost t-btn-sm">⬇ JSON</button>
              <button onClick={() => onExport('csv')}  className="t-btn t-btn-ghost t-btn-sm">⬇ CSV</button>
            </div>
          )}
        </div>

        {/* legend */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.entries(NODE_TYPE_META).map(([type, m]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: m.accent, flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{m.label}</span>
            </div>
          ))}
          {Object.entries(EVAL_ACCENT).map(([rating, color]) => (
            <div key={rating} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'capitalize' }}>{rating}</span>
            </div>
          ))}
        </div>

        <div style={{
          maxHeight: 420, overflowY: 'auto', overflowX: 'hidden',
          background: 'rgba(248,250,255,0.8)', borderRadius: 10, padding: '14px 12px',
          border: '1px solid rgba(99,102,241,0.08)',
        }}>
          {rootNode ? renderNode(rootNode.id) : (
            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 24 }}>No root node found.</p>
          )}
        </div>
      </div>

      {/* ── Node Details: visual hierarchy tree ── */}
      {graph.nodes.length > 0 && (
        <div className="t-card" style={{ padding: '22px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Node Details</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hierarchy view — Root → Topics → Subtopics</p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {Object.entries(NODE_TYPE_META).map(([type, m]) => (
                <span key={type} className={`t-badge ${m.badge}`}>{m.icon} {m.label}</span>
              ))}
            </div>
          </div>

          {/* eslint-disable-next-line react/jsx-no-undef */}
          <NodeHierarchyTree nodes={graph.nodes} evaluationData={evaluationData} />
        </div>
      )}
    </div>
  );
};

export default GraphViewer;
