import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  LayoutGrid, BookOpen, Folder, PlayCircle,
  Network, FileText, MessageSquare, Settings, Bell, ChevronDown
} from 'lucide-react'
import './AppLayout.css'

/* ── Nav Sections ──────────────────────────────────────────────── */
const NAV_SECTIONS = [
  {
    title: 'LEARNING',
    items: [
      { path: '/dashboard', label: 'Dashboard', icon: <LayoutGrid size={20} strokeWidth={2} />, key: 'dashboard' },
      { path: '/syllabuses', label: 'Upload Syllabus', icon: <BookOpen size={20} strokeWidth={2} />, key: 'syllabuses' },
      { path: '/my-syllabuses', label: 'My Syllabuses', icon: <Folder size={20} strokeWidth={2} />, key: 'mysyllabuses' },
      { path: '/practice', label: 'Practice', icon: <PlayCircle size={20} strokeWidth={2} />, key: 'practice' },
    ]
  },
  {
    title: 'ANALYTICS',
    items: [
      { path: '/dep-graph', label: 'Dep. Graph', icon: <Network size={20} strokeWidth={2} />, key: 'depgraph' },
    ]
  },
  {
    title: 'CONTENT',
    items: [
      { path: '/rag-study', label: 'Upload Notes', icon: <FileText size={20} strokeWidth={2} />, key: 'rag' },
    ]
  },
  {
    title: 'COMMUNITY',
    items: [
      { path: '/chats', label: 'Chats', icon: <MessageSquare size={20} strokeWidth={2} />, key: 'chats' },
    ]
  }
]

const NAV_BOTTOM = [
  { path: '/profile', label: 'Settings', icon: <Settings size={20} strokeWidth={2} />, key: 'settings' },
]

export default function AppLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  const isNavActive = (item) => {
    if (item.key === 'dashboard') return location.pathname === '/dashboard'
    if (item.key === 'practice') return location.pathname === '/practice'
    if (item.key === 'syllabuses') return location.pathname === '/syllabuses'
    if (item.key === 'mysyllabuses') return location.pathname === '/my-syllabuses'
    if (item.key === 'depgraph') return location.pathname === '/dep-graph'
    if (item.key === 'learn') return location.pathname === '/learn'
    if (item.key === 'settings') return location.pathname === '/profile'
    if (item.key === 'rag') return location.pathname === '/rag-study'
    if (item.key === 'chats') return location.pathname === '/chats'
    return false
  }

  /* header title per route */
  const headerInfo = (() => {
    const p = location.pathname
    if (p === '/dashboard') return { title: 'Dashboard', sub: 'Track your learning progress' }
    if (p === '/practice') return { title: 'Practice', sub: 'Quiz yourself on any topic' }
    if (p === '/syllabuses') return { title: 'Upload Syllabus', sub: 'Upload a PDF or image to generate your concept graph' }
    if (p === '/my-syllabuses') return { title: 'My Syllabuses', sub: 'All your uploaded syllabuses and their progress' }
    if (p === '/dep-graph') return { title: 'Prerequisite Graph', sub: 'AI-generated dependency analysis from your quiz answers' }
    if (p === '/profile') return { title: 'Settings', sub: 'Manage your account' }
    if (p === '/rag-study') return { title: 'Upload Notes', sub: 'Upload your notes or textbooks to power the Chats assistant' }
    if (p === '/chats') return { title: 'Chats', sub: 'Ask Ollama questions about your uploaded documents' }
    return { title: 'ConceptGraph', sub: 'Learn. Connect. Master.' }
  })()

  return (
    <div className="al-root">
      {/* ── Sidebar ── */}
      <aside className="al-sidebar">

        {/* Logo Section */}
        <div className="al-sidebar-logo-section">
          <div className="al-sidebar-logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1" />
              <path d="M12 12h11" />
              <path d="m19 16 4-4-4-4" />
            </svg>
            <Network size={22} color="white" strokeWidth={2.5} />
          </div>
          <div className="al-sidebar-logo-text-wrapper">
            <h1 className="al-sidebar-logo-title">ConceptGraph</h1>
            <p className="al-sidebar-logo-subtitle">AI-Powered Learning Platform</p>
          </div>
        </div>

        {/* Navigation Sections */}
        <nav className="al-sidebar-nav">
          {NAV_SECTIONS.map((section, idx) => (
            <div key={idx} className="al-nav-section">
              <h3 className="al-nav-section-title">{section.title}</h3>
              <div className="al-nav-items">
                {section.items.map(item => {
                  const active = isNavActive(item);
                  return (
                    <Link
                      key={item.key}
                      to={item.path}
                      className={`al-nav-item ${active ? 'al-active' : ''}`}
                    >
                      <span className="al-nav-icon">{item.icon}</span>
                      <span className="al-nav-label">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          <div style={{ flex: 1 }} />

          {/* Bottom Section (Settings) */}
          <div className="al-sidebar-bottom">
            {NAV_BOTTOM.map(item => {
              const active = isNavActive(item);
              return (
                <Link
                  key={item.key}
                  to={item.path}
                  className={`al-nav-item al-nav-item-bottom ${active ? 'al-active' : ''}`}
                >
                  <span className="al-nav-icon">{item.icon}</span>
                  <span className="al-nav-label">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </aside>

      {/* ── Main area ── */}
      <main className="al-main">
        {/* Top header */}
        <header className="al-header">

          <div className="al-header-right">


            {/* User avatar + dropdown */}
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
              <ChevronDown size={14} color="#9ca3af" />

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
