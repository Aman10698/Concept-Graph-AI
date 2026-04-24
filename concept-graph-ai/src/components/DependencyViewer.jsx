import React, { useEffect, useRef, useState, useCallback } from 'react';

/* ─── constants ──────────────────────────────────────────────── */
const NODE_R  = 24;
const PAD     = 80;
const H       = 560;

/* ─── colour by knowledge rating ─────────────────────────────── */
const RATING_STYLE = {
  strong:   { fill: '#22c55e', stroke: '#16a34a', text: '#fff' },
  partial:  { fill: '#f59e0b', stroke: '#d97706', text: '#fff' },
  moderate: { fill: '#f59e0b', stroke: '#d97706', text: '#fff' },
  weak:     { fill: '#ef4444', stroke: '#dc2626', text: '#fff' },
  default:  { fill: '#cbd5e1', stroke: '#94a3b8', text: '#374151' },
};

const getStyle = (name, evalData) =>
  RATING_STYLE[evalData?.[name]?.rating] || RATING_STYLE.default;

/* ─── force layout (runs once when data arrives) ──────────────── */
function runForceLayout(names, edges, W) {
  const n = names.length;
  if (n === 0) return [];

  const cx = W / 2, cy = H / 2;

  // Init: spiral outward from center so nodes aren't stacked
  const nodes = names.map((name, i) => {
    const angle  = (2 * Math.PI * i) / n - Math.PI / 2;
    const r      = Math.min(cx, cy) - PAD - (n > 10 ? 0 : 20);
    return { id: name, name, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle), vx: 0, vy: 0 };
  });

  const byId = Object.fromEntries(nodes.map(nd => [nd.id, nd]));

  // Resolve edges to node pairs
  const links = edges
    .map(e => ({ s: byId[e.source], t: byId[e.target] }))
    .filter(l => l.s && l.t);

  // Simulation params
  const ITER      = 200;
  const REPEL     = 5500;        // push apart
  const SPRING_L  = Math.max(120, W / (n + 1));  // ideal link length
  const SPRING_K  = 0.06;        // spring stiffness
  const GRAVITY   = 0.008;       // pull to center
  const DAMP      = 0.82;

  for (let iter = 0; iter < ITER; iter++) {
    // Repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx  = nodes[i].x - nodes[j].x || 0.1;
        const dy  = nodes[i].y - nodes[j].y || 0.1;
        const d2  = dx * dx + dy * dy;
        const d   = Math.sqrt(d2) || 0.1;
        const f   = REPEL / d2;
        const fx  = (dx / d) * f;
        const fy  = (dy / d) * f;
        nodes[i].vx += fx;  nodes[i].vy += fy;
        nodes[j].vx -= fx;  nodes[j].vy -= fy;
      }
    }

    // Spring attraction along edges
    links.forEach(({ s, t }) => {
      const dx  = t.x - s.x;
      const dy  = t.y - s.y;
      const d   = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const f   = (d - SPRING_L) * SPRING_K;
      const fx  = (dx / d) * f;
      const fy  = (dy / d) * f;
      s.vx += fx;  s.vy += fy;
      t.vx -= fx;  t.vy -= fy;
    });

    // Gravity toward center
    nodes.forEach(nd => {
      nd.vx += (cx - nd.x) * GRAVITY;
      nd.vy += (cy - nd.y) * GRAVITY;
    });

    // Integrate + damp + clamp
    nodes.forEach(nd => {
      nd.vx *= DAMP;  nd.vy *= DAMP;
      nd.x   = Math.max(PAD, Math.min(W - PAD, nd.x + nd.vx));
      nd.y   = Math.max(PAD, Math.min(H - PAD, nd.y + nd.vy));
    });
  }

  return nodes;
}

/* ─── draw the graph ─────────────────────────────────────────── */
function drawGraph(canvas, nodes, edges, evalData) {
  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.parentElement?.clientWidth || 800;

  canvas.width        = W   * dpr;
  canvas.height       = H   * dpr;
  canvas.style.width  = `${W}px`;
  canvas.style.height = `${H}px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, W, H);

  const byId = Object.fromEntries(nodes.map(nd => [nd.id, nd]));

  /* ── draw edges ── */
  edges.forEach(e => {
    const s = byId[e.source];
    const t = byId[e.target];
    if (!s || !t) return;

    const angle = Math.atan2(t.y - s.y, t.x - s.x);
    const ex    = t.x - (NODE_R + 4) * Math.cos(angle);
    const ey    = t.y - (NODE_R + 4) * Math.sin(angle);

    // Line
    ctx.save();
    ctx.strokeStyle = e.type === 'requires' ? 'rgba(99,102,241,0.45)' : 'rgba(148,163,184,0.45)';
    ctx.lineWidth   = e.type === 'requires' ? 2 : 1.5;
    ctx.setLineDash(e.type === 'requires' ? [] : [5, 4]);
    ctx.beginPath();
    ctx.moveTo(s.x, s.y);
    ctx.lineTo(ex, ey);
    ctx.stroke();

    // Arrowhead
    ctx.setLineDash([]);
    ctx.fillStyle = e.type === 'requires' ? 'rgba(99,102,241,0.7)' : 'rgba(148,163,184,0.7)';
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 10 * Math.cos(angle - 0.4), ey - 10 * Math.sin(angle - 0.4));
    ctx.lineTo(ex - 10 * Math.cos(angle + 0.4), ey - 10 * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });

  /* ── draw nodes ── */
  nodes.forEach(nd => {
    const style = getStyle(nd.name, evalData);

    // Glow
    ctx.save();
    ctx.shadowColor  = style.fill;
    ctx.shadowBlur   = 16;
    ctx.beginPath();
    ctx.arc(nd.x, nd.y, NODE_R, 0, 2 * Math.PI);
    ctx.fillStyle   = style.fill;
    ctx.strokeStyle = style.stroke;
    ctx.lineWidth   = 2.5;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Label below node
    ctx.save();
    ctx.font         = '600 10.5px Inter, system-ui, sans-serif';
    ctx.fillStyle    = '#374151';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';

    const maxW = 110;
    let lbl = nd.name;
    while (ctx.measureText(lbl + (lbl.length < nd.name.length ? '…' : '')).width > maxW && lbl.length > 3)
      lbl = lbl.slice(0, -1);
    if (lbl.length < nd.name.length) lbl += '…';

    ctx.fillText(lbl, nd.x, nd.y + NODE_R + 5);
    ctx.restore();
  });
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
const DependencyViewer = ({ dependencyData, evalData = {}, isLoading, error }) => {
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [tooltip, setTooltip] = useState(null);

  /* ── build layout when data or container width changes ── */
  const buildAndDraw = useCallback(() => {
    if (!dependencyData || !canvasRef.current || !containerRef.current) return;

    const W = containerRef.current.clientWidth || 800;

    // Collect all unique topic names:
    // Prefer recommendedOrder (includes ALL topics even unlinked ones)
    const nameSet = new Set(dependencyData.recommendedOrder || []);

    // Also add any names from relationships
    (dependencyData.relationships || []).forEach(r => {
      if (r.source) nameSet.add(r.source);
      if (r.target) nameSet.add(r.target);
    });

    // If still empty, fall back to graph nodes
    (dependencyData.graph?.nodes || []).forEach(nd => nameSet.add(nd.label || nd.id));

    const names = Array.from(nameSet).filter(Boolean);
    if (names.length === 0) return;

    const rawEdges = (dependencyData.relationships || []).map(r => ({
      source: r.source,
      target: r.target,
      type:   r.type || 'relates to',
    }));

    const laid = runForceLayout(names, rawEdges, W);
    setNodes(laid);
    setEdges(rawEdges);
  }, [dependencyData]);

  useEffect(() => {
    buildAndDraw();
  }, [buildAndDraw]);

  // Redraw when nodes/evalData change
  useEffect(() => {
    if (!canvasRef.current || nodes.length === 0) return;
    drawGraph(canvasRef.current, nodes, edges, evalData);
  }, [nodes, edges, evalData]);

  // Redraw on resize
  useEffect(() => {
    const obs = new ResizeObserver(() => buildAndDraw());
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [buildAndDraw]);

  /* ── mouse tooltip ── */
  const handleMouseMove = (e) => {
    if (!canvasRef.current || nodes.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = rect.width / (canvasRef.current.offsetWidth || rect.width);
    const mx = (e.clientX - rect.left) / scaleX;
    const my = (e.clientY - rect.top)  / scaleX;

    const hit = nodes.find(nd => {
      const dx = nd.x - mx, dy = nd.y - my;
      return Math.sqrt(dx * dx + dy * dy) <= NODE_R + 4;
    });
    if (hit) {
      const style = getStyle(hit.name, evalData);
      const ev    = evalData?.[hit.name];
      setTooltip({
        x: e.clientX - rect.left + 14,
        y: e.clientY - rect.top  - 10,
        name:   hit.name,
        rating: ev?.rating ?? 'Untested',
        score:  ev?.score  ?? null,
        fill:   style.fill,
      });
    } else {
      setTooltip(null);
    }
  };

  /* ── guard states ── */
  if (isLoading) return (
    <div style={{ textAlign: 'center', padding: '48px 32px' }}>
      <div className="t-spinner" style={{ margin: '0 auto 14px' }} />
      <p style={{ fontWeight: 600, color: '#6b7280' }}>Ollama is mapping topic dependencies…</p>
    </div>
  );

  if (error) return <div className="t-alert t-alert-error">{error}</div>;

  if (!dependencyData) return (
    <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af' }}>
      <p style={{ fontWeight: 600, marginBottom: 6 }}>No dependency data yet</p>
      <p style={{ fontSize: '0.85rem' }}>Dependency graph is generated when you upload a syllabus.</p>
    </div>
  );

  const hasRelationships = (dependencyData.relationships || []).length > 0;

  return (
    <div>
      {/* Graph canvas */}
      <div
        ref={containerRef}
        style={{ position: 'relative', borderRadius: 12, overflow: 'hidden',
                 border: '1.5px solid #e2e8f0', background: '#fafbff', width: '100%' }}
      >
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
          style={{ display: 'block', cursor: 'crosshair', width: '100%' }}
        />

        {/* No edges notice (overlay) */}
        {!hasRelationships && nodes.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
            background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 8, padding: '6px 14px', fontSize: '0.78rem', color: '#6366f1', fontWeight: 600,
            pointerEvents: 'none',
          }}>
            No prerequisite links found — all topics shown as standalone nodes
          </div>
        )}

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute', left: tooltip.x, top: tooltip.y,
            background: '#0f172a', color: '#fff', borderRadius: 8,
            padding: '8px 12px', fontSize: '0.82rem', pointerEvents: 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 10,
            borderLeft: `4px solid ${tooltip.fill}`, maxWidth: 220,
          }}>
            <p style={{ fontWeight: 700, marginBottom: 2 }}>{tooltip.name}</p>
            <p style={{ color: tooltip.fill, fontWeight: 600, textTransform: 'capitalize' }}>{tooltip.rating}</p>
            {tooltip.score !== null && (
              <p style={{ color: '#94a3b8', marginTop: 2 }}>Score: {Math.round(tooltip.score)}%</p>
            )}
          </div>
        )}
      </div>

      {/* Recommended study order */}
      {(dependencyData.recommendedOrder?.length > 0) && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            Recommended Study Order
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
            {dependencyData.recommendedOrder.map((topic, i) => {
              const style = getStyle(topic, evalData);
              return (
                <React.Fragment key={topic}>
                  <span style={{
                    padding: '4px 12px', borderRadius: 999,
                    background: `${style.fill}18`,
                    border: `1.5px solid ${style.fill}55`,
                    color: style.fill === '#cbd5e1' ? '#374151' : style.fill,
                    fontSize: '0.78rem', fontWeight: 700,
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
