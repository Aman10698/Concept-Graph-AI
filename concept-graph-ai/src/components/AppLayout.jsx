import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AppLayout.css'

/* ── SVG Icons ─────────────────────────────────────────── */
const Icon = {
  dashboard: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  practice: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5,3 19,12 5,21"/>
    </svg>
  ),
  syllabuses: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  depgraph: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="3" r="2"/><circle cx="4" cy="19" r="2"/>
      <circle cx="20" cy="19" r="2"/><circle cx="12" cy="19" r="2"/>
      <line x1="12" y1="5" x2="4" y2="17"/><line x1="12" y1="5" x2="20" y2="17"/>
      <line x1="12" y1="5" x2="12" y2="17"/>
    </svg>
  ),
  rag: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.66z"/>
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.66z"/>
    </svg>
  ),
  chat: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  Bell: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  learn: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/>
      <line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  ),
}

/* ── Nav Items ──────────────────────────────────────────────── */
const NAV_ITEMS = [
  { path: '/dashboard',    label: 'Dashboard',        icon: 'dashboard',  key: 'dashboard'  },
  { path: '/syllabuses',   label: 'Upload Syllabus',  icon: 'syllabuses', key: 'syllabuses' },
  { path: '/my-syllabuses',label: 'My Syllabuses',    icon: 'learn',      key: 'mysyllabuses'},
  { path: '/practice',     label: 'Practice',         icon: 'practice',   key: 'practice'   },
  { path: '/dep-graph',    label: 'Dep. Graph',       icon: 'depgraph',   key: 'depgraph'   },
  { path: '/rag-study',    label: 'Upload Notes',     icon: 'rag',        key: 'rag'        },
  { path: '/chats',        label: 'Chats',            icon: 'chat',       key: 'chats'      },
]

const NAV_BOTTOM = [
  { path: '/profile', label: 'Settings', icon: 'settings', key: 'settings' },
]

export default function AppLayout({ children }) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)


  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  // eslint-disable-next-line no-unused-vars
  const _firstName = user?.displayName?.split(' ')[0] ?? 'there'

  const isNavActive = (item) => {
    if (item.key === 'dashboard')  return location.pathname === '/dashboard'
    if (item.key === 'practice')   return location.pathname === '/practice'
    if (item.key === 'syllabuses')   return location.pathname === '/syllabuses'
    if (item.key === 'mysyllabuses') return location.pathname === '/my-syllabuses'
    if (item.key === 'depgraph')   return location.pathname === '/dep-graph'
    if (item.key === 'settings')   return location.pathname === '/profile'
    if (item.key === 'rag')        return location.pathname === '/rag-study'
    if (item.key === 'chats')      return location.pathname === '/chats'
    return false
  }

  /* header title per route */
  const headerInfo = (() => {
    const p = location.pathname
    if (p === '/dashboard')  return { title: 'Dashboard',         sub: 'Track your learning progress' }
    if (p === '/practice')   return { title: 'Practice',           sub: 'Quiz yourself on any topic' }
    if (p === '/syllabuses')    return { title: 'Upload Syllabus',  sub: 'Upload a PDF or image to generate your concept graph' }
    if (p === '/my-syllabuses') return { title: 'My Syllabuses',    sub: 'All your uploaded syllabuses and their progress' }
    if (p === '/dep-graph')  return { title: 'Prerequisite Graph', sub: 'AI-generated dependency analysis from your quiz answers' }
    if (p === '/profile')    return { title: 'Settings',           sub: 'Manage your account' }
    if (p === '/rag-study')  return { title: 'Upload Notes',       sub: 'Upload your notes or textbooks to power the Chats assistant' }
    if (p === '/chats')      return { title: 'Chats',              sub: 'Ask Ollama questions about your uploaded documents' }
    return { title: 'ConceptGraph', sub: 'Learn. Connect. Master.' }
  })()


  return (
    <div className="al-root">
      {/* ── Sidebar ── */}
      <aside className="al-sidebar">
        <Link to="/" className="al-sidebar-logo">
          <div className="al-sidebar-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3.5" fill="white" opacity="0.95" />
              <circle cx="5" cy="7" r="2" fill="white" opacity="0.7" />
              <circle cx="19" cy="7" r="2" fill="white" opacity="0.7" />
              <circle cx="5" cy="17" r="2" fill="white" opacity="0.7" />
              <circle cx="19" cy="17" r="2" fill="white" opacity="0.7" />
              <line x1="12" y1="12" x2="5" y2="7" stroke="white" strokeWidth="1.5" opacity="0.6" />
              <line x1="12" y1="12" x2="19" y2="7" stroke="white" strokeWidth="1.5" opacity="0.6" />
              <line x1="12" y1="12" x2="5" y2="17" stroke="white" strokeWidth="1.5" opacity="0.6" />
              <line x1="12" y1="12" x2="19" y2="17" stroke="white" strokeWidth="1.5" opacity="0.6" />
            </svg>
          </div>
          <div>
            <span className="al-sidebar-logo-text">ConceptGraph</span>
            <span className="al-sidebar-logo-sub">Learn. Connect. Master.</span>
          </div>
        </Link>

        <nav className="al-sidebar-nav">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.key}
              to={item.path}
              className={`al-nav-item ${isNavActive(item) ? 'al-active' : ''}`}
            >
              <span className="al-nav-icon">{Icon[item.icon]?.()}</span>
              <span className="al-nav-label">{item.label}</span>
            </Link>
          ))}

          <div style={{ flex: 1 }} />

          {NAV_BOTTOM.map(item => (
            <Link
              key={item.key}
              to={item.path}
              className={`al-nav-item ${isNavActive(item) ? 'al-active' : ''}`}
            >
              <span className="al-nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>




      </aside>

      {/* ── Main area ── */}
      <main className="al-main">
        {/* Top header */}
        <header className="al-header">
          <div className="al-header-left">
            <div className="al-header-title">{headerInfo.title}</div>
            <div className="al-header-subtitle">{headerInfo.sub}</div>
          </div>
          <div className="al-header-right">

            {/* Bell */}
            <button className="al-bell" aria-label="Notifications">
              <Icon.Bell />
              <span className="al-bell-dot" />
            </button>

            {/* User avatar + dropdown — replaces old sidebar footer */}
            <div
              className="al-header-user"
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => setDropdownOpen(v => !v)}
            >
              <div className="al-header-avatar">{initials}</div>
              <div className="al-header-user-info">
                <div className="al-header-user-name">{user?.displayName ?? 'User'}</div>
                <div className="al-header-user-role">
                  {user?.email ?? ''}
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>

              {dropdownOpen && (
                <div
                  className="al-user-dropdown"
                  style={{ top: '110%', right: 0, left: 'auto', position: 'absolute', minWidth: 180, background: '#fff', borderRadius: 12, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', border: '1px solid #eef0f6', zIndex: 9999, padding: '6px' }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => { setDropdownOpen(false); navigate('/profile'); }}
                    style={{ width: '100%', textAlign: 'left', padding: '9px 14px', borderRadius: 8, border: 'none', background: 'none', fontSize: '0.83rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => { setDropdownOpen(false); logout(); navigate('/login'); }}
                    style={{ width: '100%', textAlign: 'left', padding: '9px 14px', borderRadius: 8, border: 'none', background: 'none', fontSize: '0.83rem', fontWeight: 600, color: '#ef4444', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'}
                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>

            <button className="al-hamburger" aria-label="Menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className={`al-content${(location.pathname === '/chats' || location.pathname === '/rag-study') ? '' : ' al-content-padded'}`}>
          {children}
        </div>
      </main>
    </div>
  )
}
