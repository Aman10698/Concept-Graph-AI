import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/* ── Donut Chart ─────────────────────────────────────────── */
function DonutChart({ strong, partial, weak, notPractised, total }) {
  const size = 110, sw = 20, r = (size - sw) / 2, circ = 2 * Math.PI * r
  const segs = [
    { v: strong,       color: '#22c55e' },
    { v: partial,      color: '#f59e0b' },
    { v: weak,         color: '#ef4444' },
    { v: notPractised, color: '#e9eaf0' },
  ]
  const tot = total || 1
  let cum = 0
  return (
    <svg width={size} height={size} style={{ display: 'block' }}>
      {tot === notPractised ? (
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e9eaf0" strokeWidth={sw} />
      ) : (
        segs.map((s, i) => {
          if (!s.v) { cum += s.v / tot; return null }
          const dash = (s.v / tot) * circ
          const angle = cum * 360 - 90
          cum += s.v / tot
          return <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
            stroke={s.color} strokeWidth={sw}
            strokeDasharray={`${dash} ${circ}`} strokeDashoffset={0}
            transform={`rotate(${angle} ${size/2} ${size/2})`} />
        })
      )}
      <circle cx={size/2} cy={size/2} r={r - sw/2 - 2} fill="white" />
    </svg>
  )
}

/* ── Stat Card ─────────────────────────────────────────────── */
function StatCard({ label, value, sub, color = '#6366f1', pct, icon }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '20px 22px',
      border: '1px solid #eef0f6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      display: 'flex', flexDirection: 'column', gap: 8,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {label}
        </span>
        {icon && (
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem' }}>
            {icon}
          </div>
        )}
      </div>
      <p style={{ fontSize: '2rem', fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.03em', lineHeight: 1, margin: 0 }}>
        {value}
      </p>
      {pct !== undefined && (
        <div style={{ height: 5, background: '#f1f3f9', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)`, borderRadius: 999, transition: 'width 0.6s ease' }} />
        </div>
      )}
      {sub && <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>{sub}</p>}
    </div>
  )
}

/* ── Activity Item ────────────────────────────────────────── */
function ActivityItem({ name, rating, score, index }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  const bg    = score >= 70 ? '#f0fdf4' : score >= 40 ? '#fffbeb' : '#fef2f2'
  const icons = { 0: '✅', 1: '📊', 2: '⭐', 3: '💡', 4: '🎯' }
  const timeAgo = index === 0 ? '2h ago' : index === 1 ? '1d ago' : '2d ago'
  const actions = ['Solved questions on', 'Watched video on', 'Scored in quiz on']
  const action = actions[index % 3]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 12, background: '#f9fafb',
      border: '1px solid #f1f3f9',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', flexShrink: 0 }}>
        {icons[index % 5]}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e1b4b', margin: 0, lineHeight: 1.3 }}>
          {action} <strong>{name}</strong>
        </p>
        <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '2px 0 0', lineHeight: 1 }}>{timeAgo}</p>
      </div>
      <div style={{
        padding: '3px 10px', borderRadius: 999, background: bg,
        fontSize: '0.72rem', fontWeight: 700, color,
      }}>
        {score > 0 ? `${score}%` : rating}
      </div>
    </div>
  )
}

/* ── Main ─────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth()  // eslint-disable-line no-unused-vars
  const location = useLocation()
  const [topicsData,    setTopicsData]    = useState(null)
  const [evalData,      setEvalData]      = useState({})
  const [questionsData, setQuestionsData] = useState(null)
  const [answeredQ,     setAnsweredQ]     = useState(0)

  useEffect(() => {
    const load = () => {
      try {
        const t = localStorage.getItem('learningTopicsData')
        const e = localStorage.getItem('learningEvaluationData')
        const q = localStorage.getItem('learningQuestionsData')
        const aq = parseInt(localStorage.getItem('answeredQuestionsCount') || '0', 10)
        const hasSession = !!localStorage.getItem('activeSessionId')
        if (!hasSession && !t) {
          setTopicsData(null); setEvalData({}); setQuestionsData(null); setAnsweredQ(0); return
        }
        setTopicsData(t ? JSON.parse(t) : null)
        setEvalData(e ? JSON.parse(e) : {})
        setQuestionsData(q ? JSON.parse(q) : null)
        setAnsweredQ(aq)
      } catch { /* ignore */ }
    }
    load()
    window.addEventListener('storage', load)
    return () => window.removeEventListener('storage', load)
  }, [location.pathname])

  const topics  = topicsData?.topics ?? []
  const getName = t => typeof t === 'string' ? t : t.name

  // Build the full node list: every top-level module + every subtopic underneath it
  // This matches what the mind map actually shows as clickable nodes
  const allNodes = [
    ...topics.map(getName),
    ...topics.flatMap(t =>
      Array.isArray(t.subtopics)
        ? t.subtopics.map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean)
        : []
    ),
  ]
  const totalTopics = allNodes.length  // true node count across the whole graph

  // Only count evalData entries that correspond to actual nodes in the graph
  const answeredNodes    = allNodes.filter(n => evalData[n])
  const answered         = answeredNodes.length
  const notPractised     = Math.max(totalTopics - answered, 0)

  const nodeRatings      = answeredNodes.map(n => evalData[n])
  const strong           = nodeRatings.filter(r => r.rating === 'strong').length
  const partial          = nodeRatings.filter(r => r.rating === 'partial' || r.rating === 'moderate').length
  const weak             = nodeRatings.filter(r => r.rating === 'weak').length

  // Avg quiz score across all evaluated nodes
  const scoredRatings    = nodeRatings.filter(r => typeof r.score === 'number')
  const accuracy         = scoredRatings.length > 0
    ? Math.round(scoredRatings.reduce((sum, r) => sum + r.score, 0) / scoredRatings.length)
    : 0

  // Mastery = % of ALL nodes rated 'strong'
  const mastery = totalTopics > 0 ? Math.round((strong / totalTopics) * 100) : 0

  const courseTitle = topicsData?.subject || topicsData?.title || 'Course'

  // Per-module progress: completion = practiced subtopics / total subtopics
  const moduleStats = topics.map(t => {
    const name      = getName(t)
    const ev        = evalData[name]
    const rawSubs   = Array.isArray(t.subtopics) ? t.subtopics : []
    const subtopics = rawSubs.map(s => {
      const sName = typeof s === 'string' ? s : s.name
      const sEv   = evalData[sName]
      return { name: sName, score: sEv?.score ?? null, rating: sEv?.rating ?? 'not_tried' }
    })

    const totalSubs    = subtopics.length
    const practicedSubs = subtopics.filter(s => s.rating !== 'not_tried').length
    // Also count if the module itself was quizzed directly (no subtopics)
    const moduleQuizzed = ev != null

    // Completion pct = practiced / total (for display bar)
    const completionPct = totalSubs > 0
      ? Math.round((practicedSubs / totalSubs) * 100)
      : moduleQuizzed ? 100 : 0

    // Avg score across practiced nodes (for information)
    const scoredSubs = subtopics.filter(s => typeof s.score === 'number')
    const avgScore = scoredSubs.length > 0
      ? Math.round(scoredSubs.reduce((a, s) => a + s.score, 0) / scoredSubs.length)
      : ev?.score ?? null

    const practiced = totalSubs > 0 ? practicedSubs : (moduleQuizzed ? 1 : 0)
    const total     = totalSubs > 0 ? totalSubs : 1

    return {
      name,
      completionPct,
      avgScore,
      practiced,
      total,
      rating: ev?.rating ?? 'not_tried',
      subtopics,
    }
  })

  /* ── Empty state ── */
  if (totalTopics === 0) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Welcome Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 50%, #3b82f6 100%)',
          borderRadius: 20, padding: '32px 40px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 8px 32px rgba(124,58,237,0.25)',
        }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', marginBottom: 8 }}>
              Welcome to ConceptGraph AI! 👋
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginBottom: 20, maxWidth: 480 }}>
              Upload your first syllabus to generate your personalized knowledge graph, then practice to track your mastery.
            </p>
            <Link to="/concept-graph" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 24px', borderRadius: 12,
              background: '#fff', color: '#7c3aed',
              fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
            }}>
              🚀 Upload Syllabus
            </Link>
          </div>
          <div style={{ fontSize: '5rem', opacity: 0.85, lineHeight: 1 }}>🧠</div>
        </div>

        {/* Quick start cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[
            { icon: '📤', title: 'Upload Syllabus', desc: 'Upload a PDF or image of your course syllabus', link: '/concept-graph', color: '#7c3aed' },
            { icon: '🧪', title: 'Practice Topics', desc: 'Quiz yourself on any concept in your graph', link: '/practice', color: '#22c55e' },
            { icon: '📊', title: 'View Progress', desc: 'Track your mastery level across all topics', link: '/dashboard', color: '#3b82f6' },
          ].map(item => (
            <Link key={item.title} to={item.link} style={{
              background: '#fff', border: '1px solid #eef0f6', borderRadius: 16,
              padding: '20px', textDecoration: 'none',
              display: 'flex', flexDirection: 'column', gap: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'all 0.2s',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>
                {item.icon}
              </div>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e1b4b', margin: '0 0 4px' }}>{item.title}</p>
                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20, background: '#f7f8fc', minHeight: 'calc(100vh - 64px)' }}>

      {/* Active course banner */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
        background: 'linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)',
        borderRadius: 16, padding: '16px 24px',
        boxShadow: '0 4px 20px rgba(124,58,237,0.2)',
      }}>
        <div>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Currently Studying
          </p>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', margin: 0 }}>
            {courseTitle}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to="/concept-graph" style={{
            padding: '9px 18px', borderRadius: 10, background: 'rgba(255,255,255,0.2)',
            color: '#fff', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none',
            border: '1.5px solid rgba(255,255,255,0.3)', transition: 'all 0.2s',
          }}>
            View Graph →
          </Link>
          <Link to="/practice" style={{
            padding: '9px 18px', borderRadius: 10, background: '#fff',
            color: '#7c3aed', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none',
            transition: 'all 0.2s',
          }}>
            Practice
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        <StatCard
          label="Topics Practiced"
          value={`${answered}/${totalTopics}`}
          pct={totalTopics > 0 ? Math.round(answered/totalTopics*100) : 0}
          sub={answered === 0 ? 'Start by clicking any node!' : `${Math.round(answered/totalTopics*100)}% attempted`}
          color="#6366f1"
          icon="📚"
        />
        <StatCard
          label="Questions Answered"
          value={answeredQ}
          sub={answeredQ === 0 ? 'Start practicing!' : `questions answered so far`}
          color="#3b82f6"
          icon="❓"
        />
        <StatCard
          label="Avg Quiz Score"
          value={scoredRatings.length > 0 ? `${accuracy}%` : '—'}
          pct={accuracy}
          sub={accuracy >= 75 ? 'Great performance!' : accuracy > 0 ? 'Keep practicing!' : 'Take a quiz first'}
          color={accuracy >= 75 ? '#22c55e' : accuracy > 0 ? '#f59e0b' : '#9ca3af'}
          icon="🎯"
        />
        <StatCard
          label="Overall Mastery"
          value={`${mastery}%`}
          pct={mastery}
          sub={`${strong}/${totalTopics} topics mastered`}
          color="#7c3aed"
          icon="🏆"
        />
      </div>

      {/* Main content: Progress + Concept Map + Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Left: concept map preview + activity */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Concept Map Preview */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #eef0f6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e1b4b', margin: 0 }}>
                Concept Map <span style={{ color: '#9ca3af', fontWeight: 400 }}>(Preview)</span>
              </h2>
              <Link to="/concept-graph" style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>
                Open Full Graph →
              </Link>
            </div>

            {/* tree preview */}
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 420 }}>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ padding: '8px 24px', borderRadius: 10, background: '#f5f3ff', border: '2px solid #c4b5fd', fontWeight: 800, fontSize: '0.85rem', color: '#5b21b6' }}>
                    {courseTitle}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <div style={{ width: 2, height: 20, background: '#e2e8f0' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 10, flexWrap: 'wrap', paddingBottom: 4 }}>
                  {topics.map(t => {
                    const name   = getName(t)
                    const r      = evalData[name]?.rating
                    const bg     = r === 'strong' ? '#f0fdf4' : r === 'partial' || r === 'moderate' ? '#fffbeb' : r === 'weak' ? '#fef2f2' : '#f9fafb'
                    const border = r === 'strong' ? '#86efac' : r === 'partial' || r === 'moderate' ? '#fcd34d' : r === 'weak' ? '#fca5a5' : '#e2e8f0'
                    const color  = r === 'strong' ? '#166534' : r === 'partial' || r === 'moderate' ? '#92400e' : r === 'weak' ? '#991b1b' : '#374151'
                    const score  = evalData[name]?.score
                    return (
                      <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ padding: '6px 11px', borderRadius: 9, background: bg, border: `1.5px solid ${border}`, fontSize: '0.73rem', fontWeight: 600, color }}>
                          {name}
                          {score !== undefined && <span style={{ marginLeft: 6, fontSize: '0.68rem', opacity: 0.8 }}>{score}%</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
                  {[['#22c55e','Strong'],['#f59e0b','Partial'],['#ef4444','Weak'],['#9ca3af','Not Tried']].map(([c,l]) => (
                    <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
                      <span style={{ fontSize: '0.68rem', color: '#6b7280' }}>{l}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #eef0f6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e1b4b', margin: 0 }}>Recent Activity</h3>
              <Link to="/practice" style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 700, textDecoration: 'none' }}>
                View All →
              </Link>
            </div>
            {Object.entries(evalData).length === 0 ? (
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>
                No activity yet — click a concept node to start a quiz!
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(evalData).slice(0, 4).map(([name, ev], i) => (
                  <ActivityItem
                    key={name}
                    name={name}
                    rating={ev.rating || 'Quiz'}
                    score={ev.score ?? ev.confidence ?? 0}
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Progress donut + breakdown + per-module mastery + recommendations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Knowledge Distribution */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #eef0f6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e1b4b', marginBottom: 16 }}>Knowledge Distribution</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
              <DonutChart strong={strong} partial={partial} weak={weak} notPractised={notPractised} total={totalTopics} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '2.2rem', fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 4 }}>{mastery}%</p>
                <p style={{ fontSize: '0.75rem', color: mastery >= 70 ? '#22c55e' : mastery >= 40 ? '#f59e0b' : '#9ca3af', fontWeight: 600, marginBottom: 2 }}>
                  {mastery >= 70 ? 'Good Progress! 🎉' : mastery >= 40 ? 'Keep Going! 💪' : 'Just Started 🌱'}
                </p>
                <p style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{strong}/{totalTopics} concepts mastered</p>
              </div>
            </div>

            {[
              { label: 'Strong', count: strong, color: '#22c55e', bg: '#f0fdf4' },
              { label: 'Partial', count: partial, color: '#f59e0b', bg: '#fffbeb' },
              { label: 'Weak', count: weak, color: '#ef4444', bg: '#fef2f2' },
              { label: 'Not Tried', count: notPractised, color: '#9ca3af', bg: '#f9fafb' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                <span style={{ fontSize: '0.75rem', color: '#4b5563', flex: 1 }}>{item.label}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: item.color }}>{item.count}</span>
                <div style={{ width: 60, height: 4, background: '#f1f3f9', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${totalTopics > 0 ? (item.count/totalTopics)*100 : 0}%`, background: item.color, borderRadius: 999 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Per-module mastery */}
          {moduleStats.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #eef0f6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e1b4b', marginBottom: 14 }}>Module Mastery</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 300, overflowY: 'auto' }}>
                {moduleStats.map(m => {
                  const barColor = m.completionPct === 100 ? '#22c55e'
                    : m.completionPct > 0 ? '#6366f1' : '#d1d5db'
                  const badgeColor = m.completionPct === 100 ? '#22c55e'
                    : m.completionPct > 0 ? '#6366f1' : '#9ca3af'
                  const badgeBg = m.completionPct === 100 ? '#f0fdf4'
                    : m.completionPct > 0 ? '#f5f3ff' : '#f9fafb'
                  const badgeText = m.completionPct === 0
                    ? 'Not tried'
                    : m.completionPct === 100
                      ? (m.avgScore !== null ? `${m.avgScore}% avg` : 'Done')
                      : `${m.practiced}/${m.total} topics`
                  return (
                    <div key={m.name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: badgeColor, background: badgeBg, padding: '2px 8px', borderRadius: 6, marginLeft: 8, flexShrink: 0 }}>
                          {badgeText}
                        </span>
                      </div>
                      <div style={{ height: 5, background: '#f1f3f9', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${m.completionPct}%`, background: `linear-gradient(90deg, ${barColor}, ${barColor}cc)`, borderRadius: 999, transition: 'width 0.5s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recommendations */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #eef0f6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e1b4b', marginBottom: 14 }}>Recommendations</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {weak > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fef2f2', border: '1.5px solid #fca5a5' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Priority Action</p>
                  <p style={{ fontSize: '0.78rem', color: '#991b1b', margin: 0 }}>
                    You have <strong>{weak} weak</strong> topic{weak > 1 ? 's' : ''} — focus there first!
                  </p>
                </div>
              )}
              {partial > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: '#fffbeb', border: '1.5px solid #fcd34d' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Practice More</p>
                  <p style={{ fontSize: '0.78rem', color: '#92400e', margin: 0 }}>
                    {partial} topic{partial > 1 ? 's' : ''} need reinforcement
                  </p>
                </div>
              )}
              {notPractised > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f5f3ff', border: '1.5px solid #ddd6fe' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Not Started</p>
                  <p style={{ fontSize: '0.78rem', color: '#4c1d95', margin: 0 }}>
                    {notPractised} topic{notPractised > 1 ? 's' : ''} haven't been practiced yet
                  </p>
                </div>
              )}
              {weak === 0 && partial === 0 && notPractised === 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
                  <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Excellent Work</p>
                  <p style={{ fontSize: '0.78rem', color: '#166534', margin: 0 }}>All topics mastered! Keep practicing to maintain mastery.</p>
                </div>
              )}

              <Link to="/concept-graph" style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '10px', borderRadius: 10,
                background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
                color: '#fff', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(124,58,237,0.25)', marginTop: 4,
              }}>
                Open Knowledge Graph →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
