import React, { useMemo, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════════
   DependencyViewer — Hierarchical Prerequisite Tree
   Replaces the old force-directed canvas graph.

   Prop contract (unchanged):
     dependencyData  — { relationships[], recommendedOrder[], treeNodes[]?, graph? }
     evalData        — { [topicName]: { rating, score } }
     isLoading
     error
═══════════════════════════════════════════════════════════════════ */

/* ── colour config ─────────────────────────────────────────────── */
const C = {
  strong:      { border: '#22c55e', bg: '#f0fdf4', badge: '#dcfce7', badgeTxt: '#15803d', label: 'Strong' },
  partial:     { border: '#f59e0b', bg: '#fffbeb', badge: '#fef3c7', badgeTxt: '#b45309', label: 'Partial' },
  weak:        { border: '#ef4444', bg: '#fef2f2', badge: '#fee2e2', badgeTxt: '#b91c1c', label: 'Weak'   },
  not_started: { border: '#cbd5e1', bg: '#f8fafc', badge: '#f1f5f9', badgeTxt: '#64748b', label: 'Not Started' },
};

const rating = (name, evalData) => {
  const ev = evalData?.[name];
  if (!ev) return 'not_started';
  return ev.rating || (ev.score >= 75 ? 'strong' : ev.score >= 45 ? 'partial' : 'weak');
};

/* ── layout constants ──────────────────────────────────────────── */
const NW    = 168;  // node card width
const NH    = 70;   // node card height
const HGAP  = 24;   // horizontal gap between sibling nodes
const VGAP  = 90;   // vertical gap between levels

/* ── Build level-based tree from relationships ─────────────────── */
function buildLevelTree(dependencyData) {
  const rels   = dependencyData?.relationships || [];
  const order  = dependencyData?.recommendedOrder || [];
  const tNodes = dependencyData?.treeNodes || [];

  /* ── Strategy A: treeNodes already have level + parentId ── */
  if (tNodes.length > 0 && tNodes.some(n => n.level !== undefined)) {
    const levels = {};
    tNodes.forEach(n => {
      const lv = n.level ?? 0;
      if (!levels[lv]) levels[lv] = [];
      levels[lv].push({ name: n.name || n.id, parentName: n.parentId || null });
    });
    return levels;
  }

  /* ── Strategy B: derive levels from relationships ── */
  if (rels.length > 0) {
    // Build child → parent map
    const childOf = {};   // childOf[child] = parent
    const allNames = new Set();
    rels.forEach(r => {
      if (r.source && r.target) {
        childOf[r.target] = r.source;
        allNames.add(r.source);
        allNames.add(r.target);
      }
    });

    // BFS to assign levels: roots have no parent
    const levelOf = {};
    const queue   = [];
    allNames.forEach(name => {
      if (!childOf[name]) {
        levelOf[name] = 0;
        queue.push(name);
      }
    });
    while (queue.length) {
      const cur = queue.shift();
      rels.forEach(r => {
        if (r.source === cur && levelOf[r.target] === undefined) {
          levelOf[r.target] = levelOf[cur] + 1;
          queue.push(r.target);
        }
      });
    }

    const levels = {};
    allNames.forEach(name => {
      const lv = levelOf[name] ?? 0;
      if (!levels[lv]) levels[lv] = [];
      levels[lv].push({ name, parentName: childOf[name] || null });
    });
    return levels;
  }

  /* ── Strategy C: flat list from recommendedOrder ── */
  const list = order.length > 0
    ? order
    : (dependencyData?.graph?.nodes || []).map(n => n.label || n.id);

  if (list.length === 0) return {};

  // Split into a flat 2-level tree: root(s) at 0, rest at 1
  const half = Math.ceil(list.length / 2);
  return {
    0: list.slice(0, Math.min(3, half)).map(name => ({ name, parentName: null })),
    1: list.slice(Math.min(3, half)).map(name => ({ name, parentName: null })),
  };
}

/* ── Compute x,y positions for all nodes ──────────────────────── */
function computePositions(levels) {
  const levelKeys = Object.keys(levels).map(Number).sort((a, b) => a - b);
  if (levelKeys.length === 0) return { positions: [], totalW: 0, totalH: 0 };

  // Pass 1: widths per level
  const levelWidths = {};
  levelKeys.forEach(lv => {
    const count = levels[lv].length;
    levelWidths[lv] = count * NW + (count - 1) * HGAP;
  });

  const totalW = Math.max(...Object.values(levelWidths));
  const totalH = levelKeys.length * (NH + VGAP);

  // Pass 2: x,y per node
  const positions = {};
  levelKeys.forEach(lv => {
    const nodes = levels[lv];
    const rowW  = levelWidths[lv];
    const startX = (totalW - rowW) / 2;
    const y      = lv * (NH + VGAP);
    nodes.forEach((node, i) => {
      positions[node.name] = {
        x: startX + i * (NW + HGAP),
        y,
        name: node.name,
        parentName: node.parentName,
      };
    });
  });

  return { positions, totalW, totalH };
}

/* ── SVG Node Card ─────────────────────────────────────────────── */
function NodeCard({ pos, evalData, selectedName, onSelect }) {
  const { x, y, name } = pos;
  const r   = rating(name, evalData);
  const cfg = C[r] || C.not_started;
  const ev  = evalData?.[name];
  const sel = selectedName === name;

  // Truncate name to 2 lines of ~18 chars
  const words = name.split(' ');
  const lines = [];
  let cur = '';
  for (const wd of words) {
    const test = cur ? cur + ' ' + wd : wd;
    if (test.length > 18 && cur) {
      lines.push(cur);
      if (lines.length === 2) break;
      cur = wd;
    } else { cur = test; }
  }
  if (cur && lines.length < 2) lines.push(cur);
  if (lines.length === 2 && words.join(' ').length > lines.join(' ').length + 2) {
    lines[1] = lines[1].slice(0, 17) + '…';
  }

  const nameY  = lines.length > 1 ? y + NH / 2 - 14 : y + NH / 2 - 6;
  const badgeY = y + NH / 2 + (lines.length > 1 ? 10 : 6);

  return (
    <g onClick={() => onSelect(name)} style={{ cursor: 'pointer' }}>
      {sel && <rect x={x-4} y={y-4} width={NW+8} height={NH+8} rx="14" fill="none"
        stroke={cfg.border} strokeWidth="2.5" opacity="0.5"/>}
      {/* Shadow */}
      <rect x={x+2} y={y+4} width={NW} height={NH} rx="12" fill="rgba(0,0,0,0.05)"/>
      {/* Card */}
      <rect x={x} y={y} width={NW} height={NH} rx="12"
        fill={sel ? cfg.bg : '#fff'}
        stroke={cfg.border} strokeWidth={sel ? 2.2 : 1.6}/>
      {/* Name lines */}
      {lines.map((ln, i) => (
        <text key={i} x={x + NW/2} y={nameY + i * 14}
          textAnchor="middle"
          style={{ fontSize: '0.73rem', fontWeight: 700, fill: '#1e1b4b', fontFamily: 'Inter,sans-serif' }}>
          {ln}
        </text>
      ))}
      {/* Status badge */}
      <rect x={x + NW/2 - 30} y={badgeY - 9} width={60} height={17} rx="8" fill={cfg.badge}/>
      <text x={x + NW/2} y={badgeY + 1}
        textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: '0.58rem', fontWeight: 700, fill: cfg.badgeTxt, fontFamily: 'Inter,sans-serif' }}>
        {cfg.label}
      </text>
      {/* Score pill */}
      {typeof ev?.score === 'number' && (
        <text x={x + NW/2 + 36} y={badgeY + 1}
          dominantBaseline="middle"
          style={{ fontSize: '0.70rem', fontWeight: 700, fill: '#374151', fontFamily: 'Inter,sans-serif' }}>
          {Math.round(ev.score)}%
        </text>
      )}
    </g>
  );
}

/* ── SVG Curved Edge ────────────────────────────────────────────── */
function Edge({ from, to, evalData }) {
  if (!from || !to) return null;
  const r   = rating(to.name, evalData);
  const cfg = C[r] || C.not_started;
  const x1  = from.x + NW / 2;
  const y1  = from.y + NH;
  const x2  = to.x  + NW / 2;
  const y2  = to.y;
  const my  = (y1 + y2) / 2;
  return (
    <path
      d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
      fill="none"
      stroke={cfg.border}
      strokeWidth="1.8"
      opacity="0.65"
      markerEnd={`url(#arr-${r})`}
    />
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════════ */
const DependencyViewer = ({ dependencyData, evalData = {}, isLoading, error }) => {
  const [selected, setSelected] = useState(null);

  const { positions, totalW, totalH } = useMemo(() => {
    if (!dependencyData) return { positions: {}, totalW: 0, totalH: 0 };
    const levels = buildLevelTree(dependencyData);
    return computePositions(levels);
  }, [dependencyData]);

  const allPositions = Object.values(positions);
  const PAD = 40;
  const svgW = totalW + PAD * 2;
  const svgH = totalH + PAD * 2;

  /* ── guard states ── */
  if (isLoading) return (
    <div style={{ textAlign: 'center', padding: '48px 32px' }}>
      <div className="t-spinner" style={{ margin: '0 auto 14px' }} />
      <p style={{ fontWeight: 600, color: '#6b7280' }}>Building prerequisite tree…</p>
    </div>
  );

  if (error) return <div className="t-alert t-alert-error">{error}</div>;

  if (!dependencyData || allPositions.length === 0) return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>No prerequisite data yet</p>
      <p style={{ fontSize: '0.85rem' }}>Upload a syllabus to see the dependency tree.</p>
    </div>
  );

  /* ── selected node detail ── */
  const selEv = selected ? evalData?.[selected] : null;
  const selR  = selected ? rating(selected, evalData) : null;
  const selCfg = selR ? (C[selR] || C.not_started) : null;

  return (
    <div>
      {/* ── SVG tree ── */}
      <div style={{ overflowX: 'auto', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fafbff', width: '100%' }}>
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          width="100%"
          style={{ display: 'block', minWidth: Math.max(svgW, 400) }}
        >
          {/* Arrow markers */}
          <defs>
            {Object.entries(C).map(([s, cfg]) => (
              <marker key={s} id={`arr-${s}`} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L7,3 z" fill={cfg.border} opacity="0.65"/>
              </marker>
            ))}
          </defs>

          <g transform={`translate(${PAD}, ${PAD})`}>
            {/* Edges */}
            {allPositions.map(pos => {
              if (!pos.parentName || !positions[pos.parentName]) return null;
              return (
                <Edge
                  key={`e-${pos.parentName}-${pos.name}`}
                  from={positions[pos.parentName]}
                  to={pos}
                  evalData={evalData}
                />
              );
            })}
            {/* Nodes */}
            {allPositions.map(pos => (
              <NodeCard
                key={pos.name}
                pos={pos}
                evalData={evalData}
                selectedName={selected}
                onSelect={setSelected}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* ── Selected node detail panel ── */}
      {selected && selCfg && (
        <div style={{
          marginTop: 16, borderRadius: 12, border: `1.5px solid ${selCfg.border}40`,
          background: selCfg.bg, padding: '14px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e1b4b', marginBottom: 4 }}>{selected}</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{
                  fontSize: '0.68rem', fontWeight: 700, padding: '2px 10px', borderRadius: 99,
                  background: selCfg.badge, color: selCfg.badgeTxt,
                }}>{selCfg.label}</span>
                {typeof selEv?.score === 'number' && (
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>{Math.round(selEv.score)}% Mastery</span>
                )}
              </div>
            </div>
            <button onClick={() => setSelected(null)}
              style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1rem', color: '#9ca3af' }}>✕</button>
          </div>
          {/* Children of selected (direct deps) */}
          {(() => {
            const children = allPositions.filter(p => p.parentName === selected);
            if (children.length === 0) return null;
            return (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prerequisite Subtopics</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {children.map(ch => {
                    const cr  = rating(ch.name, evalData);
                    const cc  = C[cr] || C.not_started;
                    const cev = evalData?.[ch.name];
                    return (
                      <div key={ch.name} onClick={() => setSelected(ch.name)}
                        style={{
                          padding: '4px 12px', borderRadius: 8, border: `1.5px solid ${cc.border}55`,
                          background: cc.badge, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#1e1b4b' }}>{ch.name}</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: cc.badgeTxt }}>{cc.label}</span>
                        {typeof cev?.score === 'number' && (
                          <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>{Math.round(cev.score)}%</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap' }}>
        {Object.entries(C).map(([key, cfg]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: cfg.border }}/>
            <span style={{ fontSize: '0.73rem', color: '#6b7280', fontWeight: 600 }}>{cfg.label}</span>
          </div>
        ))}
      </div>

      {/* ── Recommended study order ── */}
      {(dependencyData.recommendedOrder?.length > 0) && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            Recommended Study Order
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {dependencyData.recommendedOrder.map((topic, i) => {
              const r   = rating(topic, evalData);
              const cfg = C[r] || C.not_started;
              return (
                <React.Fragment key={topic}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 999,
                    background: cfg.badge, border: `1.5px solid ${cfg.border}55`,
                    color: cfg.badgeTxt, fontSize: '0.78rem', fontWeight: 700,
                  }}>{i + 1}. {topic}</span>
                  {i < dependencyData.recommendedOrder.length - 1 && (
                    <span style={{ color: '#d1d5db', fontSize: '0.9rem' }}>→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default DependencyViewer;
