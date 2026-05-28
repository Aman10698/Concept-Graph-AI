import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import StreakPanel from '../components/StreakPanel';
import '../pages/KnowledgeGraphPage.css';

/* ─── Rating helpers ────────────────────────────────────── */
function getRatingStyle(rating) {
  switch (rating) {
    case 'strong':  return { badge: '#22c55e', badgeBg: '#f0fdf4', bar: '#22c55e', border: '#86efac', nodeIcon: '#f0fdf4' };
    case 'partial': case 'moderate': return { badge: '#f59e0b', badgeBg: '#fffbeb', bar: '#f59e0b', border: '#fcd34d', nodeIcon: '#fffbeb' };
    case 'weak':    return { badge: '#ef4444', badgeBg: '#fef2f2', bar: '#ef4444', border: '#fca5a5', nodeIcon: '#fef2f2' };
    default:        return { badge: '#9ca3af', badgeBg: '#f9fafb', bar: '#e2e8f0', border: '#e2e8f0', nodeIcon: '#f9fafb' };
  }
}

function getRatingLabel(rating) {
  switch (rating) {
    case 'strong':  return 'Strong';
    case 'partial': case 'moderate': return 'Partial';
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
    'descriptive statistics': '📈', 'data': '💾',
  };
  const lower = (name || '').toLowerCase();
  for (const [k, v] of Object.entries(icons)) {
    if (lower.includes(k)) return v;
  }
  return TOPIC_ICONS[idx % TOPIC_ICONS.length];
}

/* ── Concept Node Card ────────────────────────────────────── */
function ConceptNode({ name, rating, confidence, isRoot = false, onClick, idx = 0 }) {
  const s = getRatingStyle(rating);
  const label = getRatingLabel(rating);
  const icon = topicIcon(name, idx);
  const pct = rating === 'strong' ? (confidence || 85)
            : rating === 'partial' || rating === 'moderate' ? (confidence || 55)
            : rating === 'weak' ? (confidence || 25)
            : 0;

  return (
    <div
      className={`kg-node${isRoot ? ' kg-node-root' : ''}`}
      style={{ borderColor: isRoot ? '#7c3aed' : s.border, minWidth: 170 }}
      onClick={() => onClick && onClick(name)}
    >
      <div className="kg-node-header">
        <div className="kg-node-icon" style={{ background: isRoot ? '#f5f3ff' : s.nodeIcon, fontSize: '1rem' }}>
          {icon}
        </div>
        <div className="kg-node-title">{name}</div>
        <button className="kg-node-more" onClick={e => e.stopPropagation()}>⋮</button>
      </div>

      {!isRoot && (
        <span className="kg-node-badge" style={{ background: s.badgeBg, color: s.badge }}>
          {label}
        </span>
      )}
      {isRoot && (
        <span className="kg-node-badge" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
          Root Concept
        </span>
      )}

      <div className="kg-node-bar-bg">
        <div className="kg-node-bar-fill" style={{ width: `${pct}%`, background: isRoot ? '#7c3aed' : s.bar }} />
      </div>
      <div className="kg-node-pct">{pct}%</div>
    </div>
  );
}

/* ── SVG connector arrows ────────────────────────────────── */
function Connector({ dashed = false, color = '#9ca3af' }) {
  return (
    <svg width="24" height="32" style={{ flexShrink: 0 }}>
      <defs>
        <marker id={`arr${dashed ? 'd' : 's'}`} markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill={color} opacity="0.6" />
        </marker>
      </defs>
      <line x1="12" y1="0" x2="12" y2="26"
        stroke={color} strokeWidth="1.5" opacity="0.6"
        strokeDasharray={dashed ? '4 3' : undefined}
        markerEnd={`url(#arr${dashed ? 'd' : 's'})`}
      />
    </svg>
  );
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

  const topics = useMemo(() => topicsData?.topics ?? [], [topicsData]);
  const subject = topicsData?.subject || 'Your Subject';
  const getName = t => typeof t === 'string' ? t : t.name;

  const topicsMapped = useMemo(() => {
    return topics.map((t, i) => {
      const name = getName(t);
      const ev   = evaluationData[name];
      return {
        name,
        rating:     ev?.rating || null,
        confidence: ev?.confidence || ev?.score || 0,
        subtopics:  typeof t === 'object' ? (t.subtopics || []) : [],
        idx: i,
      };
    });
  }, [topics, evaluationData]);

  /* Level 1 topics (up to 3 shown prominently) */
  const level1 = topicsMapped.slice(0, 3);
  /* Level 2 topics (next 3) */
  const level2 = topicsMapped.slice(3, 6);
  /* Level 3 (remaining up to 3) */
  const level3 = topicsMapped.slice(6, 9);

  /* Recent activity from eval data */
  const recentActivity = useMemo(() => {
    return Object.entries(evaluationData)
      .slice(0, 3)
      .map(([name, ev]) => ({
        name,
        type: ev.rating === 'strong' ? 'quiz'
            : ev.rating === 'partial' ? 'video'
            : 'practice',
        score: ev.confidence || ev.score || 0,
      }));
  }, [evaluationData]);

  const activityIcons = {
    quiz:     { bg: '#f0fdf4', icon: '✅' },
    video:    { bg: '#eff6ff', icon: '▶️' },
    practice: { bg: '#fefce8', icon: '⭐' },
  };

  /* If no topics yet, show wizard content */
  if (!topicsData || topics.length === 0) {
    return (
      <div className="kg-page">
        <div className="kg-center">
          {/* toolbar */}
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
            <button className="kg-filter-btn">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/></svg>
              Filter
            </button>
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
          <button className="kg-filter-btn">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22,3 2,3 10,12.46 10,19 14,21 14,12.46"/></svg>
            Filter
          </button>
          <div className="kg-view-select">
            View: Mastery
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6,9 12,15 18,9"/></svg>
          </div>
        </div>

        {/* Graph Area */}
        <div className="kg-graph-area" style={{ overflowY: 'auto' }}>
          <div style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s',
            minWidth: 600,
          }}>
            {/* Layout: hierarchical tree */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, paddingTop: 8 }}>
              {/* Root node */}
              <ConceptNode
                name={subject}
                rating={null}
                confidence={topicsMapped.filter(t => t.rating === 'strong').length / Math.max(topicsMapped.length, 1) * 100}
                isRoot={true}
                onClick={() => {}}
                idx={-1}
              />

              {/* connector down */}
              {level1.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <Connector color="#7c3aed" />
                </div>
              )}

              {/* Level 1 topics */}
              {level1.length > 0 && (
                <>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
                    {level1.map((t, i) => (
                      <ConceptNode
                        key={t.name}
                        name={t.name}
                        rating={t.rating}
                        confidence={t.confidence}
                        onClick={onNodeClick}
                        idx={t.idx}
                      />
                    ))}
                  </div>

                  {/* connectors between L1 and L2 */}
                  {level2.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: level1.length > 1 ? 186 : 0, width: '100%' }}>
                      {level1.slice(0, Math.min(level1.length, level2.length)).map((_, i) => (
                        <Connector key={i} dashed={i === 1} color="#9ca3af" />
                      ))}
                    </div>
                  )}

                  {/* Level 2 topics */}
                  {level2.length > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {level2.map((t, i) => (
                          <ConceptNode
                            key={t.name}
                            name={t.name}
                            rating={t.rating}
                            confidence={t.confidence}
                            onClick={onNodeClick}
                            idx={t.idx}
                          />
                        ))}
                      </div>

                      {/* connectors to L3 */}
                      {level3.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginRight: 8 }}>
                          <Connector color="#ef4444" />
                        </div>
                      )}

                      {/* Level 3 */}
                      {level3.length > 0 && (
                        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>
                          {level3.map((t) => (
                            <ConceptNode
                              key={t.name}
                              name={t.name}
                              rating={t.rating}
                              confidence={t.confidence}
                              onClick={onNodeClick}
                              idx={t.idx}
                            />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Remaining topics (overflow) */}
              {topicsMapped.length > 9 && (
                <div style={{ marginTop: 16, padding: '10px 16px', background: '#f5f3ff', borderRadius: 10, border: '1px dashed #ddd6fe', fontSize: '0.78rem', color: '#7c3aed', fontWeight: 600 }}>
                  +{topicsMapped.length - 9} more topics — scroll down or zoom out to see all
                </div>
              )}
            </div>
          </div>



          {/* Reset button */}
          {completedSteps && completedSteps.size > 0 && onReset && (
            <div style={{ position: 'absolute', top: 12, right: 12 }}>
              <button
                onClick={onReset}
                style={{
                  padding: '6px 14px', borderRadius: 8, border: '1px solid #eef0f6',
                  background: '#fff', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                }}
                onMouseOver={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
                onMouseOut={e => { e.currentTarget.style.borderColor = '#eef0f6'; e.currentTarget.style.color = '#6b7280'; }}
              >
                Start Over
              </button>
            </div>
          )}
        </div>

        {/* Recent Activity bar */}
        <div className="kg-activity-bar">
          <div className="kg-activity-header">
            <span className="kg-activity-title">Recent Activity</span>
            <Link to="/practice" className="kg-activity-link">
              View All Activity
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>
            </Link>
          </div>

          <div className="kg-activity-items">
            {recentActivity.length > 0 ? recentActivity.map((item, i) => {
              const ai = activityIcons[item.type] || activityIcons.practice;
              const timeAgo = i === 0 ? '2h ago' : i === 1 ? '1d ago' : '2d ago';
              const actionText = item.type === 'quiz'    ? `Scored ${item.score}% in quiz on`
                               : item.type === 'video'   ? `Watched video on`
                               : `Solved ${item.score > 0 ? Math.ceil(item.score / 10) : 3} questions on`;
              return (
                <div key={i} className="kg-activity-item">
                  <div className="kg-activity-icon" style={{ background: ai.bg }}>{ai.icon}</div>
                  <div>
                    <div className="kg-activity-text">{actionText} <strong>{item.name}</strong></div>
                    <div className="kg-activity-time">{timeAgo}</div>
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
