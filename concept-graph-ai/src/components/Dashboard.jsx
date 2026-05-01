import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/* ── Donut Chart ─────────────────────────────────────────────────────── */
function DonutChart({ strong, partial, weak, notPractised, total }) {
  const size = 150, sw = 28, r = (size - sw) / 2, circ = 2 * Math.PI * r
  const segs = [
    { v: strong,       color: '#22c55e' },
    { v: partial,      color: '#f59e0b' },
    { v: weak,         color: '#ef4444' },
    { v: notPractised, color: '#e2e8f0' },
  ]
  const tot = total || 1
  let cum = 0
  return (
    <svg width={size} height={size} style={{ display:'block' }}>
      {segs.map((s, i) => {
        if (!s.v) { cum += s.v / tot; return null }
        const dash = (s.v / tot) * circ
        const angle = cum * 360 - 90
        cum += s.v / tot
        return <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
          stroke={s.color} strokeWidth={sw}
          strokeDasharray={`${dash} ${circ}`} strokeDashoffset={0}
          transform={`rotate(${angle} ${size/2} ${size/2})`} />
      })}
      <circle cx={size/2} cy={size/2} r={r - sw/2 - 4} fill="white" />
    </svg>
  )
}

/* ── Stat Card ───────────────────────────────────────────────────────── */
function StatCard({ label, value, sub1, sub2, sub2Color, pct }) {
  return (
    <div className="t-card" style={{ padding:'20px 22px', flex:1 }}>
      <span style={{ fontSize:'0.78rem', fontWeight:600, color:'#6b7280', display:'block', marginBottom:8 }}>{label}</span>
      <p style={{ fontSize:'2rem', fontWeight:800, color:'#0f172a', letterSpacing:'-0.04em', lineHeight:1, marginBottom:6 }}>{value}</p>
      {pct !== undefined && (
        <div style={{ height:5, background:'#f1f5f9', borderRadius:999, overflow:'hidden', marginBottom:6 }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#6366f1,#818cf8)', borderRadius:999 }} />
        </div>
      )}
      <p style={{ fontSize:'0.75rem', color:'#9ca3af', marginBottom:2 }}>{sub1}</p>
      {sub2 && <p style={{ fontSize:'0.75rem', fontWeight:700, color: sub2Color || '#6b7280' }}>{sub2}</p>}
    </div>
  )
}

/* ── Main ────────────────────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [topicsData,    setTopicsData]    = useState(null)
  const [evalData,      setEvalData]      = useState({})
  const [questionsData, setQuestionsData] = useState(null)

  useEffect(() => {
    const load = () => {
      try {
        const t = localStorage.getItem('learningTopicsData')
        const e = localStorage.getItem('learningEvaluationData')
        const q = localStorage.getItem('learningQuestionsData')
        // Only clear if there's no active session AND no topics data at all
        const hasSession = !!localStorage.getItem('activeSessionId')
        if (!hasSession && !t) {
          setTopicsData(null); setEvalData({}); setQuestionsData(null); return
        }
        setTopicsData(t ? JSON.parse(t) : null)
        setEvalData(e ? JSON.parse(e) : {})
        setQuestionsData(q ? JSON.parse(q) : null)
      } catch { /* ignore */ }
    }
    load()
    // Re-load when storage changes (e.g. after a quiz completes)
    window.addEventListener('storage', load)
    return () => window.removeEventListener('storage', load)
  }, [location.pathname])

  const topics       = topicsData?.topics ?? []
  const getName      = t => typeof t === 'string' ? t : t.name
  const totalTopics  = topics.length
  const ratings      = Object.values(evalData)
  const strong       = ratings.filter(r => r.rating === 'strong').length
  const partial      = ratings.filter(r => r.rating === 'partial' || r.rating === 'moderate').length
  const weak         = ratings.filter(r => r.rating === 'weak').length
  const answered     = ratings.length
  const notPractised = Math.max(totalTopics - answered, 0)
  const accuracy     = answered > 0 ? Math.round((strong / answered) * 100) : 0
  const mastery      = totalTopics > 0 ? Math.round((strong / totalTopics) * 100) : 0
  const totalQ       = questionsData?.questions?.length ?? 0
  // Actual questions answered — stored by QuestionPractice on every submit
  const answeredQ    = parseInt(localStorage.getItem('answeredQuestionsCount') || '0', 10)
  const courseTitle  = topicsData?.subject || topicsData?.title || 'Course'
  const weakAreas    = topics.map(getName).filter(n => evalData[n]?.rating === 'weak' || evalData[n]?.rating === 'partial')
  const focusTopic   = weakAreas[0] || null

  const TIPS = [
    'Revisit weak concepts regularly. Small consistent steps lead to strong understanding.',
    'Practice spaced repetition — review topics after 1 day, 3 days, then a week.',
    'Teaching a concept to someone else is the best way to solidify your knowledge.',
  ]
  const tip = TIPS[new Date().getDate() % TIPS.length]

  if (totalTopics === 0) {
    return (
      <div>
        <p style={{ color:'#6b7280', marginBottom:28 }}>Keep learning and strengthening your concepts!</p>
        <div className="t-card" style={{ textAlign:'center', padding:'64px 32px' }}>
          <h2 style={{ fontSize:'1.2rem', fontWeight:800, color:'#0f172a', marginBottom:10 }}>No Learning Data Yet</h2>
          <p style={{ color:'#6b7280', maxWidth:380, margin:'0 auto 28px' }}>
            Upload a syllabus to generate your concept graph, then practice to see your stats here.
          </p>
          <Link to="/concept-graph" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'12px 28px', borderRadius:10, background:'linear-gradient(135deg,#3b82f6,#6366f1)', color:'#fff', fontWeight:700, textDecoration:'none' }}>
            Upload Syllabus
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

      {/* ── Active Syllabus Indicator ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
        <p style={{ color:'#6b7280', fontSize:'0.88rem' }}>Keep learning and strengthening your concepts!</p>
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 14px', borderRadius:10, border:'1.5px solid #e2e8f0', background:'#fff', fontSize:'0.82rem', fontWeight:600, color:'#374151' }}>
          <span style={{ maxWidth:220, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{courseTitle}</span>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:16 }}>
        <StatCard label="Topics Practiced" value={`${answered}/${totalTopics}`}
          pct={totalTopics > 0 ? Math.round(answered/totalTopics*100) : 0}
          sub1={`${totalTopics > 0 ? Math.round(answered/totalTopics*100) : 0}% attempted`}
          sub2={answered === 0 ? 'Click any node to start a quiz!' : answered < totalTopics ? "Keep going! You're building a strong base." : 'All topics attempted!'} />
        <StatCard label="Questions Practiced" value={answeredQ}
          sub1={totalQ > 0 ? `${answeredQ} of ${totalQ} questions answered` : answeredQ > 0 ? `${answeredQ} questions answered` : 'No questions yet'}
          sub2={answeredQ > 0 ? 'Keep it up!' : 'Start practising!'} sub2Color="#22c55e" />
        <StatCard label="Accuracy"
          value={answered > 0 ? `${accuracy}%` : answeredQ > 0 ? 'Pending' : '—'}
          sub1={answered > 0 ? `${strong}/${answered} topics rated` : answeredQ > 0 ? 'Awaiting quiz evaluation' : 'No quizzes completed yet'}
          sub2={accuracy >= 70 ? 'Good performance!' : accuracy > 0 ? 'Needs improvement' : answeredQ > 0 ? 'Complete a quiz to see accuracy' : 'Take a quiz to begin!'}
          sub2Color={accuracy >= 70 ? '#22c55e' : accuracy > 0 ? '#f59e0b' : '#9ca3af'} />
        <StatCard label="Overall Mastery" value={`${mastery}%`} pct={mastery}
          sub1={`${strong}/${totalTopics} topics mastered`} />
      </div>

      {/* ── Bottom Row: Recent Activity full width ── */}
      <div className="t-card" style={{ padding:'18px' }}>
        <h3 style={{ fontSize:'0.88rem', fontWeight:700, color:'#0f172a', marginBottom:12 }}>Recent Activity</h3>
        {Object.entries(evalData).length === 0 ? (
          <p style={{ fontSize:'0.78rem', color:'#9ca3af', textAlign:'center', padding:'12px 0' }}>No activity yet. Click a mind map node to start!</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {Object.entries(evalData).slice(0,5).map(([name, ev]) => {
              const score = ev.score ?? ev.confidence ?? 0
              const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
              return (
                <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderRadius:8, background:'#f8fafc' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
                    <div>
                      <p style={{ fontSize:'0.75rem', fontWeight:600, color:'#0f172a' }}>{name}</p>
                      <p style={{ fontSize:'0.65rem', color:'#9ca3af' }}>{ev.rating ? ev.rating.charAt(0).toUpperCase() + ev.rating.slice(1) : 'Quiz'}</p>
                    </div>
                  </div>
                  <span style={{ fontSize:'0.78rem', fontWeight:800, color }}>{score}%</span>
                </div>
              )
            })}
          </div>
        )}
        <Link to="/practice" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginTop:10, fontSize:'0.75rem', color:'#6366f1', fontWeight:700, textDecoration:'none' }}>
          View All Activity
        </Link>
      </div>  {/* end Recent Activity */}


      {/* ── Concept Map Preview ── */}
      <div className="t-card" style={{ padding:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <h2 style={{ fontSize:'0.98rem', fontWeight:700, color:'#0f172a' }}>
            Your Concept Map <span style={{ color:'#9ca3af', fontWeight:400 }}>(Preview)</span>
          </h2>
          <Link to="/practice" style={{ fontSize:'0.78rem', color:'#6366f1', fontWeight:700, textDecoration:'none' }}>
            Open Full Mind Map
          </Link>
        </div>

        <div style={{ overflowX:'auto' }}>
          <div style={{ minWidth:500 }}>
            {/* Root */}
            <div style={{ display:'flex', justifyContent:'center' }}>
              <div style={{ padding:'10px 28px', borderRadius:12, background:'#ede9fe', border:'2px solid #c4b5fd', fontWeight:800, fontSize:'0.88rem', color:'#5b21b6' }}>
                {courseTitle}
              </div>
            </div>

            <div style={{ display:'flex', justifyContent:'center' }}>
              <div style={{ width:2, height:24, background:'#cbd5e1' }} />
            </div>
            <div style={{ height:1, background:'#cbd5e1', margin:`0 ${100/Math.max(topics.length,1)/2}%` }} />

            {/* Level 1 topics */}
            <div style={{ display:'flex', justifyContent:'center', gap:12, flexWrap:'nowrap' }}>
              {topics.slice(0,5).map(t => {
                const name   = getName(t)
                const r      = evalData[name]?.rating
                const bg     = r === 'strong' ? '#f0fdf4' : r === 'partial' || r === 'moderate' ? '#fffbeb' : r === 'weak' ? '#fff1f2' : '#f8fafc'
                const border = r === 'strong' ? '#86efac' : r === 'partial' || r === 'moderate' ? '#fcd34d' : r === 'weak' ? '#fca5a5' : '#e2e8f0'
                return (
                  <div key={name} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                    <div style={{ width:2, height:20, background:'#cbd5e1' }} />
                    <div style={{ padding:'8px 14px', borderRadius:10, background:bg, border:`1.5px solid ${border}`, fontSize:'0.78rem', fontWeight:600, color:'#374151', textAlign:'center', whiteSpace:'nowrap' }}>
                      {name}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div style={{ display:'flex', gap:20, justifyContent:'center', marginTop:16, flexWrap:'wrap' }}>
              {[['#22c55e','Strong'],['#f59e0b','Partial'],['#ef4444','Needs Work'],['#9ca3af','Not Practised']].map(([c,l]) => (
                <div key={l} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background:c }} />
                  <span style={{ fontSize:'0.72rem', color:'#6b7280' }}>{l}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tip of the Day ── */}
      <div style={{ padding:'14px 20px', borderRadius:12, background:'linear-gradient(135deg,#f0f4ff,#fdf4ff)', border:'1.5px solid #e0e7ff' }}>
        <p style={{ fontSize:'0.82rem', color:'#374151' }}>
          <strong style={{ color:'#6366f1' }}>Tip of the Day: </strong>{tip}
        </p>
      </div>
    </div>
  )
}
