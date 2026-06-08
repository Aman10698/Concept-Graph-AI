import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { onEvalChange, offEvalChange } from '../utils/evalBus'

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

/* ── helpers ─────────────────────────────────────────────── */
function timeAgoStr(ts) {
  if (!ts) return 'Recently'
  const diff = Date.now() - ts
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7)   return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

function ratingToAction(rating) {
  if (rating === 'strong')  return 'Mastered'
  if (rating === 'partial' || rating === 'moderate') return 'In Progress'
  if (rating === 'weak')    return 'Needs Work'
  return 'Practised'
}

/* ── Activity Item ────────────────────────────────────────── */
function ActivityItem({ name, rating, score, practicedAt }) {
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  const bg    = score >= 70 ? '#f0fdf4' : score >= 40 ? '#fffbeb' : '#fef2f2'
  const color2 = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  const action = ratingToAction(rating)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderRadius: 12, background: '#f9fafb',
      border: '1px solid #f1f3f9',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: color2 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e1b4b', margin: 0, lineHeight: 1.3 }}>
          {action} — <strong>{name}</strong>
        </p>
        <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '2px 0 0', lineHeight: 1 }}>{timeAgoStr(practicedAt)}</p>
      </div>
      <div style={{
        padding: '3px 10px', borderRadius: 999, background: bg,
        fontSize: '0.72rem', fontWeight: 700, color,
      }}>
        {score > 0 ? `${score}%` : action}
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
  const [showFullGraph, setShowFullGraph] = useState(false)

  useEffect(() => {
    const load = () => {
      try {
        const t = localStorage.getItem('learningTopicsData')
        const e = localStorage.getItem('learningEvaluationData')
        const hasSession = !!localStorage.getItem('activeSessionId')
        if (!hasSession && !t) {
          setTopicsData(null); setEvalData({}); return
        }
        setTopicsData(t ? JSON.parse(t) : null)
        setEvalData(e ? JSON.parse(e) : {})
      } catch { /* ignore */ }
    }
    load()
    // onEvalChange listens to BOTH the custom same-tab event AND the native cross-tab storage event
    onEvalChange(load)
    return () => offEvalChange(load)
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

  // moduleStats (per-module progress) — available for future UI enhancements

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
              Welcome to ConceptGraph AI!
            </h1>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '0.9rem', marginBottom: 20, maxWidth: 480 }}>
              Upload your first syllabus to generate your personalized knowledge graph, then practice to track your mastery.
            </p>
            <Link to="/syllabuses" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 24px', borderRadius: 12,
              background: '#fff', color: '#7c3aed',
              fontWeight: 700, fontSize: '0.88rem', textDecoration: 'none',
              boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
              transition: 'all 0.2s',
            }}>
              Upload Syllabus
            </Link>
          </div>

        </div>

        {/* Quick start cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          {[
            { title: 'Upload Syllabus', desc: 'Upload a PDF or image of your course syllabus', link: '/syllabuses', color: '#7c3aed' },
            { title: 'Practice Topics', desc: 'Quiz yourself on any concept in your graph', link: '/practice', color: '#22c55e' },
            { title: 'View Progress', desc: 'Track your mastery level across all topics', link: '/dashboard', color: '#3b82f6' },
          ].map(item => (
            <Link key={item.title} to={item.link} style={{
              background: '#fff', border: '1px solid #eef0f6', borderRadius: 16,
              padding: '20px', textDecoration: 'none',
              display: 'flex', flexDirection: 'column', gap: 10,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)', transition: 'all 0.2s',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: item.color }} />
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <StatCard
          label="Topics Practiced"
          value={`${answered}/${totalTopics}`}
          pct={totalTopics > 0 ? Math.round(answered/totalTopics*100) : 0}
          sub={answered === 0 ? 'Start by clicking any node!' : `${Math.round(answered/totalTopics*100)}% attempted`}
          color="#6366f1"

        />

        <StatCard
          label="Avg Quiz Score"
          value={scoredRatings.length > 0 ? `${accuracy}%` : '—'}
          pct={accuracy}
          sub={accuracy >= 75 ? 'Great performance!' : accuracy > 0 ? 'Keep practicing!' : 'Take a quiz first'}
          color={accuracy >= 75 ? '#22c55e' : accuracy > 0 ? '#f59e0b' : '#9ca3af'}
        />
        <StatCard
          label="Overall Mastery"
          value={`${mastery}%`}
          pct={mastery}
          sub={`${strong}/${totalTopics} topics mastered`}
          color="#7c3aed"
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
              <button
                onClick={() => setShowFullGraph(true)}
                style={{ fontSize: '0.75rem', color: '#6366f1', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}
              >
                Open Full Graph →
              </button>
            </div>

            {/* tree preview — root → modules fan-out */}
            <div style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 420 }}>
                {/* Compute root pct = avg coverage across all modules */}
                {(() => {
                  const getModuleCoverage = (t) => {
                    const n    = getName(t)
                    const subs = typeof t === 'object' && Array.isArray(t.subtopics)
                      ? t.subtopics.map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean)
                      : []
                    if (subs.length === 0) return evalData[n] ? 100 : 0
                    const all      = [n, ...subs]
                    const practised = all.filter(x => !!evalData[x]).length
                    return Math.round((practised / all.length) * 100)
                  }

                  const rootPct = topics.length > 0
                    ? Math.round(topics.reduce((acc, t) => acc + getModuleCoverage(t), 0) / topics.length)
                    : 0

                  return (
                    <>
                      {/* Root node */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{
                          padding: '10px 20px', borderRadius: 12,
                          background: 'linear-gradient(135deg, #faf5ff, #f5f3ff)',
                          border: '2px solid #c4b5fd',
                          minWidth: 140, maxWidth: 200,
                        }}>
                          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: '#5b21b6', marginBottom: 4, textAlign: 'center' }}>{courseTitle}</div>
                          <div style={{ fontSize: '0.62rem', fontWeight: 700, color: '#7c3aed', textAlign: 'center', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Root Concept</div>
                          <div style={{ height: 4, background: '#ede9fe', borderRadius: 999, overflow: 'hidden', marginBottom: 3 }}>
                            <div style={{ height: '100%', width: `${rootPct}%`, background: '#7c3aed', borderRadius: 999, transition: 'width 0.6s ease' }} />
                          </div>
                          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', textAlign: 'right' }}>{rootPct}%</div>
                        </div>
                      </div>

                      {/* Connector line */}
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: 2, height: 16, background: '#c4b5fd' }} />
                      </div>

                      {/* Horizontal branch line */}
                      {topics.length > 1 && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 0 }}>
                          <div style={{ height: 2, background: '#c4b5fd', width: '70%', borderRadius: 1 }} />
                        </div>
                      )}

                      {/* Module nodes with progress bars */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', paddingTop: topics.length > 1 ? 0 : 4 }}>
                        {topics.map(t => {
                          const name      = getName(t)
                          const ev        = evalData[name]
                          const r         = ev?.rating
                          // coverage = topics practised / total topics in this module
                          const coverage  = getModuleCoverage(t)
                          const barColor  = coverage === 100 ? '#22c55e' : coverage > 0 ? '#6366f1' : '#e2e8f0'
                          const textColor = coverage === 100 ? '#166534' : coverage > 0 ? '#3730a3' : '#374151'
                          const bg        = coverage === 100 ? '#f0fdf4' : coverage > 0 ? '#f5f3ff' : '#f9fafb'
                          const border    = coverage === 100 ? '#86efac' : coverage > 0 ? '#c4b5fd' : '#e2e8f0'
                          // show rating badge if practised
                          const rLabel    = r === 'strong' ? 'Strong' : r === 'partial' || r === 'moderate' ? 'Partial' : r === 'weak' ? 'Weak' : null
                          return (
                            <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              {topics.length > 1 && <div style={{ width: 2, height: 12, background: '#c4b5fd' }} />}
                              <div style={{
                                padding: '7px 10px', borderRadius: 9,
                                background: bg, border: `1.5px solid ${border}`,
                                minWidth: 90, maxWidth: 130,
                              }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: textColor, marginBottom: 5, lineHeight: 1.3 }}>{name}</div>
                                {rLabel && (
                                  <div style={{ fontSize: '0.6rem', fontWeight: 700, color: textColor, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em', opacity: 0.8 }}>{rLabel}</div>
                                )}
                                <div style={{ height: 3, background: '#f1f3f9', borderRadius: 999, overflow: 'hidden', marginBottom: 2 }}>
                                  <div style={{ height: '100%', width: `${coverage}%`, background: barColor, borderRadius: 999, transition: 'width 0.6s ease' }} />
                                </div>
                                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: textColor, textAlign: 'right' }}>{coverage}%</div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Legend */}
                      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 12, flexWrap: 'wrap' }}>
                        {[['#22c55e', 'Fully Covered'], ['#6366f1', 'In Progress'], ['#9ca3af', 'Not Started']].map(([c, l]) => (
                          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <div style={{ width: 7, height: 7, borderRadius: '50%', background: c }} />
                            <span style={{ fontSize: '0.65rem', color: '#6b7280' }}>{l}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )
                })()}
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
                {Object.entries(evalData)
                  .filter(([, ev]) => ev.rating)
                  .sort(([, a], [, b]) => (b.practicedAt || 0) - (a.practicedAt || 0))
                  .slice(0, 4)
                  .map(([name, ev]) => (
                    <ActivityItem
                      key={name}
                      name={name}
                      rating={ev.rating}
                      score={ev.score ?? ev.confidence ?? 0}
                      practicedAt={ev.practicedAt}
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
                  {mastery >= 70 ? 'Good Progress!' : mastery >= 40 ? 'Keep Going!' : 'Just Started'}
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
          {/* Learning Streak */}
          {(() => {
            // Build a streak from evalData practicedAt timestamps
            const practiceDays = Object.values(evalData)
              .filter(ev => ev.practicedAt)
              .map(ev => {
                const d = new Date(ev.practicedAt)
                return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
              })
            const uniqueDays = [...new Set(practiceDays)].sort().reverse()

            // Calculate current streak (consecutive days ending today or yesterday)
            let streak = 0
            const today = new Date()
            for (let i = 0; i < uniqueDays.length; i++) {
              const check = new Date(today)
              check.setDate(today.getDate() - i)
              const key = `${check.getFullYear()}-${check.getMonth()}-${check.getDate()}`
              if (uniqueDays.includes(key)) streak++
              else break
            }

            // Last 7 days activity grid
            const last7 = Array.from({ length: 7 }, (_, i) => {
              const d = new Date(today)
              d.setDate(today.getDate() - (6 - i))
              const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
              const label = d.toLocaleDateString('en-US', { weekday: 'short' })
              return { label, active: uniqueDays.includes(key) }
            })

            return (
              <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #eef0f6', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#1e1b4b', margin: 0 }}>Learning Streak</h3>
                  <div style={{
                    padding: '4px 12px', borderRadius: 999,
                    background: streak > 0 ? 'rgba(249,115,22,0.1)' : '#f9fafb',
                    border: `1px solid ${streak > 0 ? 'rgba(249,115,22,0.25)' : '#e2e8f0'}`,
                  }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: streak > 0 ? '#ea580c' : '#9ca3af' }}>
                      {streak} day{streak !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Last 7 days grid */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between', marginBottom: 12 }}>
                  {last7.map((day, i) => (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8,
                        background: day.active
                          ? 'linear-gradient(135deg, #f97316, #ea580c)'
                          : '#f1f3f9',
                        boxShadow: day.active ? '0 2px 8px rgba(249,115,22,0.3)' : 'none',
                        transition: 'all 0.2s',
                      }} />
                      <span style={{ fontSize: '0.6rem', color: day.active ? '#ea580c' : '#9ca3af', fontWeight: 600 }}>
                        {day.label}
                      </span>
                    </div>
                  ))}
                </div>

                <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>
                  {streak === 0
                    ? 'Practice today to start your streak!'
                    : streak === 1
                      ? 'Good start! Come back tomorrow to build your streak.'
                      : `${streak}-day streak — keep it up!`}
                </p>
              </div>
            )
          })()}

        </div>
      </div>

      {/* Full Graph Overlay */}
      {showFullGraph && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'linear-gradient(160deg, #f0f4ff 0%, #f8faff 40%, #eef2fb 100%)',
          display: 'flex', flexDirection: 'column',
          animation: 'dash-fadein 0.25s ease-out',
        }}>
          <style>{`@keyframes dash-fadein { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }`}</style>

          {/* Overlay header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 28px',
            background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(99,102,241,0.1)',
            flexShrink: 0,
          }}>
            <div>
              <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.2rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
                {courseTitle}
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>Concept Map — Full View</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Link to="/syllabuses" style={{
                padding: '9px 20px', borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff', fontWeight: 700, fontSize: '0.82rem', textDecoration: 'none',
                boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
              }}>
                Open Full Editor →
              </Link>
              <button
                onClick={() => setShowFullGraph(false)}
                style={{
                  padding: '9px 18px', borderRadius: 12,
                  border: '1.5px solid #e2e8f0', background: '#fff',
                  color: '#374151', fontWeight: 700, fontSize: '0.82rem',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#374151'; }}
              >
                ✕ Close
              </button>
            </div>
          </div>

          {/* Overlay content — full-screen concept tree */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '40px 40px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 36, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Total Nodes', val: totalTopics, color: '#6366f1' },
                { label: 'Practiced', val: answered, color: '#3b82f6' },
                { label: 'Mastered', val: strong, color: '#22c55e' },
                { label: 'Needs Work', val: weak, color: '#ef4444' },
              ].map(s => (
                <div key={s.label} style={{
                  padding: '12px 20px', borderRadius: 14,
                  background: 'rgba(255,255,255,0.85)', border: '1px solid rgba(99,102,241,0.1)',
                  boxShadow: '0 2px 12px rgba(99,102,241,0.06)', minWidth: 100, textAlign: 'center',
                }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.val}</div>
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Full concept tree */}
            <div style={{ width: '100%', maxWidth: 1000 }}>
              {(() => {
                const getModuleCoverage = (t) => {
                  const n    = getName(t)
                  const subs = typeof t === 'object' && Array.isArray(t.subtopics)
                    ? t.subtopics.map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean)
                    : []
                  if (subs.length === 0) return evalData[n] ? 100 : 0
                  const all      = [n, ...subs]
                  const practised = all.filter(x => !!evalData[x]).length
                  return Math.round((practised / all.length) * 100)
                }
                const rootPct = topics.length > 0
                  ? Math.round(topics.reduce((acc, t) => acc + getModuleCoverage(t), 0) / topics.length)
                  : 0

                return (
                  <>
                    {/* Root node */}
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 0 }}>
                      <div style={{
                        padding: '14px 28px', borderRadius: 16,
                        background: 'linear-gradient(135deg, #faf5ff, #f5f3ff)',
                        border: '2.5px solid #c4b5fd',
                        boxShadow: '0 4px 20px rgba(124,58,237,0.12)',
                        minWidth: 160, maxWidth: 260, textAlign: 'center',
                      }}>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#5b21b6', marginBottom: 4 }}>{courseTitle}</div>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7c3aed', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Root Concept</div>
                        <div style={{ height: 5, background: '#ede9fe', borderRadius: 999, overflow: 'hidden', marginBottom: 3 }}>
                          <div style={{ height: '100%', width: `${rootPct}%`, background: '#7c3aed', borderRadius: 999 }} />
                        </div>
                        <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#7c3aed', textAlign: 'right' }}>{rootPct}% covered</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{ width: 2, height: 24, background: '#c4b5fd' }} />
                    </div>
                    {topics.length > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 0 }}>
                        <div style={{ height: 2, background: '#c4b5fd', width: '80%', borderRadius: 1 }} />
                      </div>
                    )}

                    {/* Module nodes */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap', paddingTop: topics.length > 1 ? 0 : 8 }}>
                      {topics.map(t => {
                        const name      = getName(t)
                        const ev        = evalData[name]
                        const r         = ev?.rating
                        const coverage  = getModuleCoverage(t)
                        const barColor  = coverage === 100 ? '#22c55e' : coverage > 0 ? '#6366f1' : '#e2e8f0'
                        const textColor = coverage === 100 ? '#166534' : coverage > 0 ? '#3730a3' : '#374151'
                        const bg        = coverage === 100 ? '#f0fdf4' : coverage > 0 ? '#f5f3ff' : '#fff'
                        const border    = coverage === 100 ? '#86efac' : coverage > 0 ? '#c4b5fd' : '#e2e8f0'
                        const rLabel    = r === 'strong' ? 'Strong' : r === 'partial' || r === 'moderate' ? 'Partial' : r === 'weak' ? 'Needs Work' : null
                        const subs      = typeof t === 'object' && Array.isArray(t.subtopics)
                          ? t.subtopics.map(s => typeof s === 'string' ? s : s.name).filter(Boolean)
                          : []
                        return (
                          <div key={name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            {topics.length > 1 && <div style={{ width: 2, height: 20, background: '#c4b5fd' }} />}
                            <div style={{
                              padding: '12px 16px', borderRadius: 14,
                              background: bg, border: `2px solid ${border}`,
                              minWidth: 120, maxWidth: 180,
                              boxShadow: coverage > 0 ? `0 4px 16px ${barColor}20` : 'none',
                              transition: 'all 0.2s',
                            }}>
                              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: textColor, marginBottom: 6, lineHeight: 1.3 }}>{name}</div>
                              {rLabel && (
                                <div style={{ fontSize: '0.62rem', fontWeight: 700, color: textColor, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em', opacity: 0.75 }}>{rLabel}</div>
                              )}
                              <div style={{ height: 4, background: '#f1f3f9', borderRadius: 999, overflow: 'hidden', marginBottom: 3 }}>
                                <div style={{ height: '100%', width: `${coverage}%`, background: barColor, borderRadius: 999 }} />
                              </div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: textColor, textAlign: 'right' }}>{coverage}%</div>

                              {/* Subtopics */}
                              {subs.length > 0 && (
                                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  {subs.map(sub => {
                                    const subEv  = evalData[sub]
                                    const subR   = subEv?.rating
                                    const subColor = subR === 'strong' ? '#22c55e' : subR === 'partial' || subR === 'moderate' ? '#f59e0b' : subR === 'weak' ? '#ef4444' : '#d1d5db'
                                    return (
                                      <div key={sub} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: subColor, flexShrink: 0 }} />
                                        <span style={{ fontSize: '0.62rem', color: '#6b7280', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 32, flexWrap: 'wrap' }}>
                      {[['#22c55e', 'Fully Covered'], ['#6366f1', 'In Progress'], ['#9ca3af', 'Not Started']].map(([c, l]) => (
                        <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
                          <span style={{ fontSize: '0.72rem', color: '#6b7280' }}>{l}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
