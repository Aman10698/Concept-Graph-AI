import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navigation() {
  const { logout } = useAuth()
  const location = useLocation()
  const isActive = (path) => location.pathname === path

  return (
    <nav className="t-nav">
      <div className="t-nav-inner">
        {/* Logo */}
        <Link to="/" className="t-logo">
          <div className="t-logo-icon">
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
          </div>
          <span className="t-logo-text">ConceptGraphAI</span>
        </Link>

        {/* Links */}
        <div className="t-nav-links">
          <Link to="/"               className={`t-nav-link ${isActive('/')               ? 'active' : ''}`}>Home</Link>
          <Link to="/dashboard"      className={`t-nav-link ${isActive('/dashboard')      ? 'active' : ''}`}>Dashboard</Link>
          <Link to="/concept-graph"  className={`t-nav-link ${isActive('/concept-graph')  ? 'active' : ''}`}>Learn</Link>
          <Link to="/practice"       className={`t-nav-link ${isActive('/practice')       ? 'active' : ''}`}>Practice</Link>
          <button
            onClick={logout}
            className="t-btn t-btn-danger t-btn-sm"
            id="nav-logout-btn"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
