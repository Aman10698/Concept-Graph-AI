import React from 'react';

/**
 * WeaknessTraceViewer — displays Ollama root-cause analysis results.
 * Ollama schema: { weakTopic, rootCause, prerequisites[], studyPlan[], estimatedRevisionTime, relatedWeakAreas[] }
 * Also handles legacy rule-based schema: { weakTopic, weakestConcept, path[], recommendations[] }
 */
const WeaknessTraceViewer = ({ weaknessTrace, isLoading, error }) => {

  if (isLoading) {
    return (
      <div className="t-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
        <div className="t-spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
          Analysing root cause with AI…
        </p>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>
          This may take 20–60 seconds
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="t-alert t-alert-error">
        <p style={{ fontWeight: 700, marginBottom: 4 }}>Analysis failed</p>
        <p style={{ fontSize: '0.88rem' }}>{error}</p>
      </div>
    );
  }

  if (!weaknessTrace) {
    return (
      <div className="t-alert t-alert-info">
        Select a topic above to run AI root-cause analysis.
      </div>
    );
  }

  // ── Normalise both schemas ────────────────────────────────────────────
  // Ollama returns: rootCause, prerequisites[], studyPlan[], estimatedRevisionTime, relatedWeakAreas[]
  // Rule-based returns: weakTopic, weakestConcept, path[], recommendations[]
  const weakTopic   = weaknessTrace.weakTopic   || weaknessTrace.topic || '';
  const rootCause   = weaknessTrace.rootCause   || weaknessTrace.weakestConcept || '';
  const prerequisites = Array.isArray(weaknessTrace.prerequisites) ? weaknessTrace.prerequisites : [];
  const studyPlan   = Array.isArray(weaknessTrace.studyPlan)       ? weaknessTrace.studyPlan : [];
  const revisionTime = weaknessTrace.estimatedRevisionTime || null;
  const relatedWeak  = Array.isArray(weaknessTrace.relatedWeakAreas) ? weaknessTrace.relatedWeakAreas : [];

  // Priority colour helper
  const priorityColor = (p) => {
    if (p === 'high')   return { bg: 'rgba(239,68,68,0.08)',  border: '#ef4444', badge: 'ef4444', text: '#991b1b'  };
    if (p === 'medium') return { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', badge: 'f59e0b', text: '#92400e' };
    return               { bg: 'rgba(34,197,94,0.08)',  border: '#22c55e', badge: '22c55e', text: '#166534' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Root Cause Banner ── */}
      {rootCause && (
        <div style={{
          background: 'rgba(239,68,68,0.06)',
          border: '1.5px solid rgba(239,68,68,0.3)',
          borderLeft: '4px solid #ef4444',
          borderRadius: 12, padding: '18px 20px',
        }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Root Cause Identified
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.6 }}>
            {rootCause}
          </p>
          {weakTopic && (
            <p style={{ fontSize: '0.83rem', color: '#6b7280', marginTop: 8 }}>
              Topic analysed: <strong style={{ color: '#ef4444' }}>{weakTopic}</strong>
            </p>
          )}
        </div>
      )}

      {/* ── Revision Estimate + Related Weak Areas ── */}
      {(revisionTime || relatedWeak.length > 0) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {revisionTime && (
            <div className="t-card" style={{
              flex: 1, minWidth: 160, padding: '14px 18px',
              borderLeft: '4px solid #6366f1',
            }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                Estimated Study Time
              </p>
              <p style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a' }}>{revisionTime}</p>
            </div>
          )}
          {relatedWeak.length > 0 && (
            <div className="t-card" style={{ flex: 2, minWidth: 180, padding: '14px 18px' }}>
              <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Related Weak Areas
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {relatedWeak.map((a, i) => (
                  <span key={i} className="t-badge t-badge-amber">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Prerequisite Gaps ── */}
      {prerequisites.length > 0 && (
        <div className="t-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
            Prerequisite Concepts to Master ({prerequisites.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {prerequisites.map((p, i) => {
              const concept = typeof p === 'string' ? p : p.concept || '';
              const why     = typeof p === 'object' ? p.why     : '';
              const prio    = typeof p === 'object' ? p.priority : 'medium';
              const c = priorityColor(prio);
              return (
                <div key={i} style={{
                  background: c.bg,
                  border: `1.5px solid ${c.border}33`,
                  borderLeft: `4px solid ${c.border}`,
                  borderRadius: 10, padding: '14px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: `#${c.badge}22`, display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.78rem', fontWeight: 800, color: c.text,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: why ? 4 : 0 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{concept}</p>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px',
                        borderRadius: 999, background: `#${c.badge}22`, color: c.text,
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                      }}>{prio}</span>
                    </div>
                    {why && (
                      <p style={{ fontSize: '0.83rem', color: '#6b7280', lineHeight: 1.5 }}>{why}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Study Plan ── */}
      {studyPlan.length > 0 && (
        <div className="t-card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a', marginBottom: 16 }}>
            Step-by-Step Study Plan
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {studyPlan.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.78rem', fontWeight: 800, color: '#fff',
                }}>{i + 1}</div>
                <div style={{
                  flex: 1, padding: '10px 14px',
                  background: 'rgba(99,102,241,0.04)',
                  border: '1px solid rgba(99,102,241,0.12)',
                  borderRadius: 9,
                }}>
                  <p style={{ fontSize: '0.88rem', fontWeight: 500, color: '#374151', lineHeight: 1.55 }}>
                    {step}
                  </p>
                </div>
                {i < studyPlan.length - 1 && (
                  <div style={{ width: 28, display: 'flex', justifyContent: 'center', paddingTop: 32, color: '#d1d5db', fontSize: '1rem' }}>↓</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Fallback: nothing useful returned ── */}
      {!rootCause && prerequisites.length === 0 && studyPlan.length === 0 && (
        <div className="t-alert t-alert-warning">
          AI analysis returned no details. Try selecting a different topic or check that Ollama is running.
        </div>
      )}
    </div>
  );
};

export default WeaknessTraceViewer;
