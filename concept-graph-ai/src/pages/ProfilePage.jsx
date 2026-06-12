import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { 
  User, BookOpen, Target, Award, HelpCircle, 
  LogOut, Info, Settings, Mail, Fingerprint, Database 
} from 'lucide-react'

export default function ProfilePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()


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



  return (
    <div style={{ maxWidth: 780, margin: '0 auto', paddingBottom: 60 }}>
      <style>{`
        .profile-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .stat-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          transition: all 0.25s;
        }
        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.06);
          border-color: #cbd5e1;
        }
        .action-btn {
          transition: all 0.2s;
        }
        .action-btn:hover {
          transform: translateY(-2px);
          filter: brightness(0.95);
        }
      `}</style>

      {/* ── Page title ── */}
      <div style={{ marginBottom: 36, display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ background: '#e0e7ff', padding: 10, borderRadius: 12, color: '#6366f1' }}>
          <User size={24} strokeWidth={2.5} />
        </div>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', margin: 0 }}>
            Profile Details
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.95rem', margin: '2px 0 0' }}>Your account overview and learning progress</p>
        </div>
      </div>

      {/* ── Profile card ── */}
      <div className="profile-card" style={{ padding: '32px', marginBottom: 28, display: 'flex', gap: 28, alignItems: 'center', flexWrap: 'wrap', background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)' }}>
        {/* Avatar */}
        <div style={{
          width: 88, height: 88, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', fontWeight: 800, color: '#fff',
          boxShadow: '0 8px 24px rgba(99,102,241,0.3)',
          border: '4px solid #fff'
        }}>
          {initials}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>
            {user?.displayName || 'Student User'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Mail size={14} /> {user?.email}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span style={{
              padding: '4px 12px', borderRadius: 999,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
              fontSize: '0.78rem', fontWeight: 700, color: '#6366f1',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
              <Award size={12} strokeWidth={3} /> Active Learner
            </span>
            <span style={{
              padding: '4px 12px', borderRadius: 999,
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
              fontSize: '0.78rem', fontWeight: 700, color: '#10b981',
              display: 'flex', alignItems: 'center', gap: 4
            }}>
              <Target size={12} strokeWidth={3} /> Member since {joinDate}
            </span>
          </div>
        </div>
      </div>



      {/* ── Account details ── */}
      <div className="profile-card" style={{ padding: '28px 32px', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Settings size={20} color="#475569" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em', margin: 0 }}>
            Account Configuration
          </h3>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[
            { label: 'Email address', icon: <Mail size={16}/>, value: user?.email, badge: 'Firebase Auth' },
            { label: 'Display name',  icon: <User size={16}/>, value: user?.displayName || '—' },
            { label: 'User ID',       icon: <Fingerprint size={16}/>, value: user?.uid, mono: true },
            { label: 'Data storage',  icon: <Database size={16}/>, value: 'MongoDB (local)', badge: 'Connected', badgeColor: '#10b981', badgeBg: '#dcfce7' },
          ].map((row, i, arr) => (
            <div key={row.label} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '16px 0',
              borderBottom: i < arr.length - 1 ? '1px solid #f1f5f9' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ color: '#94a3b8' }}>{row.icon}</div>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{row.label}</p>
                  <p style={{ fontSize: row.mono ? '0.75rem' : '0.85rem', color: '#64748b', fontFamily: row.mono ? 'monospace' : 'inherit', margin: 0 }}>{row.value}</p>
                </div>
              </div>
              {row.badge && (
                <span style={{
                  padding: '4px 12px', borderRadius: 999,
                  background: row.badgeBg || '#f1f5f9',
                  border: `1px solid ${row.badgeColor || '#94a3b8'}40`,
                  fontSize: '0.75rem', fontWeight: 700,
                  color: row.badgeColor || '#64748b',
                }}>{row.badge}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Actions ── */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <button
          onClick={() => navigate('/syllabuses')}
          className="action-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: '0.9rem',
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: '#fff', border: 'none',
            cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
          }}
        >
          <BookOpen size={18} /> View Syllabuses
        </button>
        <button
          onClick={() => navigate('/about')}
          className="action-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: '0.9rem',
            background: '#f8fafc', color: '#334155', border: '1.5px solid #e2e8f0', cursor: 'pointer',
          }}
        >
          <Info size={18} /> About Project
        </button>
        <button
          onClick={handleLogout}
          className="action-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto',
            padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: '0.9rem',
            background: '#fff', color: '#ef4444', border: '1.5px solid #fecaca', cursor: 'pointer',
          }}
        >
          <LogOut size={18} /> Sign Out
        </button>
      </div>
    </div>
  )
}
