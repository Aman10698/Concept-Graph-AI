import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './AppLayout.css'

const LogoSVG = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="4" fill="white" opacity="0.9" />
    <circle cx="5"  cy="7"  r="2.5" fill="white" opacity="0.7" />
    <circle cx="19" cy="7"  r="2.5" fill="white" opacity="0.7" />
    <circle cx="5"  cy="17" r="2.5" fill="white" opacity="0.7" />
    <circle cx="19" cy="17" r="2.5" fill="white" opacity="0.7" />
    <line x1="12" y1="12" x2="5"  y2="7"  stroke="white" strokeWidth="1.5" opacity="0.5" />
    <line x1="12" y1="12" x2="19" y2="7"  stroke="white" strokeWidth="1.5" opacity="0.5" />
    <line x1="12" y1="12" x2="5"  y2="17" stroke="white" strokeWidth="1.5" opacity="0.5" />
    <line x1="12" y1="12" x2="19" y2="17" stroke="white" strokeWidth="1.5" opacity="0.5" />
  </svg>
)

const navItems = [
  { path: '/dashboard', label: 'Dashboard', key: 'dashboard' },
  { path: '/concept-graph', label: 'Learn', key: 'mindmap' },
  { path: '/syllabuses', label: 'My Syllabuses', key: 'syllabuses' },
]

export default function AppLayout({ children }) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const initials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  const firstName = user?.displayName?.split(' ')[0] ?? 'there'

  // Only highlight the exact path match; for /concept-graph only highlight "Mind Map"
  const isNavActive = (item) => {
    if (item.key === 'dashboard')  return location.pathname === '/dashboard'
    if (item.key === 'mindmap')    return location.pathname === '/concept-graph'
    if (item.key === 'quizzes')    return location.pathname === '/practice'
    if (item.key === 'syllabuses') return location.pathname === '/syllabuses'
    if (item.key === 'upload')     return false
    if (item.key === 'deps')       return location.pathname === '/dependency-graph'
    return false
  }

  return (
    <div className="al-root">
      {/* ── Sidebar ── */}
      <aside className="al-sidebar">
        <Link to="/" className="al-sidebar-logo">
          <div className="al-sidebar-logo-icon">
            <LogoSVG />
          </div>
          <span className="al-sidebar-logo-text">ConceptGraphAI</span>
        </Link>

        <nav className="al-sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              className={`al-nav-item ${isNavActive(item) ? 'al-active' : ''}`}
            >
              <span className="al-nav-label">{item.label}</span>
            </Link>
          ))}

          <Link
            to="/profile"
            className={`al-nav-item ${location.pathname === '/profile' ? 'al-active' : ''}`}
          >
            <span className="al-nav-label">Profile</span>
          </Link>

          <Link
            to="/about"
            className={`al-nav-item ${location.pathname === '/about' ? 'al-active' : ''}`}
          >
            <span className="al-nav-label">About</span>
          </Link>
        </nav>

        {/* User footer */}
        <div className="al-sidebar-footer">
          <div className="al-user-row" onClick={() => setDropdownOpen((v) => !v)}>
            <div className="al-avatar">{initials}</div>
            <div className="al-user-info">
              <div className="al-user-name">{user?.displayName ?? 'User'}</div>
              <div className="al-user-email">{user?.email ?? ''}</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>

            {dropdownOpen && (
              <div className="al-user-dropdown" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { logout(); navigate('/login'); }}>
                    Sign out
                  </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <main className="al-main">
        {/* Top header */}
        <header className="al-header">
          <div className="al-header-title">
            Welcome back, <span>{firstName}</span>
          </div>
          <div className="al-header-right">

            <button className="al-hamburger" aria-label="Menu">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="3" y1="6"  x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>
        </header>

        {/* Page content */}
        <div className="al-content">
          {children}
        </div>
      </main>
    </div>
  )
}
