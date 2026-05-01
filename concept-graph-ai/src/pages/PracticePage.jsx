import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import QuestionPractice from '../components/QuestionPractice'
import QuizMindMap from '../components/QuizMindMap'
import BloomPanel from '../components/BloomPanel'
import LearningPathPanel from '../components/LearningPathPanel'
import RootCauseGraph from '../components/RootCauseGraph'
import { useAuth } from '../context/AuthContext'
import { persistEvaluation } from '../services/mongoProgressService'
import { loadSession, getActiveSessionId, saveSessionEvaluation, updateSessionData } from '../services/sessionService'

/* ─── colour helpers ─────────────────────────────────────────── */
const nodeColor = r =>
  r === 'strong'  ? '#22c55e'
  : r === 'partial' || r === 'moderate' ? '#f59e0b'
  : r === 'weak'  ? '#ef4444'
  : '#9ca3af'

const ratingLabel = r =>
  r === 'strong'  ? 'Mastered'
  : r === 'partial' || r === 'moderate' ? 'In Progress'
  : r === 'weak'  ? 'Needs Work'
  : 'Not Started'

const ratingPct = r =>
  r === 'strong' ? 100 : r === 'partial' || r === 'moderate' ? 55 : r === 'weak' ? 20 : 0

/* ═══════════════════════════════════════════════════════════════ */
export default function PracticePage() {
  const [questionsData,  setQuestionsData]  = useState(null)
  const [topicsData,     setTopicsData]     = useState(null)
  const [dependencyData, setDependencyData] = useState(null)
  const [evalData,       setEvalData]       = useState({})
  const [selectedTopic,  setSelectedTopic]  = useState(null)
  const [bloomNode,      setBloomNode]      = useState(null)  // { name, parentName }
  const [generatingFor,  setGeneratingFor]  = useState(null)
  const [sessionText,    setSessionText]    = useState('')
  const [sessionTitle,   setSessionTitle]   = useState('My Course')
  const [quizCompleted,  setQuizCompleted]  = useState(false)

  const { user } = useAuth()

  /* ── load from active session first, fallback to localStorage ── */
  useEffect(() => {
    const load = async () => {
      try {
        const activeId = getActiveSessionId()
        if (activeId) {
          const data = await loadSession(activeId)
          if (data) {
            if (data.topicsData)     setTopicsData(data.topicsData)
            // NOTE: do NOT restore questionsData from cache — questions are generated
            // fresh per-topic on demand so they always reflect the correct parent context.
            if (data.dependencyData) setDependencyData(data.dependencyData)
            if (data.evaluationData && Object.keys(data.evaluationData).length)
              setEvalData(data.evaluationData)
            if (data.extractedText)  setSessionText(data.extractedText)
            if (data.title) {
              const cleaned = data.title
                .replace(/\.[a-zA-Z0-9]+$/, '')
                .replace(/-?\d{10,}-?\d*$/g, '')
                .replace(/[-_]+$/, '')
                .trim()
              setSessionTitle(cleaned || data.title)
            }
            if (data.topicsData)     localStorage.setItem('learningTopicsData',    JSON.stringify(data.topicsData))
            if (data.evaluationData) localStorage.setItem('learningEvaluationData',JSON.stringify(data.evaluationData))
            // Clear any old stale question cache so nodes always trigger fresh generation
            localStorage.removeItem('learningQuestionsData')
            return
          }
        }
        const t = localStorage.getItem('learningTopicsData')
        const e = localStorage.getItem('learningEvaluationData')
        const d = localStorage.getItem('learningDependencyData')
        if (t) setTopicsData(JSON.parse(t))
        // Do NOT restore questions from localStorage — always generate fresh per topic
        localStorage.removeItem('learningQuestionsData')
        if (e) setEvalData(JSON.parse(e))
        if (d) setDependencyData(JSON.parse(d))
      } catch (err) {
        console.error('Failed to load practice data:', err)
      }
    }
    load()
  }, [user])

  const topics  = topicsData?.topics ?? []
  const getName = t => (typeof t === 'string' ? t : t.name)
  const allQ    = questionsData?.questions ?? []

  /* ── Build a lookup: subtopicName → parentTopicName ── */
  const parentMap = {}
  topics.forEach(t => {
    const pName = getName(t)
    const subs  = t.subtopics ?? []
    subs.forEach(s => {
      const sName = typeof s === 'string' ? s : s.name
      if (sName) parentMap[sName] = pName
    })
  })

  /* ── subject from session title (best context hint for Ollama) ── */
  const subject = sessionTitle || null

  /* ── Generate questions ONLY for the clicked topic, with parent context ── */
  const generateQuestionsForTopic = async (topicName, force = false) => {
    if (generatingFor) return
    setGeneratingFor(topicName)

    // If force-regenerating, clear the cached questions for this topic first
    if (force) {
      setQuestionsData(prev => {
        if (!prev) return prev
        const filtered = (prev.questions ?? []).filter(
          q => q.topic !== topicName && q.parentTopic !== topicName
        )
        return { ...prev, questions: filtered }
      })
    }

    try {
      // Resolve parent — is this topic a subtopic of something?
      const parentTopic = parentMap[topicName] || null

      // Add a variation seed so Ollama produces different questions each call
      const variationSeed = Date.now()

      // Send a single-entry topics array with full hierarchy so AI knows the domain
      const topicEntry = {
        name:        topicName,
        parentTopic: parentTopic,   // e.g. "Genetic Algorithms"
        subject:     subject,       // e.g. "Genetic Algorithms" (overall course)
        subtopics:   [],
        _seed:       variationSeed, // hint to backend for variation
      }

      const res  = await fetch('http://localhost:5000/api/questions', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topics:        [topicEntry],
          extractedText: sessionText || '',
          subject:       subject,
          _seed:         variationSeed,
        }),
      })
      const json = await res.json()

      if (json.success && json.data?.questions?.length) {
        // Merge new questions into existing set — never wipe other topics' questions
        setQuestionsData(prev => {
          const existing = prev?.questions ?? []
          // Remove any previous questions for this exact topic before merging
          const filtered = existing.filter(
            q => q.topic !== topicName && q.parentTopic !== topicName
          )
          const merged = [...filtered, ...json.data.questions]
          const newQData = {
            questions: merged,
            grouped:   { byType: json.data.questionsByType, byDifficulty: json.data.questionsByDifficulty },
            stats:     { total: merged.length },
          }
          localStorage.setItem('learningQuestionsData', JSON.stringify(newQData))
          const activeId = getActiveSessionId()
          if (activeId) updateSessionData(activeId, { questionsData: newQData })
          return newQData
        })
      }
    } catch (err) {
      console.error('Auto question gen failed:', err)
    } finally {
      setGeneratingFor(null)
    }
  }

  /* ── eval update ── */
  const handleEvalUpdate = ev => {
    setEvalData(prev => {
      const merged = { ...prev, ...ev }
      localStorage.setItem('learningEvaluationData', JSON.stringify(merged))
      const activeId = getActiveSessionId()
      if (activeId) saveSessionEvaluation(activeId, ev)
      else if (user) persistEvaluation(user.uid, merged)
      return merged
    })
  }

  /* ── derived stats ── */
  const masteredCount = topics.filter(t => evalData[getName(t)]?.rating === 'strong').length
  const weakTopics    = topics
    .map(t => getName(t))
    .filter(name => evalData[name]?.rating === 'weak')
  const allGreen = masteredCount === topics.length && topics.length > 0

  /* ══════════════════════════════════════════════════════════════
     EMPTY STATE
  ══════════════════════════════════════════════════════════════ */
  if (!topicsData && !questionsData) {
    return (
      <div>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 4 }}>Quizzes</h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Test your knowledge topic by topic</p>
        </div>
        <div className="t-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>No Syllabus Uploaded Yet</h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', maxWidth: 380, margin: '0 auto 28px' }}>
            Upload a syllabus on the Learn page first. Topics will be extracted and appear here as an interactive mind map.
          </p>
          <Link to="/concept-graph" id="practice-upload-cta" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 28px',
            borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            color: '#fff', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
          }}>
            Upload Syllabus
          </Link>
        </div>
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════
     PER-TOPIC QUIZ VIEW
  ══════════════════════════════════════════════════════════════ */
  if (selectedTopic) {
    const topicQ = allQ.filter(q => q.topic === selectedTopic || q.parentTopic === selectedTopic)
    const ev     = evalData[selectedTopic]
    const color  = nodeColor(ev?.rating)
    const isGenerating = generatingFor === selectedTopic

    if (topicQ.length === 0 && !generatingFor && topics.length > 0) {
      generateQuestionsForTopic(selectedTopic)
    }

    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 4 }}>Quizzes</h1>
          <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Topic-based practice</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <button onClick={() => setSelectedTopic(null)} className="t-btn t-btn-ghost t-btn-sm" disabled={!!generatingFor}>
            ← Mind Map
          </button>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flex: 1,
            padding: '8px 16px', borderRadius: 10,
            background: `${color}10`, border: `1.5px solid ${color}30`, borderLeft: `4px solid ${color}`,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a', margin: 0 }}>{selectedTopic}</p>
              {parentMap[selectedTopic] && (
                <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: '1px 0 0', fontWeight: 500 }}>
                  subtopic of <strong style={{ color: '#6366f1' }}>{parentMap[selectedTopic]}</strong>
                </p>
              )}
            </div>
            {ev?.rating && (
              <span style={{
                fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
                borderRadius: 999, background: `${color}20`, color, textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>{ratingLabel(ev.rating)}</span>
            )}
          </div>
        </div>

        {topicQ.length > 0 ? (
          <div>
            {/* New Questions button — lets user get a fresh set anytime */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                onClick={() => generateQuestionsForTopic(selectedTopic, true)}
                disabled={!!generatingFor}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', borderRadius: 8, fontSize: '0.78rem', fontWeight: 700,
                  background: generatingFor ? '#f1f5f9' : 'rgba(99,102,241,0.08)',
                  border: '1.5px solid rgba(99,102,241,0.25)',
                  color: generatingFor ? '#9ca3af' : '#6366f1',
                  cursor: generatingFor ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {generatingFor === selectedTopic ? (
                  <><span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Generating…</>
                ) : (
                  <>New Questions</>
                )}
              </button>
            </div>
            <QuestionPractice
              key={selectedTopic}
              questionsData={{ ...questionsData, questions: topicQ }}
              onEvaluationUpdate={handleEvalUpdate}
              onWeakAnswerDetected={() => {}}
              onComplete={() => {
                setQuizCompleted(true)
                setSelectedTopic(null)
              }}
            />
          </div>
        ) : isGenerating || generatingFor ? (
          <div className="t-card" style={{ textAlign: 'center', padding: '56px 32px' }}>
            <div className="t-spinner" style={{ margin: '0 auto 18px' }} />
            <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>Generating questions for "{selectedTopic}"…</p>
            <p style={{ fontSize: '0.83rem', color: '#6b7280' }}>Ollama is crafting targeted questions. This takes 10–30 seconds.</p>
          </div>
        ) : (
          <div className="t-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Could not generate questions for "{selectedTopic}"</p>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 20 }}>Make sure Ollama is running, then try again.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => generateQuestionsForTopic(selectedTopic)} className="t-btn t-btn-primary t-btn-sm">Retry</button>
              <button onClick={() => setSelectedTopic(null)} className="t-btn t-btn-ghost t-btn-sm">← Back</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  /* ══════════════════════════════════════════════════════════════
     MIND MAP VIEW (default)
  ══════════════════════════════════════════════════════════════ */
  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 4 }}>
          Quizzes
        </h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 20, alignItems: 'start' }}>

        {/* ── LEFT: Mind map ── */}
        <div>

          {/* Mind map canvas OR inline Bloom panel */}
          {bloomNode ? (
            <div className="t-card" style={{ padding: 0, overflow: 'hidden' }}>
              <BloomPanel
                concept={bloomNode.name}
                parentTopic={bloomNode.parentName}
                onQuizComplete={({ concept, score, rating, nodes = [], improvements = [] }) => {
                  // Update evalData so the mind map node recolours immediately
                  setEvalData(prev => {
                    const merged = { ...prev, [concept]: { score, rating } }
                    localStorage.setItem('learningEvaluationData', JSON.stringify(merged))
                    // Store dep graph data for Prerequisite Graph
                    const depGraphs = (() => {
                      try { return JSON.parse(localStorage.getItem('topicDepGraphs') || '{}') } catch { return {} }
                    })()
                    depGraphs[concept] = { score, rating, nodes, improvements, testedAt: Date.now() }
                    localStorage.setItem('topicDepGraphs', JSON.stringify(depGraphs))
                    return merged
                  })
                }}
                onClose={() => setBloomNode(null)}
                inline
              />
            </div>
          ) : (
            <div className="t-card" style={{ padding: '18px', background: 'linear-gradient(135deg,#f8faff 0%,#f0f4ff 100%)' }}>
              <QuizMindMap
                key={JSON.stringify(Object.keys(evalData).map(k => evalData[k]?.rating))}
                topics={topics}
                evalData={evalData}
                courseTitle={sessionTitle}
                onSelectTopic={setSelectedTopic}
                onSelectSubtopic={(subtopicName) => setSelectedTopic(subtopicName)}
                onCardClick={(name, parentName) => setBloomNode({ name, parentName })}
              />
            </div>
          )}

          <p style={{ fontSize: '0.75rem', color: '#9ca3af', textAlign: 'center', marginTop: 10 }}>
            {bloomNode ? '' : 'Hover a node to preview • Click to open Bloom practice'}
          </p>


          {/* Learning path for weak topics */}
          {weakTopics.length > 0 && (
            <LearningPathPanel
              weakTopics={weakTopics}
              allTopics={topics.map(getName)}
              dependencyData={dependencyData}
              extractedText={sessionText}
              onPractice={setSelectedTopic}
            />
          )}
        </div>

        {/* ── RIGHT: Stats sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Summary */}
          <div className="t-card" style={{ padding: '18px' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              Summary
            </p>
            {[
              { label: 'Total Topics', value: topics.length,                                                                          color: '#6366f1' },
              { label: 'Mastered',     value: masteredCount,                                                                          color: '#22c55e' },
              { label: 'In Progress',  value: topics.filter(t => ['partial','moderate'].includes(evalData[getName(t)]?.rating)).length, color: '#f59e0b' },
              { label: 'Needs Work',   value: weakTopics.length,                                                                       color: '#ef4444' },
              { label: 'Not Started',  value: topics.filter(t => !evalData[getName(t)]).length,                                        color: '#9ca3af' },
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f8faff' }}>
                <span style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500 }}>{s.label}</span>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Topic list (quick access) */}
          <div className="t-card" style={{ padding: '18px' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
              All Topics
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {topics.map(t => {
                const name  = getName(t)
                const color = nodeColor(evalData[name]?.rating)
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedTopic(name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
                      borderRadius: 8, background: `${color}08`, border: `1.5px solid ${color}25`,
                      cursor: 'pointer', textAlign: 'left', width: '100%',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = `${color}18`}
                    onMouseLeave={e => e.currentTarget.style.background = `${color}08`}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#0f172a', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                    <span style={{ fontSize: '0.65rem', color, fontWeight: 700, flexShrink: 0 }}>
                      {ratingLabel(evalData[name]?.rating)}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Go to Learn */}
          <div className="t-card" style={{ padding: '14px 16px', background: 'rgba(99,102,241,0.04)', border: '1.5px solid rgba(99,102,241,0.15)' }}>
            <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>New Syllabus?</p>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 10 }}>Upload one to generate a new mind map and quiz set.</p>
            <Link to="/concept-graph" style={{
              display: 'block', textAlign: 'center', padding: '8px 0', borderRadius: 8,
              background: 'linear-gradient(135deg,#6366f1,#3b82f6)',
              color: '#fff', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none',
            }}>
              Go to Learn →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
