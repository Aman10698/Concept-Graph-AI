import React, { useState } from 'react';


const DIFF_META = {
  beginner:     { badge: 't-badge-green',  label: 'Beginner',     color: '#22c55e' },
  intermediate: { badge: 't-badge-amber',  label: 'Intermediate', color: '#f59e0b' },
  advanced:     { badge: 't-badge-red',    label: 'Advanced',     color: '#ef4444' },
};

/* ── stat pill ──────────────────────────────────────────────── */
const StatPill = ({ label, value, color, bg }) => (
  <div style={{
    flex: 1, minWidth: 100,
    background: bg, borderRadius: 12,
    border: `1.5px solid ${color}22`,
    borderLeft: `4px solid ${color}`,
    padding: '14px 18px',
  }}>
    <p style={{ fontSize: '0.72rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</p>
    <p style={{ fontSize: '2rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</p>
  </div>
);

/* ── main component ─────────────────────────────────────────── */
const QuestionsDisplay = ({ questionsData, isLoading, error }) => {
  const [expandedIds, setExpandedIds]         = useState(new Set());
  const [filterType, setFilterType]           = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');

  /* ── guard states ── */
  if (isLoading) {
    return (
      <div className="t-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
        <div className="t-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Generating questions with AI…</p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>This may take a few seconds</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="t-alert t-alert-error">
        <p style={{ fontWeight: 700, marginBottom: 4 }}>Failed to load questions</p>
        <p style={{ fontSize: '0.88rem' }}>{error}</p>
      </div>
    );
  }

  if (!questionsData?.questions?.length) {
    return (
      <div className="t-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No questions to display yet.</p>
      </div>
    );
  }

  const toggle = (id) => setExpandedIds(prev => {
    const s = new Set(prev);
    s.has(id) ? s.delete(id) : s.add(id);
    return s;
  });

  const filtered = questionsData.questions.filter(q => {
    const tOk = filterType === 'all'       || q.type === filterType;
    const dOk = filterDifficulty === 'all' || q.difficulty === filterDifficulty;
    return tOk && dOk;
  });

  const stats       = questionsData.stats       ?? {};
  const grouped     = questionsData.grouped     ?? { byType: {}, byDifficulty: {} };
  const types       = Object.keys(grouped.byType ?? {});
  const diffs       = Object.keys(grouped.byDifficulty ?? {});

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Stats row ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <StatPill label="Total Questions"   value={stats.total ?? questionsData.questions.length} color="#3b82f6" bg="rgba(59,130,246,0.06)"  />
        <StatPill label="Question Types"    value={types.length}                                  color="#8b5cf6" bg="rgba(139,92,246,0.06)"   />
        <StatPill label="Difficulty Levels" value={diffs.length}                                  color="#6366f1" bg="rgba(99,102,241,0.06)"   />
        <StatPill label="Showing"           value={filtered.length}                               color="#f59e0b" bg="rgba(245,158,11,0.06)"   />
      </div>

      {/* ── Filter bar ── */}
      <div className="t-card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="t-label" style={{ marginBottom: 6 }}>Filter by Type</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="t-select"
              style={{ width: '100%' }}
            >
              <option value="all">All Types</option>
              {types.map(t => (
                <option key={t} value={t}>{t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="t-label" style={{ marginBottom: 6 }}>Filter by Difficulty</label>
            <select
              value={filterDifficulty}
              onChange={e => setFilterDifficulty(e.target.value)}
              className="t-select"
              style={{ width: '100%' }}
            >
              <option value="all">All Levels</option>
              {diffs.map(d => (
                <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
              ))}
            </select>
          </div>
          {(filterType !== 'all' || filterDifficulty !== 'all') && (
            <button
              onClick={() => { setFilterType('all'); setFilterDifficulty('all'); }}
              className="t-btn t-btn-ghost t-btn-sm"
              style={{ alignSelf: 'flex-end' }}
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Questions list ── */}
      {filtered.length === 0 ? (
        <div className="t-card" style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: 12 }}>No questions match the selected filters.</p>
          <button onClick={() => { setFilterType('all'); setFilterDifficulty('all'); }} className="t-btn t-btn-ghost t-btn-sm">
            Clear Filters
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((q, i) => {
            const diff     = DIFF_META[q.difficulty] ?? { badge: 't-badge-gray', label: q.difficulty, color: '#9ca3af' };
            const expanded = expandedIds.has(q.id ?? i);

            return (
              <div
                key={q.id ?? i}
                className="t-card"
                style={{
                  padding: 0, overflow: 'hidden',
                  transition: 'box-shadow 0.18s',
                }}
              >
                {/* question header — clickable */}
                <button
                  onClick={() => toggle(q.id ?? i)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '16px 20px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    fontFamily: 'inherit',
                  }}
                >
                  {/* body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* question text */}
                    <p style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)', lineHeight: 1.55, marginBottom: 8 }}>
                      <span style={{ color: '#6366f1', fontWeight: 700, marginRight: 6 }}>Q{i + 1}.</span>
                      {q.question}
                    </p>

                    {/* badges row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      <span className="t-badge t-badge-gray">{(q.type ?? 'general').replace(/-/g, ' ')}</span>
                      <span className={`t-badge ${diff.badge}`}>{diff.label}</span>
                      {q.topic && <span className="t-badge t-badge-blue">{q.topic}</span>}
                      {q.source === 'ollama' && <span className="t-badge t-badge-purple">AI</span>}
                    </div>
                  </div>

                  {/* chevron */}
                  <span style={{
                    fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, marginTop: 4,
                    transition: 'transform 0.2s', transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
                  }}>▶</span>
                </button>

                {/* expanded panel */}
                {expanded && (
                  <div style={{
                    borderTop: '1px solid rgba(99,102,241,0.1)',
                    background: 'rgba(248,250,255,0.8)',
                    padding: '16px 20px',
                    display: 'flex', flexDirection: 'column', gap: 12,
                  }}>
                    {/* context tags */}
                    {(q.parentTopic || q.relatedTopic) && (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {q.parentTopic  && <span className="t-badge t-badge-blue">{q.parentTopic}</span>}
                        {q.relatedTopic && <span className="t-badge t-badge-purple">{q.relatedTopic}</span>}
                      </div>
                    )}

                    {/* suggested approach */}
                    <div className="t-alert t-alert-info" style={{ borderLeft: '4px solid #3b82f6' }}>
                      <p style={{ fontWeight: 700, fontSize: '0.8rem', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Suggested Approach
                      </p>
                      <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.865rem' }}>
                        <li>Consider multiple perspectives and examples</li>
                        <li>Reference relevant concepts and theories</li>
                        <li>Provide detailed explanations and reasoning</li>
                        <li>Connect to real-world applications</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default QuestionsDisplay;
