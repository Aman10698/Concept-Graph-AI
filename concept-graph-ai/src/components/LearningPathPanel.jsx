import { useState } from 'react'

const ACTION_STYLE = {
  Revise:   { color: '#f59e0b', bg: '#fefce8', border: '#fde68a' },
  Learn:    { color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  Practice: { color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
}

function StepCard({ step, isLast }) {
  const s = ACTION_STYLE[step.action] || ACTION_STYLE.Learn
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      {/* Connector line + icon */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%',
          background: s.bg, border: `2px solid ${s.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 800, color: s.color, letterSpacing: '-0.01em',
        }}>
          {step.action?.[0] ?? '?'}
        </div>
        {!isLast && (
          <div style={{ width: 2, flex: 1, minHeight: 20, background: '#e2e8f0', margin: '4px 0' }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{
            padding: '2px 9px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
            background: s.bg, border: `1.5px solid ${s.border}`, color: s.color,
            textTransform: 'uppercase', letterSpacing: '0.06em',
          }}>{step.action}</span>
          <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0f172a' }}>{step.topic}</span>
        </div>
        <p style={{ fontSize: '0.78rem', color: '#6b7280', lineHeight: 1.5 }}>{step.reason}</p>
      </div>
    </div>
  )
}

function PathCard({ path, onPractice }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      border: '1.5px solid #e2e8f0', borderRadius: 14, overflow: 'hidden',
      background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', padding: '16px 20px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        {/* Weak badge */}
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: '#ef4444', flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
              {path.weakTopic}
            </span>
            <span style={{
              padding: '2px 8px', borderRadius: 999, fontSize: '0.68rem', fontWeight: 700,
              background: '#fef2f2', border: '1px solid #fca5a5', color: '#ef4444',
              textTransform: 'uppercase',
            }}>Weak</span>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {path.steps.length} steps · {path.estimatedTime}
            </span>
          </div>
          {!open && (
            <p style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 3 }}>{path.summary}</p>
          )}
        </div>
        {/* Chevron */}
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Steps */}
      {open && (
        <div style={{ padding: '4px 20px 20px 20px', borderTop: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 18, marginTop: 12 }}>
            {path.summary}
          </p>

          {path.steps.map((step, i) => (
            <StepCard
              key={i}
              step={step}
              isLast={i === path.steps.length - 1}
            />
          ))}

          {/* CTA */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
            <button
              onClick={() => onPractice(path.weakTopic)}
              style={{
                padding: '8px 18px', borderRadius: 8, fontWeight: 700, fontSize: '0.82rem',
                background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff',
                border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
              }}
            >
              Practice {path.weakTopic} now
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════════════ */
export default function LearningPathPanel({ weakTopics, allTopics, dependencyData, extractedText = '', onPractice }) {
  const [paths,     setPaths]     = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)

  if (!weakTopics?.length) return null

  const generate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch('http://localhost:5000/api/learning-path', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weakTopics,
          allTopics,
          dependencies: dependencyData?.relationships || [],
          extractedText,
        }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.message)
      setPaths(json.data.paths || [])
    } catch (err) {
      setError(err.message || 'Failed to generate learning paths')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginTop: 28 }}>
      {/* Section header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>
            Learning Path
          </h3>
          <p style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            {weakTopics.length} weak topic{weakTopics.length > 1 ? 's' : ''} — AI-generated recovery plan
          </p>
        </div>

        {!paths && !loading && (
          <button
            onClick={generate}
            style={{
              padding: '9px 20px', borderRadius: 10, fontWeight: 700, fontSize: '0.85rem',
              background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff',
              border: 'none', cursor: 'pointer', boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            Generate Learning Path
          </button>
        )}

        {paths && (
          <button
            onClick={generate}
            style={{
              padding: '7px 14px', borderRadius: 8, fontWeight: 600, fontSize: '0.78rem',
              background: '#f8fafc', color: '#6b7280', border: '1.5px solid #e2e8f0', cursor: 'pointer',
            }}
          >
            Regenerate
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px',
          background: '#f8faff', borderRadius: 12, border: '1.5px solid rgba(99,102,241,0.12)',
        }}>
          <div className="t-spinner" style={{ width: 22, height: 22, flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem', marginBottom: 2 }}>
              Ollama is analysing your weak areas…
            </p>
            <p style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              Building a prerequisite-aware recovery plan. This takes 10–20 seconds.
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '14px 18px', borderRadius: 10, background: '#fef2f2',
          border: '1.5px solid #fca5a5', color: '#991b1b', fontSize: '0.83rem', fontWeight: 600,
        }}>
          {error} — <button onClick={generate} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontWeight: 700 }}>Try again</button>
        </div>
      )}

      {/* Weak topic chips (before generating) */}
      {!paths && !loading && !error && (
        <div style={{
          padding: '16px 18px', borderRadius: 12, background: '#fef9f0',
          border: '1.5px solid #fed7aa', display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#92400e' }}>Needs improvement:</span>
          {weakTopics.map(t => (
            <span key={t} style={{
              padding: '3px 12px', borderRadius: 999, fontSize: '0.78rem', fontWeight: 700,
              background: '#fef2f2', border: '1.5px solid #fca5a5', color: '#ef4444',
            }}>{t}</span>
          ))}
        </div>
      )}

      {/* Path cards */}
      {paths && paths.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {paths.map(path => (
            <PathCard
              key={path.weakTopic}
              path={path}
              onPractice={onPractice}
            />
          ))}
        </div>
      )}

      {paths && paths.length === 0 && (
        <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem' }}>
          No learning paths generated. Try regenerating.
        </div>
      )}
    </div>
  )
}
