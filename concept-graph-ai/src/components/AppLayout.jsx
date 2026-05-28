import { useState, useMemo } from 'react'
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
  graph: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
      <line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/>
      <line x1="7" y1="19" x2="17" y2="19"/>
    </svg>
  ),
  practice: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5,3 19,12 5,21"/>
    </svg>
  ),
  progress: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
    </svg>
  ),
  analytics: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  notes: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
    </svg>
  ),
  bookmarks: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  settings: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9,18 15,12 9,6"/>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  Bell: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  ),
  syllabuses: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
}

/* ── Donut Chart ──────────────────────────────────────────── */
function SidebarDonut({ strong, partial, weak, notPractised, total, pct }) {
  const size = 72, sw = 14, r = (size - sw) / 2, circ = 2 * Math.PI * r
  const segs = [
    { v: strong,       color: '#22c55e' },
    { v: partial,      color: '#f59e0b' },
    { v: weak,         color: '#ef4444' },
    { v: notPractised, color: '#e9eaf0' },
  ]
  const tot = total || 1
  let cum = 0
  return (
    <svg width={size} height={size} style={{ display:'block', flexShrink: 0 }}>
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

/* ── Nav Items ──────────────────────────────────────────────── */
const NAV_ITEMS = [
  { path: '/dashboard',     label: 'Dashboard',      icon: 'dashboard',  key: 'dashboard'  },
  { path: '/concept-graph', label: 'Knowledge Graph', icon: 'graph',     key: 'mindmap'    },
  { path: '/practice',      label: 'Practice',        icon: 'practice',   key: 'practice'   },
  { path: '/syllabuses',    label: 'My Syllabuses',   icon: 'syllabuses', key: 'syllabuses' },
]

const NAV_BOTTOM = [
  { path: '/profile',  label: 'Settings', icon: 'settings', key: 'settings' },
]

export default function AppLayout({ children }) {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { user, logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [searchVal, setSearchVal] = useState('')

  /* ── read evaluation data for sidebar progress ─── */
  const { topicsData, evalData } = useMemo(() => {
    try {
      const t = localStorage.getItem('learningTopicsData')
      const e = localStorage.getItem('learningEvaluationData')
      return {
        topicsData: t ? JSON.parse(t) : null,
        evalData:   e ? JSON.parse(e) : {},
      }
    } catch { return { topicsData: null, evalData: {} } }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])  // re-read localStorage on every route change so sidebar progress stays fresh

  const topics      = topicsData?.topics ?? []
  const getName     = t => typeof t === 'string' ? t : t.name

  // Full node set = modules + all subtopics (mirrors Dashboard logic)
  const allSidebarNodes = [
    ...topics.map(getName),
    ...topics.flatMap(t =>
      Array.isArray(t.subtopics)
        ? t.subtopics.map(s => (typeof s === 'string' ? s : s.name)).filter(Boolean)
        : []
    ),
  ]
  const totalTopics  = allSidebarNodes.length
  const answeredNodes = allSidebarNodes.filter(n => evalData[n])
  const nodeRatings  = answeredNodes.map(n => evalData[n])
  const strong       = nodeRatings.filter(r => r.rating === 'strong').length
  const partial      = nodeRatings.filter(r => r.rating === 'partial' || r.rating === 'moderate').length
  const weak         = nodeRatings.filter(r => r.rating === 'weak').length
  const answered     = answeredNodes.length
  const notPractised = Math.max(totalTopics - answered, 0)
  const mastery      = totalTopics > 0 ? Math.round((strong / totalTopics) * 100) : 0

  /* weakest topics by confidence */
  const weakTopics = topics
    .map(t => ({ name: getName(t), ...evalData[getName(t)] }))
    .filter(t => t.rating === 'weak' || t.rating === 'partial')
    .sort((a,b) => (a.confidence||0) - (b.confidence||0))
    .slice(0, 3)

  const initials = user?.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  // eslint-disable-next-line no-unused-vars
  const _firstName = user?.displayName?.split(' ')[0] ?? 'there'

  const isNavActive = (item) => {
    if (item.key === 'dashboard')  return location.pathname === '/dashboard'
    if (item.key === 'mindmap')    return location.pathname === '/concept-graph'
    if (item.key === 'practice')   return location.pathname === '/practice'
    if (item.key === 'syllabuses') return location.pathname === '/syllabuses'
    if (item.key === 'settings')   return location.pathname === '/profile'
    return false
  }

  /* header title per route */
  const headerInfo = (() => {
    const p = location.pathname
    if (p === '/dashboard')     return { title: 'Dashboard', sub: 'Track your learning progress' }
    if (p === '/concept-graph') return { title: 'Knowledge Graph', sub: 'Visualize concepts, dependencies and your mastery' }
    if (p === '/practice')      return { title: 'Practice', sub: 'Quiz yourself on any topic' }
    if (p === '/syllabuses')    return { title: 'My Syllabuses', sub: 'Manage your uploaded syllabuses' }
    if (p === '/profile')       return { title: 'Settings', sub: 'Manage your account' }
    return { title: 'ConceptGraph', sub: 'Learn. Connect. Master.' }
  })()

  const WEAK_COLORS = {
    weak:    { bg: '#fef2f2', color: '#ef4444' },
    partial: { bg: '#fffbeb', color: '#f59e0b' },
  }

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
              <span className="al-nav-icon">{Icon[item.icon]?.()}</span>
              <span className="al-nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Overall Progress in Sidebar */}
        {totalTopics > 0 && (
          <div className="al-sidebar-progress">
            <div className="al-progress-title">Overall Progress</div>
            <div className="al-donut-wrap">
              <SidebarDonut
                strong={strong} partial={partial} weak={weak}
                notPractised={notPractised} total={totalTopics}
                pct={mastery}
              />
              <div className="al-donut-info">
                <div className="al-donut-pct">{mastery}%</div>
                <div className="al-donut-label">
                  {mastery >= 70 ? 'Good Progress! 🎉' : mastery >= 40 ? 'Keep Going! 💪' : 'Just Started 🌱'}
                </div>
                <div className="al-donut-sub">{strong}/{totalTopics} concepts mastered</div>
              </div>
            </div>
            <div className="al-mastery-bar">
              <div className="al-mastery-bar-fill" style={{ width: `${mastery}%` }} />
            </div>

            {weakTopics.length > 0 && (
              <div className="al-weak-areas">
                <div className="al-weak-title">Weakest Areas</div>
                {weakTopics.map((t, i) => {
                  const clr = WEAK_COLORS[t.rating] || WEAK_COLORS.weak
                  return (
                    <div key={i} className="al-weak-item">
                      <div className="al-weak-icon" style={{ background: clr.bg }}>
                        <span style={{ color: clr.color, fontSize: '0.8rem' }}>
                          {t.rating === 'weak' ? '📉' : '📊'}
                        </span>
                      </div>
                      <span className="al-weak-name">{t.name}</span>
                      <span className="al-weak-pct" style={{ color: clr.color }}>
                        {t.confidence || 0}%
                      </span>
                    </div>
                  )
                })}
                <Link to="/concept-graph" className="al-weak-link">
                  View Weak Areas <Icon.ChevronRight />
                </Link>
              </div>
            )}
          </div>
        )}

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
            {/* Search */}
            <div className="al-search">
              <Icon.Search />
              <input
                type="text"
                placeholder="Search concepts, topics or skills..."
                value={searchVal}
                onChange={e => setSearchVal(e.target.value)}
              />
            </div>

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
        <div className={`al-content${location.pathname !== '/concept-graph' ? ' al-content-padded' : ''}`}>
          {children}
        </div>
      </main>
    </div>
  )
}
