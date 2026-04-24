import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({ syllabuses: 0, topics: 0, mastered: 0, questions: 0 })

  /* ── derive stats from localStorage ── */
  useEffect(() => {
    try {
      const topics    = JSON.parse(localStorage.getItem('learningTopicsData')    || '{}')
      const evalData  = JSON.parse(localStorage.getItem('learningEvaluationData') || '{}')
      const questions = JSON.parse(localStorage.getItem('learningQuestionsData')  || '{}')

      const topicList = topics?.topics ?? []
      const mastered  = topicList.filter(t => {
        const name = typeof t === 'string' ? t : t.name
        return evalData[name]?.rating === 'strong'
      }).length

      setStats({
        syllabuses: parseInt(localStorage.getItem('totalSessionCount') || '1', 10),
        topics:     topicList.length,
        mastered,
        questions:  questions?.questions?.length ?? 0,
      })
    } catch (_) {}
  }, [])

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  const joinDate = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Unknown'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const statCards = [
    { label: 'Syllabuses Uploaded', value: stats.syllabuses, color: '#6366f1', icon: '📚' },
    { label: 'Topics Extracted',    value: stats.topics,     color: '#3b82f6', icon: '🗂' },
    { label: 'Topics Mastered',     value: stats.mastered,   color: '#22c55e', icon: '✅' },
    { label: 'Questions Generated', value: stats.questions,  color: '#f59e0b', icon: '❓' },
  ]

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>

      {/* ── Page title ── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 4 }}>
          Profile
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Your account details and learning summary</p>
      </div>

      {/* ── Profile card ── */}
      <div className="t-card" style={{ padding: '28px 28px', marginBottom: 24, display: 'flex', gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Avatar */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.8rem', fontWeight: 800, color: '#fff',
          boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
        }}>
          {initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            {user?.displayName || 'Student'}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.88rem', marginBottom: 6 }}>{user?.email}</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 999,
              background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
              fontSize: '0.75rem', fontWeight: 600, color: '#6366f1',
            }}>Active Learner</span>
            <span style={{
              padding: '3px 10px', borderRadius: 999,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              fontSize: '0.75rem', fontWeight: 600, color: '#16a34a',
            }}>Member since {joinDate}</span>
          </div>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 14, marginBottom: 24 }}>
        {statCards.map(s => (
          <div key={s.label} className="t-card" style={{
            padding: '18px 16px', borderLeft: `4px solid ${s.color}`, background: `${s.color}07`,
          }}>
            <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: s.color, lineHeight: 1, marginBottom: 3 }}>{s.value}</div>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Account details ── */}
      <div className="t-card" style={{ padding: '22px 24px', marginBottom: 20 }}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 18 }}>
          Account
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { label: 'Email address', value: user?.email, badge: 'Firebase Auth' },
            { label: 'Display name',  value: user?.displayName || '—', badge: null },
            { label: 'User ID',       value: user?.uid, mono: true, badge: null },
            { label: 'Data storage',  value: 'MongoDB (local) + Firebase Auth', badge: 'Connected', badgeColor: '#16a34a', badgeBg: 'rgba(34,197,94,0.1)' },
          ].map((row, i, arr) => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '13px 0',
              borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div>
                <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a', marginBottom: 2 }}>{row.label}</p>
                <p style={{ fontSize: row.mono ? '0.72rem' : '0.8rem', color: '#6b7280', fontFamily: row.mono ? 'monospace' : 'inherit' }}>{row.value}</p>
              </div>
              {row.badge && (
                <span style={{
                  padding: '3px 10px', borderRadius: 999,
                  background: row.badgeBg || 'rgba(148,163,184,0.12)',
                  border: `1px solid ${row.badgeColor || '#9ca3af'}33`,
                  fontSize: '0.73rem', fontWeight: 600,
                  color: row.badgeColor || '#6b7280',
                }}>{row.badge}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/syllabuses')}
          style={{
            padding: '10px 22px', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem',
            background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: '#fff', border: 'none',
            cursor: 'pointer', boxShadow: '0 2px 10px rgba(99,102,241,0.3)',
          }}
        >
          View My Syllabuses
        </button>
        <button
          onClick={() => navigate('/about')}
          style={{
            padding: '10px 22px', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem',
            background: '#f8fafc', color: '#374151', border: '1.5px solid #e2e8f0', cursor: 'pointer',
          }}
        >
          About ConceptGraphAI
        </button>
        <button
          onClick={handleLogout}
          style={{
            padding: '10px 22px', borderRadius: 10, fontWeight: 700, fontSize: '0.88rem',
            background: '#fff', color: '#ef4444', border: '1.5px solid #fca5a5', cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
