import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserSessions, activateSession, deleteSession } from '../services/sessionService'

/* ── colour helpers ─────────────────────────────────────────────── */
const progressColor = (pct) =>
  pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : pct > 0 ? '#ef4444' : '#9ca3af'

function cleanName(raw) {
  if (!raw) return ''
  return raw
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/-?\d{10,}-?\d*$/g, '')
    .replace(/[-_]+$/, '')
    .trim() || raw
}

/* ══════════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════ */
export default function MySyllabusesPage() {
  const { user }  = useAuth()
  const navigate  = useNavigate()

  const [sessions,  setSessions]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [switching, setSwitching] = useState(null)
  const [deleting,  setDeleting]  = useState(null)
  const [error,     setError]     = useState(null)
  const [activeId,  setActiveId]  = useState(() => localStorage.getItem('activeSessionId'))

  /* ── load sessions ──────────────────────────────────────────────── */
  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    setError(null)
    try {
      const data = await getUserSessions(user.uid)
      setSessions(data)
    } catch (e) {
      setError(`Could not load sessions: ${e.message}. Make sure the backend is running.`)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { load() }, [load])

  // Re-fetch when user returns from a practice session
  useEffect(() => {
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [load])

  /* ── activate session ───────────────────────────────────────────── */
  const handleActivate = async (sessionId) => {
    setSwitching(sessionId)
    try {
      const KEYS = ['activeSessionId', 'learningTopicsData', 'learningQuestionsData',
        'learningEvaluationData', 'learningDependencyData']
      KEYS.forEach(k => localStorage.removeItem(k))
      const data = await activateSession(sessionId)
      if (data) { setActiveId(sessionId); navigate('/dashboard') }
      else setError('Failed to load session data.')
    } catch (e) { setError(e.message) }
    finally { setSwitching(null) }
  }

  /* ── delete session ─────────────────────────────────────────────── */
  const handleDelete = async (sessionId) => {
    if (!window.confirm('Delete this syllabus and all its progress? This cannot be undone.')) return
    setDeleting(sessionId)
    try {
      await deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId))

      // ── Purge ALL dep-graph data for this session ──
      // 1. Per-session scoped key (always)
      localStorage.removeItem(`topicDepGraphs_${sessionId}`)

      // 2. Global unscoped key — always wipe it (it has no session tag so
      //    we can't tell which session it belongs to; safer to always clear it)
      localStorage.removeItem('topicDepGraphs')

      // 3. If this was the active session, wipe all associated learning data
      if (localStorage.getItem('activeSessionId') === sessionId) {
        ;['activeSessionId', 'learningTopicsData', 'learningQuestionsData',
          'learningEvaluationData', 'learningDependencyData']
          .forEach(k => localStorage.removeItem(k))
      }

      // 4. Broadcast so DepGraphPage resets immediately (even if already mounted)
      window.dispatchEvent(new CustomEvent('syllabusDeleted', { detail: { sessionId } }))

    } catch (e) { setError(e.message) }
    finally { setDeleting(null) }
  }

  /* ─── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div>

      {/* ════ PAGE HEADER ════════════════════════════════════════════ */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a',
          letterSpacing: '-0.03em', marginBottom: 4 }}>
          My Syllabuses
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          All your uploaded syllabuses with their progress — click any to continue practising
        </p>
      </div>

      {/* ════ ERROR BANNER ═══════════════════════════════════════════ */}
      {error && (
        <div className="t-alert t-alert-error" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <span>{error}</span>
            <button onClick={load} className="t-btn t-btn-sm"
              style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444',
                border: '1px solid #ef4444', flexShrink: 0 }}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ════ NOT LOGGED IN ══════════════════════════════════════════ */}
      {!user && (
        <div className="t-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            Sign in to see your syllabuses
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            Your syllabus history is saved to your account.
          </p>
        </div>
      )}

      {/* ════ LOADING ════════════════════════════════════════════════ */}
      {user && loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '32px 0' }}>
          <div className="t-spinner" />
          <span style={{ color: '#6b7280' }}>Loading your syllabuses…</span>
        </div>
      )}

      {/* ════ EMPTY STATE ════════════════════════════════════════════ */}
      {user && !loading && sessions.length === 0 && !error && (
        <div className="t-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
            No Syllabuses Yet
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: 24 }}>
            Upload a syllabus on the Learn page and it will appear here.
          </p>
          <button onClick={() => navigate('/syllabuses')} className="t-btn t-btn-primary">
            Upload Syllabus →
          </button>
        </div>
      )}

      {/* ════ SESSION CARDS ══════════════════════════════════════════ */}
      {!loading && sessions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {sessions.map(s => {
            const color       = progressColor(s.progress)
            const isActive    = s.sessionId === activeId
            const isSwitching = switching === s.sessionId
            const isDeleting  = deleting  === s.sessionId

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
                  boxShadow: isActive ? '0 0 0 3px rgba(99,102,241,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
                  transition: 'all 0.2s',
                }}
              >
                {/* ── Left: info ── */}
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

                  {/* Progress bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 6, background: '#e2e8f0',
                      borderRadius: 999, overflow: 'hidden', maxWidth: 260 }}>
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
                </div>

                {/* ── Right: actions ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 120 }}>
                  {isActive ? (
                    <button
                      onClick={() => navigate('/dashboard')}
                      className="t-btn t-btn-primary t-btn-sm"
                    >
                      Continue →
                    </button>
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

      {/* ════ UPLOAD NEW STRIP ══════════════════════════════════════ */}
      {!loading && sessions.length > 0 && (
        <div style={{
          marginTop: 20, padding: '16px 20px', borderRadius: 12,
          border: '1.5px dashed #d1d5db', background: '#fafbff',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <p style={{ fontWeight: 600, fontSize: '0.88rem', color: '#0f172a', marginBottom: 2 }}>
              Upload a new syllabus
            </p>
            <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
              Your existing progress won't be affected
            </p>
          </div>
          <button
            onClick={() => {
              ['activeSessionId', 'learningTopicsData', 'learningQuestionsData',
                'learningEvaluationData', 'learningDependencyData']
                .forEach(k => localStorage.removeItem(k))
              navigate('/syllabuses')
            }}
            className="t-btn t-btn-ghost t-btn-sm"
          >
            Upload New →
          </button>
        </div>
      )}
    </div>
  )
}
