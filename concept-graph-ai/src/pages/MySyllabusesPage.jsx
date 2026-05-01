import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserSessions, activateSession, deleteSession } from '../services/sessionService'
import DependencyGraph from '../components/DependencyGraph'

const nodeColor = (pct) =>
  pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : pct > 0 ? '#ef4444' : '#9ca3af'

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/* Strip timestamps, numbers, and file extensions from uploaded filenames
   e.g. "AI basics-1776800177995-655621120.pdf" → "AI basics" */
function cleanName(raw) {
  if (!raw) return ''
  return raw
    .replace(/\.[a-zA-Z0-9]+$/, '')        // remove file extension (.pdf, .png …)
    .replace(/-?\d{10,}-?\d*$/g, '')        // remove trailing timestamp/number blocks
    .replace(/[-_]+$/, '')                  // remove trailing dashes or underscores
    .trim()
    || raw                                  // fall back to original if result is empty
}

export default function MySyllabusesPage() {
  const { user }          = useAuth()
  const navigate          = useNavigate()
  const [sessions,  setSessions]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [switching, setSwitching] = useState(null)
  const [deleting,  setDeleting]  = useState(null)
  const [error,     setError]     = useState(null)
  const [activeId,  setActiveId]  = useState(() => localStorage.getItem('activeSessionId'))
  const [showDepGraph, setShowDepGraph] = useState(false)
  const [selectedDepTopic, setSelectedDepTopic] = useState(null)
  const [topicDepGraphs] = useState(() => {
    try { return JSON.parse(localStorage.getItem('topicDepGraphs') || '{}') }
    catch { return {} }
  })

  /* ── load sessions ── */
  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const data = await getUserSessions(user.uid)
      setSessions(data)
    } catch (e) {
      setError('Could not load sessions. Make sure the backend is running.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  /* ── switch to a session ── */
  const handleActivate = async (sessionId) => {
    setSwitching(sessionId)
    try {
      // Clear ALL stale data before loading the new session
      const LEARNING_KEYS = [
        'activeSessionId', 'learningTopicsData', 'learningQuestionsData',
        'learningEvaluationData', 'learningDependencyData',
      ]
      LEARNING_KEYS.forEach(k => localStorage.removeItem(k))

      const data = await activateSession(sessionId)
      if (data) {
        setActiveId(sessionId)
        navigate('/concept-graph')
      } else {
        setError('Failed to load session data.')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSwitching(null)
    }
  }

  /* ── delete a session ── */
  const handleDelete = async (sessionId) => {
    if (!window.confirm('Delete this syllabus and all its progress? This cannot be undone.')) return
    setDeleting(sessionId)
    try {
      await deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId))
      // If deleted session was active, clear ALL cached learning data
      if (localStorage.getItem('activeSessionId') === sessionId) {
        const LEARNING_KEYS = [
          'activeSessionId',
          'learningTopicsData',
          'learningQuestionsData',
          'learningEvaluationData',
          'learningDependencyData',
        ]
        LEARNING_KEYS.forEach(k => localStorage.removeItem(k))
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }


  /* ─── render ─────────────────────────────────────────────────── */
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 4 }}>
          My Syllabuses
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          All your uploaded syllabuses with their progress — click any to continue practising
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="t-alert t-alert-error" style={{ marginBottom: 20 }}>
          {error}
        </div>
      )}

      {/* Not logged in */}
      {!user && (
        <div className="t-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>Sign in to see your syllabuses</h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Your syllabus history is saved to your account.</p>
        </div>
      )}

      {/* Loading */}
      {user && loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '32px 0' }}>
          <div className="t-spinner" />
          <span style={{ color: '#6b7280' }}>Loading your syllabuses…</span>
        </div>
      )}

      {/* Empty */}
      {user && !loading && sessions.length === 0 && !error && (
        <div className="t-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            No Syllabuses Yet
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: 24 }}>
            Upload a syllabus on the Learn page and it will appear here.
          </p>
          <button
            onClick={() => navigate('/concept-graph')}
            className="t-btn t-btn-primary"
          >
            Upload Syllabus →
          </button>
        </div>
      )}

      {/* Session cards */}
      {!loading && sessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sessions.map(s => {
            const color      = nodeColor(s.progress)
            const isActive   = s.sessionId === activeId
            const isSwitching= switching === s.sessionId
            const isDeleting = deleting  === s.sessionId

            return (
              <div
                key={s.sessionId}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr auto',
                  gap: 20, alignItems: 'center',
                  padding: '20px 22px', borderRadius: 14,
                  background: isActive ? 'rgba(99,102,241,0.04)' : '#fff',
                  border: `1.5px solid ${isActive ? '#6366f1' : '#e2e8f0'}`,
                  borderLeft: `4px solid ${isActive ? '#6366f1' : color}`,
                  boxShadow: isActive ? '0 0 0 3px rgba(99,102,241,0.08)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {/* Left: info */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0f172a', margin: 0 }}>
                      {cleanName(s.title)}
                    </h3>
                    {isActive && (
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 700, padding: '2px 8px',
                        borderRadius: 999, background: '#ede9fe', color: '#7c3aed',
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>Active</span>
                    )}
                    {s.subject && (
                      <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{cleanName(s.subject)}</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ flex: 1, height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden', maxWidth: 260 }}>
                      <div style={{
                        height: '100%', width: `${s.progress || 0}%`,
                        background: `linear-gradient(90deg, ${color}, ${color}cc)`,
                        borderRadius: 999, transition: 'width 0.5s ease',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: 700, color }}>
                      {s.masteredCount}/{s.topicCount > 0 ? s.topicCount : (s.answeredCount || '?')} mastered
                      {s.topicCount > 0 ? ` (${s.progress}%)` : ''}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Topics',    val: s.topicCount    },
                      { label: 'Questions', val: s.questionCount },
                      { label: 'Uploaded',  val: formatDate(s.createdAt) },
                      { label: 'Updated',   val: formatDate(s.updatedAt) },
                    ].map(m => (
                      <div key={m.label}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>
                          {m.label}
                        </span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>{m.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
                  {isActive ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <button
                        onClick={() => { setShowDepGraph(v => !v); setSelectedDepTopic(null) }}
                        className="t-btn t-btn-sm"
                        style={{
                          background: showDepGraph ? '#6366f1' : 'rgba(99,102,241,0.08)',
                          color: showDepGraph ? '#fff' : '#6366f1',
                          border: '1.5px solid rgba(99,102,241,0.3)',
                          fontWeight: 700, fontSize: '0.78rem',
                        }}
                      >
                        {showDepGraph ? 'Hide Graph' : 'Prerequisite Graph'}
                      </button>
                      <button
                        onClick={() => navigate('/concept-graph')}
                        className="t-btn t-btn-primary t-btn-sm"
                      >
                        Continue →
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleActivate(s.sessionId)}
                      disabled={!!switching}
                      className="t-btn t-btn-primary t-btn-sm"
                      style={{ opacity: switching ? 0.6 : 1 }}
                    >
                      {isSwitching ? 'Loading…' : 'Switch to This'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(s.sessionId)}
                    disabled={isDeleting}
                    className="t-btn t-btn-ghost t-btn-sm"
                    style={{ color: '#ef4444', fontSize: '0.78rem' }}
                  >
                    {isDeleting ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Prerequisite Graph inline panel ── */}
      {showDepGraph && (() => {
        const testedTopics = Object.entries(topicDepGraphs)
        const selected = selectedDepTopic ? topicDepGraphs[selectedDepTopic] : null
        const ratingColor = r =>
          r === 'strong' ? '#22c55e' : r === 'partial' || r === 'moderate' ? '#f59e0b' : r === 'weak' ? '#ef4444' : '#9ca3af'
        const ratingLabel = r =>
          r === 'strong' ? 'Strong' : r === 'partial' || r === 'moderate' ? 'Partial' : r === 'weak' ? 'Needs Work' : 'Not Tested'

        return (
          <div style={{
            marginTop: -8, padding: '22px 24px',
            borderRadius: '0 0 14px 14px',
            background: '#f8faff',
            border: '1.5px solid #6366f1',
            borderTop: '1.5px dashed #c7d2fe',
            animation: 'slideUp 0.22s ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>Prerequisite Graph</p>
              <button
                onClick={() => { setShowDepGraph(false); setSelectedDepTopic(null) }}
                style={{ border: 'none', background: 'none', fontSize: '1.1rem', cursor: 'pointer', color: '#9ca3af', lineHeight: 1 }}
              >✕</button>
            </div>

            {testedTopics.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <p style={{ fontWeight: 600, color: '#6b7280', fontSize: '0.88rem', marginBottom: 6 }}>No quizzes completed yet</p>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Go to Learn, click any mind map node, and complete a quiz to see its prerequisite graph here.</p>
                <button onClick={() => navigate('/concept-graph')} className="t-btn t-btn-primary t-btn-sm" style={{ marginTop: 14 }}>
                  Go to Learn →
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Topic picker */}
                <div>
                  <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                    Topics tested — click to view prerequisite graph
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {testedTopics.map(([name, data]) => {
                      const color = ratingColor(data.rating)
                      const isSel = selectedDepTopic === name
                      return (
                        <button
                          key={name}
                          onClick={() => setSelectedDepTopic(isSel ? null : name)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '8px 14px', borderRadius: 10, fontFamily: 'inherit',
                            fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
                            background: isSel ? `${color}18` : '#fff',
                            border: `2px solid ${isSel ? color : '#e2e8f0'}`,
                            color: isSel ? color : '#374151',
                            boxShadow: isSel ? `0 0 0 3px ${color}18` : 'none',
                            transition: 'all 0.15s',
                          }}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                          {name}
                          <span style={{
                            fontSize: '0.66rem', fontWeight: 700, padding: '1px 6px',
                            borderRadius: 999, background: `${color}20`, color,
                          }}>{data.score}%</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Selected topic dep graph */}
                {selectedDepTopic && selected && (
                  <div style={{
                    padding: '18px 20px', borderRadius: 12,
                    background: '#fff',
                    border: `2px solid ${ratingColor(selected.rating)}`,
                    borderLeft: `5px solid ${ratingColor(selected.rating)}`,
                  }}>

                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                      <div style={{ width: 11, height: 11, borderRadius: '50%', background: ratingColor(selected.rating), flexShrink: 0 }} />
                      <p style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a' }}>{selectedDepTopic}</p>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: `${ratingColor(selected.rating)}20`, color: ratingColor(selected.rating),
                        textTransform: 'uppercase',
                      }}>{ratingLabel(selected.rating)}</span>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#6366f1', marginLeft: 'auto' }}>{selected.score}%</span>
                    </div>

                    {/* Dependency Tree */}
                    {selected.nodes && selected.nodes.length > 0 ? (
                      <div>
                        <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
                          Prerequisite dependency graph — AI-generated from your quiz
                        </p>
                        <DependencyGraph nodes={selected.nodes} />
                        {/* Improvements */}
                        {selected.improvements && selected.improvements.length > 0 && (
                          <div style={{ marginTop: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)' }}>
                            <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#6366f1', marginBottom: 6 }}>What to study next:</p>
                            <ul style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                              {selected.improvements.slice(0, 4).map((tip, ti) => (
                                <li key={ti} style={{ fontSize: '0.78rem', color: '#374151' }}>{tip}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : selected.rating === 'strong' ? (
                      <div style={{ textAlign: 'center', padding: '12px 0' }}>
                        <p style={{ fontWeight: 700, color: '#15803d', fontSize: '0.9rem' }}>No prerequisite gaps!</p>
                        <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>You showed solid understanding of this topic.</p>
                      </div>
                    ) : (
                      <p style={{ fontSize: '0.82rem', color: '#6b7280' }}>No dependency data available for this topic.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

      {/* Upload new */}
      {!loading && sessions.length > 0 && (
        <div style={{
          marginTop: 24, padding: '16px 20px', borderRadius: 12,
          border: '1.5px dashed #d1d5db', background: '#fafbff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', marginBottom: 2 }}>Upload a new syllabus</p>
            <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Your existing progress won't be affected</p>
          </div>
          <button onClick={() => navigate('/concept-graph')} className="t-btn t-btn-ghost t-btn-sm">
            Upload New →
          </button>
        </div>
      )}
    </div>
  )
}
