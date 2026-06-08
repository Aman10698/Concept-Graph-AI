import React, { useState, useMemo, useRef, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';
import StreakPanel from '../components/StreakPanel';
import '../pages/KnowledgeGraphPage.css';

/* ─── Rating helpers ────────────────────────────────────── */
function getRatingStyle(rating) {
  switch (rating) {
    case 'strong':
      return { badge: '#22c55e', badgeBg: '#f0fdf4', bar: '#22c55e', border: '#86efac', nodeIcon: '#f0fdf4' };
    case 'partial':
    case 'moderate':
      return { badge: '#f59e0b', badgeBg: '#fffbeb', bar: '#f59e0b', border: '#fcd34d', nodeIcon: '#fffbeb' };
    case 'weak':
      return { badge: '#ef4444', badgeBg: '#fef2f2', bar: '#ef4444', border: '#fca5a5', nodeIcon: '#fef2f2' };
    default:
      return { badge: '#9ca3af', badgeBg: '#f9fafb', bar: '#e2e8f0', border: '#e2e8f0', nodeIcon: '#f9fafb' };
  }
}

function getRatingLabel(rating) {
  switch (rating) {
    case 'strong':  return 'Strong';
    case 'partial':
    case 'moderate': return 'Partial';
    case 'weak':    return 'Weak';
    default:        return 'Not Started';
  }
}

/* ── Topic icons ─────────────────────────────────────────── */
const TOPIC_ICONS = [
  '🔢', '📊', '💻', '∫', '📈', '🧮', '🎯', '🔬', '⚡', '🌐',
  '📐', '🧪', '🎲', '🔮', '💡', '🧠', '📚', '🔑', '🌊', '🎨',
];

function topicIcon(name, idx) {
  const icons = {
    'machine learning': '🤖', 'linear algebra': '🔢', 'probability': '📊',
    'statistics': '📊', 'python': '💻', 'calculus': '∫', 'numpy': '📦',
    'pandas': '🐼', 'neural': '🧠', 'deep learning': '🧠',
    'descriptive statistics': '📈', 'data': '💾', 'cloud': '☁️',
    'virtualization': '🖥️', 'network': '🌐', 'security': '🔒',
    'database': '🗄️', 'algorithm': '⚙️', 'software': '💾',
  };
  const lower = (name || '').toLowerCase();
  for (const [k, v] of Object.entries(icons)) {
    if (lower.includes(k)) return v;
  }
  return TOPIC_ICONS[idx % TOPIC_ICONS.length];
}

/* ── Compute module coverage % (topics practised / total) ── */
function getModuleProgress(topicObj, evaluationData) {
  const getName = t => (typeof t === 'string' ? t : t.name);
  const name    = getName(topicObj);

  const subtopics = (typeof topicObj === 'object' && Array.isArray(topicObj.subtopics))
    ? topicObj.subtopics.map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean)
    : [];

  if (subtopics.length === 0) {
    // No subtopics — module itself counts as 1 topic: 100% if practised, 0% if not
    return evaluationData[name] ? 100 : 0;
  }

  // Count how many subtopics (+ the module itself) have been practised
  const allNodes   = [name, ...subtopics];
  const practised  = allNodes.filter(n => !!evaluationData[n]).length;
  return Math.round((practised / allNodes.length) * 100);
}

/* ── Concept Node Card ──────────────────────────────────── */
function ConceptNode({ name, rating, pct, isRoot = false, onClick, idx = 0, nodeRef }) {
  const s    = getRatingStyle(rating);
  const label = getRatingLabel(rating);
  const icon  = topicIcon(name, idx);
  const progressColor = isRoot ? '#7c3aed' : s.bar;

  return (
    <div
      ref={nodeRef}
      className={`kg-node${isRoot ? ' kg-node-root' : ''}`}
      style={{ borderColor: isRoot ? '#7c3aed' : s.border, width: isRoot ? 200 : 190 }}
      onClick={() => onClick && !isRoot && onClick(name)}
    >
      <div className="kg-node-header">
        <div className="kg-node-icon" style={{ background: isRoot ? '#f5f3ff' : s.nodeIcon, fontSize: '1rem' }}>
          {icon}
        </div>
        <div className="kg-node-title">{name}</div>
        {!isRoot && (
          <button className="kg-node-more" onClick={e => e.stopPropagation()}>⋮</button>
        )}
      </div>

      {isRoot ? (
        <span className="kg-node-badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
          Root Concept
        </span>
      ) : (
        <span className="kg-node-badge" style={{ background: s.badgeBg, color: s.badge }}>
          {label}
        </span>
      )}

      <div className="kg-node-bar-bg">
        <div
          className="kg-node-bar-fill"
          style={{ width: `${pct}%`, background: progressColor }}
        />
      </div>
      <div className="kg-node-pct">{Math.round(pct)}%</div>
    </div>
  );
}

/* ── Fan-out Tree with SVG connector lines ──────────────── */
function TreeGraph({ subject, topics, evaluationData, onNodeClick }) {
  const rootRef = useRef(null);
  const childRefs = useRef([]);
  const containerRef = useRef(null);
  const [lines, setLines] = useState([]);

  // Compute per-module progress
  const moduleData = useMemo(() => topics.map((t, i) => {
    const name   = typeof t === 'string' ? t : t.name;
    const ev     = evaluationData[name];
    const rating = ev?.rating || null;
    const pct    = getModuleProgress(t, evaluationData);
    return { name, rating, pct, idx: i, topic: t };
  }), [topics, evaluationData]);

  // Root progress = average coverage across all modules
  const rootPct = useMemo(() => {
    if (topics.length === 0) return 0;
    const total = topics.reduce((s, t) => s + getModuleProgress(t, evaluationData), 0);
    return Math.round(total / topics.length);
  }, [topics, evaluationData]);

  // Recompute SVG connector lines after render
  useLayoutEffect(() => {
    const compute = () => {
      if (!rootRef.current || !containerRef.current) return;
      const container = containerRef.current.getBoundingClientRect();
      const root      = rootRef.current.getBoundingClientRect();

      const rootX = root.left + root.width / 2  - container.left;
      const rootY = root.bottom - container.top;

      const newLines = childRefs.current.map(ref => {
        if (!ref) return null;
        const child = ref.getBoundingClientRect();
        const cx    = child.left + child.width / 2 - container.left;
        const cy    = child.top  - container.top;
        return { x1: rootX, y1: rootY, x2: cx, y2: cy };
      }).filter(Boolean);

      setLines(newLines);
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [moduleData.length]);

  const GAP_Y = 80; // vertical gap between root bottom and children top

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, paddingBottom: 24 }}
    >
      {/* SVG for connector lines — drawn over the layout */}
      <svg
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none', overflow: 'visible', zIndex: 0,
        }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#c4b5fd" opacity="0.8" />
          </marker>
        </defs>
        {lines.map((l, i) => (
          <path
            key={i}
            d={`M ${l.x1} ${l.y1} C ${l.x1} ${l.y1 + GAP_Y * 0.55}, ${l.x2} ${l.y2 - GAP_Y * 0.55}, ${l.x2} ${l.y2}`}
            fill="none"
            stroke="#c4b5fd"
            strokeWidth="1.8"
            strokeDasharray={i > 0 ? '5 3' : undefined}
            opacity="0.85"
            markerEnd="url(#arrowhead)"
          />
        ))}
      </svg>

      {/* Root node */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: GAP_Y }}>
        <ConceptNode
          nodeRef={rootRef}
          name={subject}
          rating={null}
          pct={rootPct}
          isRoot={true}
          idx={-1}
        />
      </div>

      {/* Children row — all modules at same level */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        justifyContent: 'center',
        position: 'relative',
        zIndex: 1,
      }}>
        {moduleData.map((m, i) => (
          <ConceptNode
            key={m.name}
            nodeRef={el => { childRefs.current[i] = el; }}
            name={m.name}
            rating={m.rating}
            pct={m.pct}
            isRoot={false}
            onClick={onNodeClick}
            idx={m.idx}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Time-ago helper ────────────────────────────────────── */
function timeAgoStr(ts) {
  if (!ts) return 'Recently';
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return 'Just now';
  if (mins < 60)  return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)   return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)   return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

/* ── Main Knowledge Graph View ───────────────────────────── */
export default function KnowledgeGraphView({
  topicsData,
  evaluationData,
  onNodeClick,
  onReset,
  completedSteps,
  wizardChildren,
}) {
  const [scale, setScale] = useState(1);

  const topics  = useMemo(() => topicsData?.topics ?? [], [topicsData]);
  const subject = topicsData?.subject || 'Your Subject';

  /* Recent activity — sorted by real practicedAt, most recent first */
  const recentActivity = useMemo(() => {
    return Object.entries(evaluationData)
      .filter(([, ev]) => ev.rating)
      .sort(([, a], [, b]) => (b.practicedAt || 0) - (a.practicedAt || 0))
      .slice(0, 4)
      .map(([name, ev]) => ({
        name,
        rating:      ev.rating,
        score:       ev.score ?? ev.confidence ?? 0,
        practicedAt: ev.practicedAt,
      }));
  }, [evaluationData]);

  /* If no topics yet, show wizard content */
  if (!topicsData || topics.length === 0) {
    return (
      <div className="kg-page">
        <div className="kg-center">
          <div className="kg-toolbar">
            <button className="kg-toolbar-btn" onClick={() => setScale(1)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
              Fit View
            </button>
            <button className="kg-toolbar-btn" onClick={() => setScale(s => Math.min(s + 0.1, 2))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              Zoom In
            </button>
            <button className="kg-toolbar-btn" onClick={() => setScale(s => Math.max(s - 0.1, 0.4))}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
              Zoom Out
            </button>
            <div className="kg-toolbar-sep" />
            <div className="kg-view-select">
              View: Mastery
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>
            </div>
          </div>
          <div className="kg-wizard-wrap" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
            {wizardChildren}
          </div>
        </div>
        <StreakPanel evalData={evaluationData} topicsData={topicsData} />
      </div>
    );
  }

  return (
    <div className="kg-page">
      {/* ── Center Column ── */}
      <div className="kg-center">
        {/* Toolbar */}
        <div className="kg-toolbar">
          <button className="kg-toolbar-btn" onClick={() => setScale(1)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            Fit View
          </button>
          <button className="kg-toolbar-btn" onClick={() => setScale(s => Math.min(s + 0.1, 2))}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            Zoom In
          </button>
          <button className="kg-toolbar-btn" onClick={() => setScale(s => Math.max(s - 0.1, 0.4))}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            Zoom Out
          </button>
          <div className="kg-toolbar-sep" />
          <div className="kg-view-select">
            View: Mastery
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>
          </div>
          {/* Reset button */}
          {completedSteps && completedSteps.size > 0 && onReset && (
            <button
              onClick={onReset}
              style={{
                marginLeft: 'auto',
                padding: '6px 14px', borderRadius: 8, border: '1px solid #eef0f6',
                background: '#fff', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
              onMouseOut={e => { e.currentTarget.style.borderColor = '#eef0f6'; e.currentTarget.style.color = '#6b7280'; }}
            >
              Start Over
            </button>
          )}
        </div>

        {/* Graph Area */}
        <div className="kg-graph-area" style={{ overflowY: 'auto' }}>
          <div style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s',
            minWidth: 600,
            padding: '12px 24px 24px',
          }}>
            <TreeGraph
              subject={subject}
              topics={topics}
              evaluationData={evaluationData}
              onNodeClick={onNodeClick}
            />
          </div>
        </div>

        {/* Recent Activity bar */}
        <div className="kg-activity-bar">
          <div className="kg-activity-header">
            <span className="kg-activity-title">Recent Activity</span>
            <Link to="/practice" className="kg-activity-link">
              View All →
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>
            </Link>
          </div>

          <div className="kg-activity-items">
            {recentActivity.length > 0 ? recentActivity.map((item, i) => {
              const color = item.score >= 70 ? '#22c55e' : item.score >= 40 ? '#f59e0b' : '#ef4444';
              const bg    = item.score >= 70 ? '#f0fdf4' : item.score >= 40 ? '#fffbeb' : '#fef2f2';
              const icon  = item.rating === 'strong' ? '✅' : item.rating === 'weak' ? '⚠️' : '📊';
              const action = item.rating === 'strong' ? 'Mastered'
                           : item.rating === 'partial' || item.rating === 'moderate' ? 'In Progress'
                           : item.rating === 'weak' ? 'Needs Work' : 'Practised';
              return (
                <div key={i} className="kg-activity-item">
                  <div className="kg-activity-icon" style={{ background: bg }}>{icon}</div>
                  <div>
                    <div className="kg-activity-text">
                      {action} — <strong>{item.name}</strong>
                      {item.score > 0 && (
                        <span style={{ marginLeft: 6, fontWeight: 700, color }}>{item.score}%</span>
                      )}
                    </div>
                    <div className="kg-activity-time">{timeAgoStr(item.practicedAt)}</div>
                  </div>
                </div>
              );
            }) : (
              <div style={{ fontSize: '0.78rem', color: '#9ca3af', textAlign: 'center', flex: 1, padding: '4px 0' }}>
                No activity yet — click a node to start a quiz!
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <StreakPanel evalData={evaluationData} topicsData={topicsData} />
    </div>
  );
}
