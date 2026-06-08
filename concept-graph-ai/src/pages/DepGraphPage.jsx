import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUserSessions, loadSession, saveSessionEvaluation } from '../services/sessionService'
import DependencyGraph from '../components/DependencyGraph'
import BloomPanel from '../components/BloomPanel'
import { setEvalStorage, onEvalChange, offEvalChange } from '../utils/evalBus'

/* ── helpers ─────────────────────────────────────────────────────── */
const ratingColor = (r) =>
  r === 'strong' ? '#22c55e'
  : r === 'partial' || r === 'moderate' ? '#f59e0b'
  : r === 'weak' ? '#ef4444'
  : '#9ca3af'

const ratingLabel = (r) =>
  r === 'strong' ? 'Strong'
  : r === 'partial' || r === 'moderate' ? 'Partial'
  : r === 'weak' ? 'Needs Work'
  : 'Not Tested'

const ratingBg = (r) =>
  r === 'strong' ? 'rgba(34,197,94,0.08)'
  : r === 'partial' || r === 'moderate' ? 'rgba(245,158,11,0.08)'
  : r === 'weak' ? 'rgba(239,68,68,0.08)'
  : 'rgba(156,163,175,0.08)'

const progressColor = (pct) =>
  pct >= 80 ? '#22c55e' : pct >= 40 ? '#f59e0b' : pct > 0 ? '#ef4444' : '#9ca3af'

function cleanName(raw) {
  if (!raw) return ''
  return raw.replace(/\.[a-zA-Z0-9]+$/, '').replace(/-?\d{10,}-?\d*$/g, '').replace(/[-_]+$/, '').trim() || raw
}

/* ── Breadcrumb ──────────────────────────────────────────────────── */
function Breadcrumb({ steps, onStep }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 28, flexWrap: 'wrap' }}>
      {steps.map((s, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => i < steps.length - 1 && onStep(i)}
            style={{
              border: 'none', background: 'none', padding: '4px 2px',
              fontFamily: 'inherit', cursor: i < steps.length - 1 ? 'pointer' : 'default',
              fontSize: '0.82rem', fontWeight: i === steps.length - 1 ? 700 : 500,
              color: i === steps.length - 1 ? '#0f172a' : '#6366f1',
              textDecoration: i < steps.length - 1 ? 'underline' : 'none',
              textDecorationStyle: 'dotted',
              textUnderlineOffset: 3,
            }}
          >{s}</button>
          {i < steps.length - 1 && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          )}
        </span>
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   PAGE
═══════════════════════════════════════════════════════════════════ */
export default function DepGraphPage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()

  // ── 4-step state: 'syllabuses' | 'topics' | 'sections' | 'graph' ──
  const [step,           setStep]           = useState('syllabuses')
  const [sessions,       setSessions]       = useState([])
  const [loadingSessions,setLoadingSessions] = useState(true)
  const [selectedSession,setSelectedSession] = useState(null)
  const [loadingSession, setLoadingSession]  = useState(false)
  const [topicDepGraphs, setTopicDepGraphs] = useState({})
  const [selectedModule, setSelectedModule] = useState(null)   // e.g. "Crop Production"
  const [selectedSection,setSelectedSection] = useState(null)  // specific subtopic for the graph
  const [selectedTopic,  setSelectedTopic]  = useState(null)   // subtopic open in BloomPanel
  const [weaknessData,   setWeaknessData]   = useState(null)
  const [loadingWeakness,setLoadingWeakness] = useState(false)
  const [graphData,      setGraphData]      = useState(null)
  const [quizTopic,      setQuizTopic]      = useState(null)

  /* ── load syllabus list ─────────────────────────────────────────── */
  const loadSessions = useCallback(async () => {
    if (!user) { setLoadingSessions(false); return }
    setLoadingSessions(true)
    try {
      const data = await getUserSessions(user.uid)
      setSessions(data)

      // Purge orphaned dep-graph localStorage keys for sessions that no longer exist
      const validIds = new Set(data.map(s => s.sessionId))
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith('topicDepGraphs_')) {
          const id = key.slice('topicDepGraphs_'.length)
          if (!validIds.has(id)) {
            localStorage.removeItem(key)
            i-- // adjust index after removal
          }
        }
      }
      // If the global key belongs to a deleted session, wipe it too.
      const activeId = localStorage.getItem('activeSessionId')
      if (activeId && !validIds.has(activeId)) {
        localStorage.removeItem('topicDepGraphs')
      }

      // If the currently-selected session was deleted, reset to the syllabus list
      setSelectedSession(prev => {
        if (prev && !validIds.has(prev.sessionId)) {
          setStep('syllabuses')
          setSelectedTopic(null)
          setWeaknessData(null)
          setGraphData(null)
          setTopicDepGraphs({})
          return null
        }
        return prev
      })
    } catch (e) {
      console.error('[DepGraphPage] load sessions:', e)
    } finally {
      setLoadingSessions(false)
    }
  }, [user])

  useEffect(() => { loadSessions() }, [loadSessions])

  // When a quiz completes anywhere in the same tab, update selectedSession.evaluationData
  // so the module progress bars and subtopic chips re-render immediately
  useEffect(() => {
    const onEval = () => {
      try {
        const raw = localStorage.getItem('learningEvaluationData')
        if (!raw) return
        const newEval = JSON.parse(raw)
        setSelectedSession(prev => prev ? { ...prev, evaluationData: newEval } : prev)
      } catch { /* ignore */ }
    }
    onEvalChange(onEval)
    return () => offEvalChange(onEval)
  }, [])

  // React immediately when any syllabus is deleted from MySyllabusesPage
  useEffect(() => {
    const onDeleted = (e) => {
      const deletedId = e.detail?.sessionId
      if (!deletedId) return
      // Wipe that session's localStorage entry (belt-and-suspenders)
      localStorage.removeItem(`topicDepGraphs_${deletedId}`)
      // If user is currently viewing that session, kick them back to the list
      setSelectedSession(prev => {
        if (prev?.sessionId === deletedId) {
          setStep('syllabuses')
          setSelectedTopic(null)
          setWeaknessData(null)
          setGraphData(null)
          setTopicDepGraphs({})
          return null
        }
        return prev
      })
      // Refresh the session list to reflect the deletion
      loadSessions()
    }
    window.addEventListener('syllabusDeleted', onDeleted)
    return () => window.removeEventListener('syllabusDeleted', onDeleted)
  }, [loadSessions])

  /* ── select a syllabus — load its full data ──────────────────────── */
  const handleSelectSession = async (summary) => {
    setLoadingSession(true)
    try {
      // Always fetch from MongoDB (source of truth)
      let fullSession = summary
      let dbGraphs = {}
      try {
        const full = await loadSession(summary.sessionId)
        if (full) {
          dbGraphs = full.topicDepGraphs || {}
          // Merge topicsData + evaluationData into selectedSession
          // so Step 2 can derive the module list from topicsData
          fullSession = {
            ...summary,
            topicsData:     full.topicsData     || summary.topicsData     || null,
            evaluationData: full.evaluationData  || summary.evaluationData || {},
            topicDepGraphs: dbGraphs,
          }
        }
      } catch (fetchErr) {
        console.warn('[DepGraphPage] MongoDB fetch failed, falling back to localStorage:', fetchErr.message)
        const cached = localStorage.getItem(`topicDepGraphs_${summary.sessionId}`)
        if (cached) dbGraphs = JSON.parse(cached)
      }

      setSelectedSession(fullSession)
      setSelectedModule(null)
      setSelectedTopic(null)

      // Update localStorage cache
      localStorage.setItem(`topicDepGraphs_${summary.sessionId}`, JSON.stringify(dbGraphs))
      setTopicDepGraphs(dbGraphs)
      setStep('topics')

    } catch (e) {
      console.error('[DepGraphPage] load session:', e)
      setStep('topics')
    } finally {
      setLoadingSession(false)
    }
  }

  /* ── module dep-graph fetch — one graph per chapter ── */
  const fetchModuleDepGraph = useCallback(async (moduleName) => {
    if (!moduleName || !selectedSession?.sessionId) return
    setWeaknessData(null)
    setGraphData(null)
    setLoadingWeakness(true)
    try {
      const res = await fetch('http://localhost:5000/api/sessions/module-dep-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSession.sessionId,
          moduleName,
        }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        setGraphData(json.data)
        setWeaknessData(json.data)
      }
    } catch (e) {
      console.warn('[DepGraphPage] module-dep-graph failed:', e.message)
    } finally {
      setLoadingWeakness(false)
    }
  }, [selectedSession])

  // Trigger fetch when entering step 'graph'
  useEffect(() => {
    if (step === 'graph' && selectedSection) {
      fetchModuleDepGraph(selectedSection)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedSection])

  /* ── navigation ── */
  const goToStep = (i) => {
    if (i === 0) { setStep('syllabuses'); setSelectedSession(null); setSelectedModule(null); setSelectedSection(null); setSelectedTopic(null); setWeaknessData(null); setGraphData(null) }
    if (i === 1) { setStep('topics'); setSelectedModule(null); setSelectedSection(null); setSelectedTopic(null); setWeaknessData(null); setGraphData(null) }
    if (i === 2) { setStep('sections'); setSelectedSection(null); setWeaknessData(null); setGraphData(null) }
  }

  /* ── handle "Quiz This Topic" from dep graph node ── */
  const handleQuizTopic = (topicName) => {
    setSelectedTopic(topicName)
    setQuizTopic(topicName)
  }

  /* ── handle BloomPanel quiz completion — save + refresh section graph ── */
  const handleQuizComplete = async ({ concept, score, rating, nodes: depNodes, improvements }) => {
    setQuizTopic(null)

    if (!selectedSession?.sessionId) return

    const now = Date.now()
    const entry = {
      rating, score,
      nodes: depNodes || [],
      improvements: improvements || [],
      practicedAt: now,
    }

    // ── 1. Update topicDepGraphs (dep graph view) ──────────────────
    const newDepGraphs = { ...topicDepGraphs, [concept]: entry }
    setTopicDepGraphs(newDepGraphs)

    // ── 2. Also write to evaluationData so the MIND MAP updates too ─
    const evalEntry = { rating, score, practicedAt: now }
    const existingEval = JSON.parse(localStorage.getItem('learningEvaluationData') || '{}')
    const newEval = { ...existingEval, [concept]: evalEntry }
    // Use setEvalStorage so Dashboard and other pages update immediately in the same tab
    setEvalStorage('learningEvaluationData', JSON.stringify(newEval))

    try {
      // Persist dep-graph data
      await fetch(`http://localhost:5000/api/sessions/${selectedSession.sessionId}/data`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicDepGraphs: newDepGraphs }),
      })
      // Persist evaluationData so PracticePage / mind map shows the rating
      await saveSessionEvaluation(selectedSession.sessionId, { [concept]: evalEntry })
    } catch (e) {
      console.warn('[DepGraphPage] Failed to save quiz result:', e.message)
    }

    // Refresh the section dep graph
    if (selectedSection) fetchModuleDepGraph(selectedSection)
  }

  const breadcrumb = step === 'syllabuses'
    ? ['Syllabuses']
    : step === 'topics'
      ? ['Syllabuses', cleanName(selectedSession?.title)]
      : step === 'sections'
        ? ['Syllabuses', cleanName(selectedSession?.title), selectedModule || '']
        : ['Syllabuses', cleanName(selectedSession?.title), selectedModule || '', selectedSection || '']

  /* ── dep-graph topic list ────────────────────────────────────────── */
  const testedTopics  = Object.entries(topicDepGraphs)
    .sort(([, a], [, b]) => {
      const order = { weak: 0, partial: 1, moderate: 1, strong: 2 }
      return (order[a.rating] ?? 3) - (order[b.rating] ?? 3)
    })
  // Use deterministic graphData.nodes if available; fall back to stored topicDepGraphs nodes
  const selectedData = graphData
    ? {
        ...topicDepGraphs[selectedTopic],
        nodes: graphData.nodes,
        score: graphData.score ?? topicDepGraphs[selectedTopic]?.score,
        rating: graphData.rating ?? topicDepGraphs[selectedTopic]?.rating,
      }
    : selectedTopic ? topicDepGraphs[selectedTopic] : null

  /* ─── RENDER ─────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100, margin: '0 auto' }}>

      <style>{`
        @keyframes depSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes depFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .dep-card-hover { transition: all 0.18s ease; }
        .dep-card-hover:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 28px rgba(99,102,241,0.14) !important;
          border-color: #6366f1 !important;
        }
        .dep-chip { transition: all 0.16s ease; }
        .dep-chip:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 18px rgba(0,0,0,0.1) !important;
        }
      `}</style>

      {/* ═══ BREADCRUMB ═════════════════════════════════════════════ */}
      <Breadcrumb steps={breadcrumb} onStep={goToStep} />

      {/* ══════════════════════════════════════════════════════════════
          STEP 1 — SYLLABUSES
      ══════════════════════════════════════════════════════════════ */}
      {step === 'syllabuses' && (
        <div style={{ animation: 'depFadeIn 0.25s ease' }}>
          <div style={{ marginBottom: 28 }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a',
              letterSpacing: '-0.02em', marginBottom: 6 }}>
              Select a Syllabus
            </h2>
            <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Choose a syllabus to explore its prerequisite dependency graphs
            </p>
          </div>

          {!user && (
            <div style={{ padding: '48px 24px', textAlign: 'center', color: '#6b7280' }}>
              Please sign in to view your syllabuses.
            </div>
          )}

          {user && loadingSessions && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '32px 0' }}>
              <div className="t-spinner" />
              <span style={{ color: '#6b7280' }}>Loading syllabuses…</span>
            </div>
          )}

          {user && !loadingSessions && sessions.length === 0 && (
            <div style={{
              padding: '64px 32px', borderRadius: 20, textAlign: 'center',
              background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)',
              border: '2px dashed rgba(99,102,241,0.2)',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>
                No syllabuses yet
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 24, maxWidth: 360, margin: '0 auto 24px' }}>
                Upload a syllabus, practise quizzes from the mind map, and dependency graphs will appear here.
              </p>
              <button onClick={() => navigate('/syllabuses')} className="t-btn t-btn-primary"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 6px 20px rgba(99,102,241,0.3)' }}>
                Go to My Syllabuses →
              </button>
            </div>
          )}

          {user && !loadingSessions && sessions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {sessions.map(s => {
                const col = progressColor(s.progress)
                return (
                  <button
                    key={s.sessionId}
                    className="dep-card-hover"
                    onClick={() => handleSelectSession(s)}
                    disabled={loadingSession}
                    style={{
                      width: '100%', textAlign: 'left', border: `1.5px solid #e2e8f0`,
                      borderLeft: `5px solid ${col}`, borderRadius: 16,
                      padding: '18px 22px', background: '#fff',
                      fontFamily: 'inherit', cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 16,
                      opacity: loadingSession ? 0.6 : 1,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <h3 style={{ fontWeight: 700, fontSize: '0.98rem', color: '#0f172a', margin: 0 }}>
                          {cleanName(s.title)}
                        </h3>
                        {s.subject && (
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{cleanName(s.subject)}</span>
                        )}
                        {localStorage.getItem('activeSessionId') === s.sessionId && (
                          <span style={{
                            fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px',
                            borderRadius: 999, background: '#ede9fe', color: '#7c3aed',
                            textTransform: 'uppercase', letterSpacing: '0.05em',
                          }}>Active</span>
                        )}
                      </div>
                      {/* progress bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, height: 5, background: '#e2e8f0',
                          borderRadius: 999, overflow: 'hidden', maxWidth: 220 }}>
                          <div style={{
                            height: '100%', width: `${s.progress || 0}%`,
                            background: `linear-gradient(90deg, ${col}, ${col}cc)`,
                            borderRadius: 999, transition: 'width 0.5s',
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: col }}>
                          {s.masteredCount}/{s.topicCount || '?'} mastered ({s.progress}%)
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6366f1' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        {loadingSession ? 'Loading…' : 'View Graphs →'}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          STEP 2 — MODULES LIST
      ══════════════════════════════════════════════════════════════ */}
      {step === 'topics' && (() => {
        // Derive top-level modules from topicsData
        const rawTopics = selectedSession?.topicsData?.topics || selectedSession?.topicsData || []
        const modules = Array.isArray(rawTopics)
          ? rawTopics.map(t => (typeof t === 'string' ? { name: t, subtopics: [] } : t)).filter(t => t?.name)
          : []

        // Per-module progress: count quizzed subtopics
        const moduleStats = modules.map(mod => {
          const subs = (mod.subtopics || []).map(s => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
          // Flatten L2 subtopics too
          const allSubs = [...subs]
          ;(mod.subtopics || []).forEach(s => {
            const subObj = typeof s === 'string' ? null : s
            ;(subObj?.subtopics || []).forEach(ss => {
              const n = typeof ss === 'string' ? ss : ss?.name
              if (n) allSubs.push(n)
            })
          })
          const totalCount  = allSubs.length || 1
          const quizzedList = allSubs.filter(n => topicDepGraphs[n] || (selectedSession?.evaluationData || {})[n])
          const quizzedCount = quizzedList.length
          const scores = quizzedList.map(n => topicDepGraphs[n]?.score ?? (selectedSession?.evaluationData || {})[n]?.score).filter(x => x != null)
          const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
          const pct = Math.round((quizzedCount / totalCount) * 100)
          const col = avgScore != null ? progressColor(avgScore) : '#9ca3af'
          return { name: mod.name, totalCount, quizzedCount, avgScore, pct, col, subtopics: subs }
        })

        const totalQuizzed = Object.keys(topicDepGraphs).length

        return (
          <div style={{ animation: 'depFadeIn 0.25s ease' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 6 }}>
                  Module Dependency Graphs
                </h2>
                <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  Each module shows a dependency graph of all its subtopics — quizzed and unquizzed.
                </p>
              </div>
              {/* Summary pills */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[
                  { label: 'Modules', value: modules.length, color: '#6366f1' },
                  { label: 'Subtopics Quizzed', value: totalQuizzed, color: '#22c55e' },
                ].filter(s => s.value > 0).map(s => (
                  <div key={s.label} style={{
                    padding: '5px 12px', borderRadius: 999,
                    background: `${s.color}10`, border: `1.5px solid ${s.color}22`,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <span style={{ fontSize: '1rem', fontWeight: 800, color: s.color }}>{s.value}</span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: s.color }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {modules.length === 0 ? (
              <div style={{
                padding: '64px 32px', borderRadius: 20, textAlign: 'center',
                background: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)',
                border: '2px dashed rgba(99,102,241,0.2)',
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#1e1b4b', marginBottom: 8 }}>No modules found</h3>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', maxWidth: 380, margin: '0 auto 24px', lineHeight: 1.7 }}>
                  Upload a syllabus to see its modules here.
                </p>
                <button onClick={() => navigate('/syllabuses')} className="t-btn t-btn-primary"
                  style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>
                  Go to My Syllabuses →
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
                {moduleStats.map((mod) => (
                  <button
                    key={mod.name}
                    className="dep-card-hover"
                    onClick={() => { setSelectedModule(mod.name); setStep('sections') }}
                    style={{
                      textAlign: 'left', width: '100%', fontFamily: 'inherit',
                      padding: '20px 22px', borderRadius: 18,
                      background: '#fff',
                      border: '1.5px solid #e2e8f0',
                      borderTop: `4px solid ${mod.col}`,
                      cursor: 'pointer',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* Module icon + name */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                        background: `${mod.col}15`, border: `1.5px solid ${mod.col}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1.1rem',
                      }}>
                        📚
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ fontWeight: 800, fontSize: '0.95rem', color: '#0f172a', margin: '0 0 4px', lineHeight: 1.35, wordBreak: 'break-word' }}>
                          {mod.name}
                        </p>
                        <span style={{
                          fontSize: '0.68rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                          background: mod.avgScore != null ? `${mod.col}15` : 'rgba(156,163,175,0.1)',
                          color: mod.avgScore != null ? mod.col : '#9ca3af',
                        }}>
                          {mod.avgScore != null ? `Avg ${mod.avgScore}%` : 'Not started'}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>Subtopics quizzed</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: mod.col }}>
                          {mod.quizzedCount} / {mod.totalCount}
                        </span>
                      </div>
                      <div style={{ height: 7, background: '#f1f5f9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          width: `${mod.pct}%`,
                          background: `linear-gradient(90deg, ${mod.col}, ${mod.col}aa)`,
                          borderRadius: 999, transition: 'width 0.5s',
                          minWidth: mod.pct > 0 ? 6 : 0,
                        }} />
                      </div>
                    </div>

                    {/* Subtopic chips (first 4) */}
                    {mod.subtopics.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                        {mod.subtopics.slice(0, 4).map(s => {
                          const isQuizzed = !!topicDepGraphs[s] || !!(selectedSession?.evaluationData || {})[s]
                          return (
                            <span key={s} style={{
                              fontSize: '0.65rem', padding: '2px 8px', borderRadius: 999,
                              background: isQuizzed ? 'rgba(99,102,241,0.08)' : 'rgba(156,163,175,0.08)',
                              color: isQuizzed ? '#6366f1' : '#9ca3af',
                              border: `1px solid ${isQuizzed ? 'rgba(99,102,241,0.2)' : 'rgba(156,163,175,0.15)'}`,
                              fontWeight: 600,
                            }}>
                              {isQuizzed ? '✓ ' : ''}{s.length > 22 ? s.slice(0, 20) + '…' : s}
                            </span>
                          )
                        })}
                        {mod.subtopics.length > 4 && (
                          <span style={{ fontSize: '0.65rem', color: '#9ca3af', padding: '2px 6px' }}>
                            +{mod.subtopics.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    {/* CTA */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        {mod.quizzedCount === 0
                          ? 'Click to explore sections'
                          : `${mod.totalCount - mod.quizzedCount} subtopic${mod.totalCount - mod.quizzedCount !== 1 ? 's' : ''} not started`}
                      </span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6366f1', display: 'flex', alignItems: 'center', gap: 4 }}>
                        Select Section
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* ══════════════════════════════════════════════════════════════
          STEP 3 — SECTION PICKER (subtopics of the selected module)
      ══════════════════════════════════════════════════════════════ */}
      {step === 'sections' && (() => {
        const rawTopics = selectedSession?.topicsData?.topics || selectedSession?.topicsData || []
        const allTopics = Array.isArray(rawTopics)
          ? rawTopics.map(t => typeof t === 'string' ? { name: t, subtopics: [] } : t).filter(t => t?.name)
          : []

        // Find the selected module object
        const moduleObj = allTopics.find(t => t.name?.toLowerCase() === selectedModule?.toLowerCase())
        const sections  = (moduleObj?.subtopics || []).map(s =>
          typeof s === 'string' ? { name: s, subtopics: [] } : s
        ).filter(s => s?.name)

        // Also allow viewing the module itself as a whole
        const allSections = [
          { name: selectedModule, subtopics: moduleObj?.subtopics || [], isSelf: true },
          ...sections,
        ]

        return (
          <div style={{ animation: 'depFadeIn 0.25s ease' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em', marginBottom: 6 }}>
                {selectedModule}
              </h2>
              <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                Select a section to view its full dependency graph
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {allSections.map((sec, idx) => {
                const isQuizzed = !!topicDepGraphs[sec.name] || !!(selectedSession?.evaluationData || {})[sec.name]
                const ev = topicDepGraphs[sec.name] || (selectedSession?.evaluationData || {})[sec.name]
                const score = ev?.score ?? null
                const rating = ev?.rating ?? null
                const col = rating ? ratingColor(rating) : score != null ? progressColor(score) : '#9ca3af'
                const subNames = (sec.subtopics || []).map(s => typeof s === 'string' ? s : s?.name).filter(Boolean)

                return (
                  <button
                    key={sec.name}
                    className="dep-card-hover"
                    onClick={() => { setSelectedSection(sec.name); setStep('graph') }}
                    style={{
                      textAlign: 'left', width: '100%', fontFamily: 'inherit',
                      padding: '16px 20px', borderRadius: 14,
                      background: '#fff',
                      border: '1.5px solid #e2e8f0',
                      borderLeft: idx === 0 ? '5px solid #6366f1' : `5px solid ${col}`,
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto',
                      alignItems: 'center',
                      gap: 16,
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                        {idx === 0
                          ? <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>FULL MODULE</span>
                          : isQuizzed
                            ? <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${col}15`, color: col, textTransform: 'uppercase' }}>{rating || (score != null ? `${score}%` : '')}</span>
                            : <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: 'rgba(156,163,175,0.12)', color: '#9ca3af' }}>Not Started</span>
                        }
                        <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', margin: 0 }}>
                          {sec.name}
                        </p>
                      </div>

                      {/* sub-subtopic preview */}
                      {subNames.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {subNames.slice(0, 5).map(n => {
                            const sq = !!topicDepGraphs[n] || !!(selectedSession?.evaluationData || {})[n]
                            return (
                              <span key={n} style={{
                                fontSize: '0.62rem', padding: '1px 7px', borderRadius: 999,
                                background: sq ? 'rgba(99,102,241,0.07)' : 'rgba(156,163,175,0.07)',
                                color: sq ? '#6366f1' : '#9ca3af',
                                border: `1px solid ${sq ? 'rgba(99,102,241,0.15)' : 'rgba(156,163,175,0.12)'}`,
                                fontWeight: 600,
                              }}>{sq ? '✓ ' : ''}{n.length > 24 ? n.slice(0, 22) + '…' : n}</span>
                            )
                          })}
                          {subNames.length > 5 && <span style={{ fontSize: '0.62rem', color: '#9ca3af' }}>+{subNames.length - 5} more</span>}
                        </div>
                      )}
                    </div>

                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: idx === 0 ? '#6366f1' : col, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                      View Graph
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ══════════════════════════════════════════════════════════════
          STEP 4 — FULL-SCREEN DEPENDENCY GRAPH
      ══════════════════════════════════════════════════════════════ */}
      {step === 'graph' && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 9999,
          background: '#f8fafc',
          display: 'flex', flexDirection: 'column',
          animation: 'depSlideIn 0.22s cubic-bezier(0.4,0,0.2,1)',
        }}>

          {/* ── Top header bar ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 28px', height: 56, flexShrink: 0,
            background: '#fff', borderBottom: '1.5px solid #f1f5f9',
            boxShadow: '0 1px 8px rgba(0,0,0,0.05)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button
                onClick={() => { setStep('sections'); setWeaknessData(null); setGraphData(null) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 9,
                  border: '1.5px solid #e2e8f0', background: '#fff',
                  cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: '0.8rem', fontWeight: 600, color: '#374151',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#374151'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                Back
              </button>
              <div style={{ width: 1, height: 22, background: '#e2e8f0' }} />
              {/* Breadcrumb: Module → Section */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>{cleanName(selectedSession?.title)}</span>
                <span style={{ color: '#d1d5db' }}>›</span>
                <span style={{ fontSize: '0.72rem', color: '#9ca3af', fontWeight: 500 }}>{selectedModule}</span>
                <span style={{ color: '#d1d5db' }}>›</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e1b4b' }}>{selectedSection}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* Progress stats */}
              {graphData && (
                <div style={{
                  padding: '6px 14px', borderRadius: 10,
                  background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.12)',
                }}>
                  <span style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 700 }}>
                    {graphData.quizzedCount ?? 0} / {graphData.totalCount ?? '?'} quizzed
                  </span>
                  {graphData.avgScore != null && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 700,
                      color: progressColor(graphData.avgScore) }}>
                      Avg {graphData.avgScore}%
                    </span>
                  )}
                </div>
              )}
              {/* Ollama loading */}
              {loadingWeakness && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 12px', borderRadius: 8,
                  background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}>
                  <div style={{
                    width: 13, height: 13, borderRadius: '50%',
                    border: '2px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1',
                    animation: 'spin 0.8s linear infinite', flexShrink: 0,
                  }} />
                  <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: 600 }}>Building graph…</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {loadingWeakness ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  border: '4px solid rgba(99,102,241,0.15)', borderTopColor: '#6366f1',
                  animation: 'spin 0.8s linear infinite',
                }} />
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1e1b4b', marginBottom: 4 }}>
                    Building graph for “{selectedSection}”
                  </p>
                  <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Fetching subtopics and quiz scores…</p>
                </div>
              </div>
            ) : graphData?.nodes?.length > 0 ? (
              <DependencyGraph
                nodes={graphData.nodes}
                graphData={graphData}
                topicName={selectedSection}
                weaknessData={weaknessData}
                onNavigatePractice={() => { setStep('sections'); setWeaknessData(null); setGraphData(null) }}
                onQuizTopic={handleQuizTopic}
                fullScreen
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📊</div>
                  <p style={{ fontWeight: 700, color: '#1e1b4b', marginBottom: 6 }}>No subtopics found</p>
                  <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>This section has no subtopics in the syllabus yet.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BloomPanel quiz modal ── */}
      {quizTopic && (
        <BloomPanel
          concept={quizTopic}
          parentTopic={selectedSection || selectedModule}
          syllabusId={selectedSession?.sessionId || ''}
          onClose={() => setQuizTopic(null)}
          onQuizComplete={handleQuizComplete}
        />
      )}
    </div>
  )
}
