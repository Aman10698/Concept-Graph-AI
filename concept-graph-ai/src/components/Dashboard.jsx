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
      const activeSessionId = localStorage.getItem('activeSessionId')
      if (!activeSessionId) {
        setTopicsData(null); setEvalData({}); setQuestionsData(null); return
      }
      try {
        const t = localStorage.getItem('learningTopicsData')
        const e = localStorage.getItem('learningEvaluationData')
        const q = localStorage.getItem('learningQuestionsData')
        setTopicsData(t ? JSON.parse(t) : null)
        setEvalData(e ? JSON.parse(e) : {})
        setQuestionsData(q ? JSON.parse(q) : null)
      } catch { /* ignore */ }
    }
    load()
    // Re-load when storage changes (e.g. after a quiz in another tab or component)
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
      <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
        <StatCard label="Topics Covered" value={`${answered}/${totalTopics}`}
          pct={totalTopics > 0 ? Math.round(answered/totalTopics*100) : 0}
          sub1={`${totalTopics > 0 ? Math.round(answered/totalTopics*100) : 0}% complete`}
          sub2={answered < totalTopics ? "Keep going! You're building a strong base." : "All topics covered!"} />
        <StatCard label="Questions Practiced" value={answeredQ}
          sub1={totalQ > 0 ? `${answeredQ} of ${totalQ} questions answered` : 'No questions yet'}
          sub2={answeredQ > 0 ? 'Keep it up!' : 'Start practising!'} sub2Color="#22c55e" />
        <StatCard label="Accuracy" value={answered > 0 ? `${accuracy}%` : '—'}
          sub1={`${strong}/${answered} correct answers`}
          sub2={accuracy >= 70 ? 'Good performance!' : accuracy > 0 ? 'Needs improvement' : 'No quizzes yet'}
          sub2Color={accuracy >= 70 ? '#22c55e' : '#ef4444'} />
        <StatCard label="Overall Mastery" value={`${mastery}%`} pct={mastery}
          sub1={`${strong}/${totalTopics} topics mastered`} />
      </div>

      {/* ── Middle Row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 280px', gap:16, alignItems:'start' }}>

        {/* Concept Mastery Overview */}
        <div className="t-card" style={{ padding:'20px' }}>
          <h2 style={{ fontSize:'0.98rem', fontWeight:700, color:'#0f172a', marginBottom:16 }}>Concept Mastery Overview</h2>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <DonutChart strong={strong} partial={partial} weak={weak} notPractised={Math.max(notPractised,0)} total={totalTopics || 4} />
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                <span style={{ fontSize:'1.5rem', fontWeight:800, color:'#0f172a' }}>{totalTopics}</span>
                <span style={{ fontSize:'0.65rem', color:'#9ca3af', fontWeight:600 }}>Total Topics</span>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1 }}>
              {[
                { label:'Strong',        count:strong,                  color:'#22c55e' },
                { label:'Partial',       count:partial,                 color:'#f59e0b' },
                { label:'Needs Work',    count:weak,                    color:'#ef4444' },
                { label:'Not Practised', count:Math.max(notPractised,0),color:'#9ca3af' },
              ].map(s => (
                <div key={s.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', background:s.color }} />
                    <span style={{ fontSize:'0.8rem', color:'#374151' }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize:'0.8rem', fontWeight:700, color:'#6b7280' }}>
                    {s.count} ({totalTopics > 0 ? Math.round(s.count/totalTopics*100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
          <Link to="/practice" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:16, padding:'9px', borderRadius:10, border:'1.5px solid #e2e8f0', color:'#6366f1', fontWeight:700, fontSize:'0.82rem', textDecoration:'none', background:'#fafbff' }}>
            View All Topics
          </Link>
        </div>

        {/* Weak Areas */}
        <div className="t-card" style={{ padding:'20px' }}>
          <h2 style={{ fontSize:'0.98rem', fontWeight:700, color:'#0f172a', marginBottom:4 }}>
            Weak Areas <span style={{ color:'#ef4444', fontWeight:600, fontSize:'0.85rem' }}>(Needs Your Focus)</span>
          </h2>
          {weakAreas.length === 0 ? (
            <div style={{ padding:'24px 0', textAlign:'center' }}>
              <p style={{ fontWeight:700, color:'#15803d', fontSize:'0.88rem' }}>All topics strong!</p>
              <p style={{ fontSize:'0.78rem', color:'#6b7280' }}>Keep practising to maintain mastery.</p>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:12 }}>
              {weakAreas.slice(0,3).map(name => {
                const r = evalData[name]?.rating
                const conf = evalData[name]?.confidence ?? 0
                const correct = Math.round(conf / 100 * (evalData[name]?.totalQuestions || 3))
                const total3  = evalData[name]?.totalQuestions || 3
                const isWeak  = r === 'weak'
                return (
                  <div key={name} style={{ padding:'12px 14px', borderRadius:10, border:`1.5px solid ${isWeak ? '#fca5a5' : '#fcd34d'}`, background:isWeak ? '#fff1f2' : '#fffbeb' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                      <div>
                        <span style={{ fontWeight:700, fontSize:'0.88rem', color:'#0f172a' }}>{name} </span>
                        <span style={{ fontSize:'0.72rem', fontWeight:700, color: isWeak ? '#ef4444' : '#f59e0b', padding:'1px 6px', borderRadius:999, background: isWeak ? '#fee2e2' : '#fef9c3' }}>
                          {isWeak ? 'Weak' : 'Partial'}
                        </span>
                      </div>
                      <button onClick={() => navigate('/practice')} style={{ padding:'4px 12px', borderRadius:8, border:'1.5px solid #6366f1', background:'#fff', color:'#6366f1', fontSize:'0.75rem', fontWeight:700, cursor:'pointer' }}>
                        Review Now
                      </button>
                    </div>
                    <p style={{ fontSize:'0.72rem', color:'#6b7280' }}>
                      Impact: {isWeak ? 'High' : 'Medium'} • {correct}/{total3} correct
                    </p>
                  </div>
                )
              })}
            </div>
          )}
          <button onClick={() => navigate('/practice')} style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:14, padding:'9px', borderRadius:10, border:'1.5px solid #e2e8f0', color:'#6366f1', fontWeight:700, fontSize:'0.82rem', width:'100%', background:'#fafbff', cursor:'pointer' }}>
            View All Weak Areas
          </button>
        </div>

        {/* Right Column */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Recommended Next Step */}
          <div className="t-card" style={{ padding:'18px' }}>
            <p style={{ fontWeight:700, fontSize:'0.9rem', color:'#0f172a', marginBottom:12 }}>Recommended Next Step</p>
            {focusTopic ? (
              <>
                <div style={{ padding:'10px 12px', borderRadius:10, background:'#fffbeb', border:'1.5px solid #fcd34d', marginBottom:12 }}>
                  <p style={{ fontSize:'0.78rem', color:'#92400e', marginBottom:4 }}>
                    Focus on: <strong style={{ color:'#b45309' }}>{focusTopic}</strong>
                  </p>
                  <p style={{ fontSize:'0.72rem', color:'#92400e' }}>
                    You missed key ideas in {focusTopic.toLowerCase()} and its concepts.
                  </p>
                </div>
                <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#6b7280', marginBottom:6 }}>Why this first?</p>
                <p style={{ fontSize:'0.72rem', color:'#6b7280', marginBottom:12, lineHeight:1.5 }}>
                  {focusTopic} is a prerequisite for understanding related advanced topics.
                </p>
                <p style={{ fontSize:'0.72rem', fontWeight:700, color:'#6b7280', marginBottom:8 }}>Action Plan</p>
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
                  {['Review topic concepts','Practice 3 Questions','Take a Quick Quiz'].map((a,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:6, height:6, borderRadius:'50%', background:'#6366f1', flexShrink:0 }} />
                      <span style={{ fontSize:'0.75rem', color:'#374151' }}>{a}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/practice')} style={{ width:'100%', padding:'10px', borderRadius:10, background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff', fontWeight:700, fontSize:'0.82rem', border:'none', cursor:'pointer', boxShadow:'0 2px 8px rgba(99,102,241,0.3)' }}>
                  Start Learning Path
                </button>
              </>
            ) : (
              <div style={{ textAlign:'center', padding:'12px 0' }}>
                <p style={{ fontSize:'0.82rem', fontWeight:700, color:'#15803d' }}>All strong!</p>
                <p style={{ fontSize:'0.75rem', color:'#6b7280', marginTop:4 }}>Try harder questions to challenge yourself.</p>
                <button onClick={() => navigate('/practice')} style={{ marginTop:12, padding:'8px 16px', borderRadius:8, background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'#fff', fontWeight:700, fontSize:'0.8rem', border:'none', cursor:'pointer' }}>
                  Practice Now
                </button>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          <div className="t-card" style={{ padding:'18px' }}>
            <h3 style={{ fontSize:'0.88rem', fontWeight:700, color:'#0f172a', marginBottom:12 }}>Recent Activity</h3>
            {Object.entries(evalData).length === 0 ? (
              <p style={{ fontSize:'0.78rem', color:'#9ca3af', textAlign:'center', padding:'12px 0' }}>No activity yet. Start a quiz!</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {Object.entries(evalData).slice(0,3).map(([name, ev]) => {
                  const conf = ev.confidence ?? 0
                  const color = conf >= 70 ? '#22c55e' : conf >= 40 ? '#f59e0b' : '#ef4444'
                  return (
                    <div key={name} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', borderRadius:8, background:'#f8fafc' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:color, flexShrink:0 }} />
                        <div>
                          <p style={{ fontSize:'0.75rem', fontWeight:600, color:'#0f172a' }}>{name}</p>
                          <p style={{ fontSize:'0.65rem', color:'#9ca3af' }}>Quiz</p>
                        </div>
                      </div>
                      <span style={{ fontSize:'0.78rem', fontWeight:800, color }}>{conf}%</span>
                    </div>
                  )
                })}
              </div>
            )}
            <Link to="/practice" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:4, marginTop:10, fontSize:'0.75rem', color:'#6366f1', fontWeight:700, textDecoration:'none' }}>
              View All Activity
            </Link>
          </div>
        </div>
      </div>

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
