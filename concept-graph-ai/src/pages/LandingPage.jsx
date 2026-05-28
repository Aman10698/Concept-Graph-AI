import { useNavigate } from 'react-router-dom'
import './LandingPage.css'

/* ══════════════════════════════════════════════════════════════
   MINI CONCEPT NODE (used in hero mockup)
══════════════════════════════════════════════════════════════ */
function MiniNode({ name, badge, badgeBg, badgeColor, barColor, pct, iconBg, isRoot = false }) {
  return (
    <div className={`lp-mini-node${isRoot ? ' lp-mini-node-root' : ''}`}
      style={{ borderColor: isRoot ? '#7c3aed' : undefined }}>
      <div className="lp-mini-node-header">
        <div className="lp-mini-node-icon" style={{ background: iconBg }}>
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={isRoot ? '#7c3aed' : '#9ca3af'} strokeWidth="2">
            <circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
        </div>
        <div className="lp-mini-node-name">{name}</div>
      </div>
      <span className="lp-mini-node-badge" style={{ background: badgeBg, color: badgeColor }}>
        {badge}
      </span>
      <div className="lp-mini-bar-bg">
        <div className="lp-mini-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="lp-mini-pct">{pct}%</div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   HERO MOCKUP — right side card
══════════════════════════════════════════════════════════════ */
function HeroMockup() {
  return (
    <div className="lp-hero-mockup">
      <div className="lp-mockup-card">

        {/* Card header */}
        <div className="lp-mockup-header">
          <div className="lp-mockup-title">
            <div className="lp-mockup-title-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="3"/>
                <circle cx="4" cy="8" r="2"/><circle cx="20" cy="8" r="2"/>
                <circle cx="4" cy="16" r="2"/><circle cx="20" cy="16" r="2"/>
                <line x1="12" y1="12" x2="4" y2="8"/><line x1="12" y1="12" x2="20" y2="8"/>
                <line x1="12" y1="12" x2="4" y2="16"/><line x1="12" y1="12" x2="20" y2="16"/>
              </svg>
            </div>
            <div>
              <div className="lp-mockup-title-text">Knowledge Graph</div>
              <div className="lp-mockup-title-sub">Visualize concepts, dependencies and your mastery</div>
            </div>
          </div>
          <div className="lp-mockup-actions">
            <button className="lp-mockup-bell">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
            </button>
            <div className="lp-mockup-avatar">AM</div>
          </div>
        </div>

        {/* Body */}
        <div className="lp-mockup-body">

          {/* Mini sidebar */}
          <div className="lp-mockup-sidebar">
            {[false, true, false, false, false].map((active, i) => (
              <div key={i} className={`lp-mockup-sidebar-icon${active ? ' active' : ''}`}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  {i === 0 && <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>}
                  {i === 1 && <><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/></>}
                  {i === 2 && <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>}
                  {i === 3 && <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></>}
                  {i === 4 && <><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></>}
                </svg>
              </div>
            ))}
          </div>

          {/* Graph area */}
          <div className="lp-mockup-graph">
            <div className="lp-mockup-toolbar">
              <button className="lp-mockup-tool-btn">
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3"/></svg>
                Fit View
              </button>
              <button className="lp-mockup-tool-btn">+ Zoom In</button>
              <button className="lp-mockup-tool-btn">− Zoom Out</button>
              <div className="lp-mockup-view-btn">View: Mastery ▾</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1, overflowY: 'auto' }}>
              <MiniNode name="Machine Learning" badge="Root Concept" badgeBg="#f5f3ff" badgeColor="#7c3aed"
                barColor="#7c3aed" pct={65} iconBg="#f5f3ff" isRoot />
              <div className="lp-mini-arrow">↓</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <MiniNode name="Linear Algebra" badge="Strong" badgeBg="#f0fdf4" badgeColor="#22c55e"
                  barColor="#22c55e" pct={90} iconBg="#f0fdf4" />
                <MiniNode name="Prob & Stats" badge="Partial" badgeBg="#fffbeb" badgeColor="#f59e0b"
                  barColor="#f59e0b" pct={60} iconBg="#fffbeb" />
                <MiniNode name="Python" badge="Strong" badgeBg="#f0fdf4" badgeColor="#22c55e"
                  barColor="#22c55e" pct={80} iconBg="#f0fdf4" />
              </div>
              <div style={{ display: 'flex', gap: 90 }}>
                <div className="lp-mini-arrow">↓</div>
                <div className="lp-mini-arrow">↓</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <MiniNode name="Calculus" badge="Strong" badgeBg="#f0fdf4" badgeColor="#22c55e"
                  barColor="#22c55e" pct={88} iconBg="#f0fdf4" />
                <MiniNode name="Desc. Statistics" badge="Partial" badgeBg="#fffbeb" badgeColor="#f59e0b"
                  barColor="#f59e0b" pct={75} iconBg="#fffbeb" />
                <MiniNode name="NumPy" badge="Strong" badgeBg="#f0fdf4" badgeColor="#22c55e"
                  barColor="#22c55e" pct={80} iconBg="#f0fdf4" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', paddingRight: 12 }}>
                <div className="lp-mini-arrow">↓</div>
              </div>
              <div style={{ alignSelf: 'flex-end', marginRight: 8 }}>
                <MiniNode name="Pandas" badge="Weak" badgeBg="#fef2f2" badgeColor="#ef4444"
                  barColor="#ef4444" pct={22} iconBg="#fef2f2" />
              </div>
            </div>
          </div>

          {/* Streak panel */}
          <div className="lp-mockup-streak">
            <div className="lp-streak-title">Today's Streak</div>
            <div className="lp-streak-row">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#ef4444"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              <span className="lp-streak-num">12</span>
              <span className="lp-streak-label">Day Streak</span>
            </div>
            <div className="lp-streak-sub">Keep learning to maintain your streak!</div>
            <div className="lp-streak-bar-bg">
              <div className="lp-streak-bar-fill" style={{ width: '90%' }} />
            </div>
            <div className="lp-streak-progress-text">4/5 tasks completed today &nbsp; 90%</div>

            <div className="lp-divider" />

            <div className="lp-missions-title">Today's Missions</div>
            {[
              { label: 'Solve 5 Practice Questions', done: true,  count: '5/5' },
              { label: 'Review 1 Weak Concept',      done: true,  count: '1/1' },
              { label: 'Complete 1 Quiz',             done: false, count: '0/1' },
              { label: 'Reach Apply Level',           done: false, count: '0/1' },
            ].map((m, i) => (
              <div key={i} className="lp-mission-row">
                <div className={`lp-mission-check${m.done ? ' done' : ''}`}>
                  {m.done && (
                    <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                      <polyline points="20,6 9,17 4,12"/>
                    </svg>
                  )}
                </div>
                <span className="lp-mission-label">{m.label}</span>
                <span className={`lp-mission-count${m.done ? ' done' : ''}`}>{m.count}</span>
              </div>
            ))}

            <div className="lp-divider" />

            <div className="lp-overall-title">Overall Progress</div>
            <div className="lp-overall-row">
              <div className="lp-overall-donut">
                <svg width="48" height="48" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="18" fill="none" stroke="#f1f3f9" strokeWidth="5"/>
                  <circle cx="24" cy="24" r="18" fill="none" stroke="#7c3aed" strokeWidth="5"
                    strokeDasharray={`${72 * 2 * Math.PI / 100 * 18} ${2 * Math.PI * 18}`}
                    strokeDashoffset={2 * Math.PI * 18 * 0.25}
                    strokeLinecap="round"
                    transform="rotate(-90 24 24)"/>
                  <text x="24" y="28" textAnchor="middle" fontSize="10" fontWeight="800" fill="#7c3aed">72%</text>
                </svg>
              </div>
              <div className="lp-overall-info">
                <div className="lp-overall-status">Good Progress!</div>
                <div className="lp-overall-sub">24/34 concepts mastered</div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate()

  const steps = [
    {
      num: '1',
      iconBg: 'linear-gradient(135deg, #3b82f6, #6366f1)',
      iconEl: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
      title: 'Upload or Enter Topic',
      desc:  'Provide any topic or subject. Our AI extracts key concepts and builds the foundation.',
    },
    {
      num: '2',
      iconBg: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
      iconEl: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3"/>
          <circle cx="3" cy="6" r="2"/><circle cx="21" cy="6" r="2"/>
          <circle cx="3" cy="18" r="2"/><circle cx="21" cy="18" r="2"/>
          <line x1="12" y1="12" x2="3" y2="6"/><line x1="12" y1="12" x2="21" y2="6"/>
          <line x1="12" y1="12" x2="3" y2="18"/><line x1="12" y1="12" x2="21" y2="18"/>
        </svg>
      ),
      title: 'Build Knowledge Graph',
      desc:  'We map all concepts and their dependencies to create your personalised knowledge graph.',
    },
    {
      num: '3',
      iconBg: 'linear-gradient(135deg, #06b6d4, #6366f1)',
      iconEl: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="6"/>
          <circle cx="12" cy="12" r="2"/>
        </svg>
      ),
      title: 'Improve & Master',
      desc:  'Identify weak areas, follow learning paths, and level up with streaks and missions.',
    },
  ]

  const features = [
    {
      iconEl: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="3"/>
          <circle cx="3" cy="6" r="2"/><circle cx="21" cy="6" r="2"/>
          <circle cx="3" cy="18" r="2"/><circle cx="21" cy="18" r="2"/>
          <line x1="12" y1="12" x2="3" y2="6"/><line x1="12" y1="12" x2="21" y2="6"/>
          <line x1="12" y1="12" x2="3" y2="18"/><line x1="12" y1="12" x2="21" y2="18"/>
        </svg>
      ),
      iconBg: 'rgba(99,102,241,0.1)',
      title: 'Visual Knowledge Graph',
      desc:  'See how concepts are connected and dependent on each other.',
      preview: (
        <div className="lp-feature-preview">
          <svg width="100%" height="56" viewBox="0 0 180 56">
            <circle cx="90" cy="28" r="10" fill="#ede9fe" stroke="#7c3aed" strokeWidth="1.5"/>
            <circle cx="40" cy="28" r="8" fill="#f0fdf4" stroke="#22c55e" strokeWidth="1.5"/>
            <circle cx="140" cy="28" r="8" fill="#fef2f2" stroke="#ef4444" strokeWidth="1.5"/>
            <circle cx="65" cy="8" r="7" fill="#fffbeb" stroke="#f59e0b" strokeWidth="1.5"/>
            <circle cx="115" cy="8" r="7" fill="#f0fdf4" stroke="#22c55e" strokeWidth="1.5"/>
            <line x1="90" y1="28" x2="40" y2="28" stroke="#9ca3af" strokeWidth="1" strokeDasharray="3 2"/>
            <line x1="90" y1="28" x2="140" y2="28" stroke="#9ca3af" strokeWidth="1"/>
            <line x1="90" y1="28" x2="65" y2="8" stroke="#9ca3af" strokeWidth="1"/>
            <line x1="90" y1="28" x2="115" y2="8" stroke="#9ca3af" strokeWidth="1" strokeDasharray="3 2"/>
            <text x="90" y="32" textAnchor="middle" fontSize="6" fontWeight="700" fill="#7c3aed">ML</text>
            <text x="40" y="31.5" textAnchor="middle" fontSize="5.5" fontWeight="600" fill="#22c55e">Algebra</text>
            <text x="140" y="31.5" textAnchor="middle" fontSize="5.5" fontWeight="600" fill="#ef4444">Stats</text>
            <text x="65" y="11" textAnchor="middle" fontSize="5.5" fontWeight="600" fill="#f59e0b">Python</text>
            <text x="115" y="11" textAnchor="middle" fontSize="5.5" fontWeight="600" fill="#22c55e">Numpy</text>
          </svg>
        </div>
      ),
    },
    {
      iconEl: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      ),
      iconBg: 'rgba(239,68,68,0.1)',
      title: 'Root Cause Analysis',
      desc:  'Find out why a concept is weak by tracing its dependency chain.',
      preview: (
        <div className="lp-feature-preview">
          {[
            { name: 'Pandas (Weak)',        color: '#ef4444', bg: '#fef2f2' },
            { name: 'NumPy (Partial)',       color: '#f59e0b', bg: '#fffbeb' },
            { name: 'Probability (Partial)', color: '#f59e0b', bg: '#fffbeb' },
          ].map((d, i) => (
            <div key={i}>
              <div className="lp-dep-item">
                <div className="lp-dep-dot" style={{ background: d.color }} />
                <span className="lp-dep-name" style={{ background: d.bg, padding: '2px 8px', borderRadius: 4, color: d.color }}>{d.name}</span>
              </div>
              {i < 2 && <div style={{ fontSize: '0.62rem', color: '#9ca3af', paddingLeft: 20, marginBottom: 2 }}>↳</div>}
            </div>
          ))}
        </div>
      ),
    },
    {
      iconEl: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round">
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
          <circle cx="12" cy="12" r="10"/>
        </svg>
      ),
      iconBg: 'rgba(168,85,247,0.1)',
      title: "Bloom's Taxonomy",
      desc:  "Track your understanding across all Bloom's levels.",
      preview: (
        <div className="lp-feature-preview">
          {[
            { label: 'Create',     color: '#22c55e', w: '30%' },
            { label: 'Evaluate',   color: '#3b82f6', w: '45%' },
            { label: 'Apply',      color: '#f59e0b', w: '75%', bold: true },
            { label: 'Understand', color: '#6366f1', w: '60%' },
            { label: 'Remember',   color: '#22c55e', w: '90%' },
          ].map((b, i) => (
            <div key={i} className="lp-bloom-row">
              <span className="lp-bloom-label">{b.label}</span>
              <div className="lp-bloom-bar" style={{
                background: b.bold ? b.color : `${b.color}22`,
                width: b.w,
                border: b.bold ? 'none' : `1px solid ${b.color}44`,
              }}>
                {b.bold && <span style={{ color: '#fff', fontSize: '0.5rem', fontWeight: 700 }}>{b.label}</span>}
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      iconEl: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
        </svg>
      ),
      iconBg: 'rgba(239,68,68,0.1)',
      title: 'Learning Streaks',
      desc:  'Stay consistent with daily missions and build powerful learning habits.',
      preview: (
        <div className="lp-feature-preview">
          <div className="lp-cal-mini" style={{ marginBottom: 6 }}>
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} className="lp-cal-header">{d}</div>
            ))}
            {['done','done','done','done','done','done','miss',
              'done','done','done','done','streak','done','done'].map((t, i) => (
              <div key={i} className="lp-cal-cell" style={{
                background: t === 'done' ? '#ede9fe' : t === 'streak' ? '#fef2f2' : '#f4f4f6',
              }}>
                {t === 'done' && <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round"><polyline points="20,6 9,17 4,12"/></svg>}
                {t === 'streak' && <svg width="7" height="7" viewBox="0 0 24 24" fill="#ef4444"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#ef4444"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '0.9rem' }}>12</span>
            <span style={{ color: '#6b7280', fontWeight: 600 }}>Day Streak</span>
          </div>
        </div>
      ),
    },
    {
      iconEl: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
      ),
      iconBg: 'rgba(99,102,241,0.1)',
      title: 'Progress Analytics',
      desc:  'Get detailed insights into your strengths, weaknesses and overall progress.',
      preview: (
        <div className="lp-feature-preview" style={{ display: 'flex', justifyContent: 'center' }}>
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="30" fill="none" stroke="#f1f3f9" strokeWidth="8"/>
            <circle cx="40" cy="40" r="30" fill="none" stroke="#7c3aed" strokeWidth="8"
              strokeDasharray={`${2 * Math.PI * 30 * 0.72} ${2 * Math.PI * 30}`}
              strokeDashoffset={2 * Math.PI * 30 * 0.25}
              strokeLinecap="round"
              transform="rotate(-90 40 40)"/>
            <text x="40" y="37" textAnchor="middle" fontSize="14" fontWeight="800" fill="#7c3aed">72%</text>
            <text x="40" y="49" textAnchor="middle" fontSize="7" fontWeight="600" fill="#9ca3af">Overall Mastery</text>
          </svg>
        </div>
      ),
    },
  ]

  return (
    <div className="lp-root">

      {/* ─── Navbar ─── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          {/* Logo */}
          <div className="lp-logo">
            <div className="lp-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" fill="white" opacity="0.9"/>
                <circle cx="5"  cy="7"  r="2.5" fill="white" opacity="0.7"/>
                <circle cx="19" cy="7"  r="2.5" fill="white" opacity="0.7"/>
                <circle cx="5"  cy="17" r="2.5" fill="white" opacity="0.7"/>
                <circle cx="19" cy="17" r="2.5" fill="white" opacity="0.7"/>
                <line x1="12" y1="12" x2="5"  y2="7"  stroke="white" strokeWidth="1.5" opacity="0.6"/>
                <line x1="12" y1="12" x2="19" y2="7"  stroke="white" strokeWidth="1.5" opacity="0.6"/>
                <line x1="12" y1="12" x2="5"  y2="17" stroke="white" strokeWidth="1.5" opacity="0.6"/>
                <line x1="12" y1="12" x2="19" y2="17" stroke="white" strokeWidth="1.5" opacity="0.6"/>
              </svg>
            </div>
            <div className="lp-logo-name">
              <span className="lp-logo-text">ConceptGraph <span>AI</span></span>
              <span className="lp-logo-tagline">Learn. Connect. Master.</span>
            </div>
          </div>

          {/* Center nav */}
          <div className="lp-nav-center">
            {['Features', 'How It Works', 'Why ConceptGraph', 'Pricing', 'Blog'].map(link => (
              <button key={link} className="lp-nav-link"
                onClick={() => link === 'Features'
                  ? document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
                  : link === 'How It Works'
                  ? document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })
                  : undefined}>
                {link}
              </button>
            ))}
          </div>

          {/* No right-side buttons per user request */}
          <div className="lp-nav-right" />
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">

          {/* Left text */}
          <div className="lp-hero-text">
            <div className="lp-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              AI-Powered Learning Platform
            </div>

            <h1 className="lp-hero-heading">
              Understand Concepts.
              <span className="lp-hero-heading-accent">Not Just Answers.</span>
            </h1>

            <p className="lp-hero-sub">
              ConceptGraph AI maps your knowledge, finds weak foundations, and helps you master more concepts step by step with visual learning, smart analytics and learning streaks.
            </p>

            <div className="lp-hero-ctas">
              <button className="lp-btn-hero-primary" onClick={() => navigate('/login')} id="hero-get-started-btn">
                Get Started Free &nbsp;→
              </button>
              <button className="lp-btn-hero-ghost" onClick={() => navigate('/login')}>
                Login
              </button>
            </div>

            <div className="lp-hero-trust">
              {['AI Powered', 'Visual Learning', 'Smart Analytics', 'Learning Streaks'].map(label => (
                <div key={label} className="lp-trust-item">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="20,6 9,17 4,12"/>
                  </svg>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right mockup */}
          <HeroMockup />
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="lp-how" id="how-it-works">
        <div className="lp-how-inner">
          <div className="lp-section-label">HOW IT WORKS</div>
          <h2 className="lp-section-heading">Learn Smarter in 3 Simple Steps</h2>

          <div className="lp-how-steps">
            {steps.map((s, i) => (
              <div key={s.num} style={{ display: 'contents' }}>
                <div className="lp-step-card">
                  <div className="lp-step-num-row">
                    <div className="lp-step-num-badge">{s.num}</div>
                    <div className="lp-step-icon-wrap" style={{ background: s.iconBg }}>
                      {s.iconEl}
                    </div>
                  </div>
                  <div className="lp-step-title">{s.title}</div>
                  <div className="lp-step-desc">{s.desc}</div>
                </div>
                {i < steps.length - 1 && (
                  <div className="lp-step-arrow-col">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12,8 16,12 12,16"/>
                      <line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="lp-features" id="features">
        <div className="lp-features-inner">
          <div className="lp-section-label">POWERFUL FEATURES FOR BETTER LEARNING</div>
          <h2 className="lp-section-heading">Everything You Need to Master Any Subject</h2>

          <div className="lp-features-grid">
            {features.map(f => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon-wrap" style={{ background: f.iconBg }}>
                  {f.iconEl}
                </div>
                <div className="lp-feature-title">{f.title}</div>
                <div className="lp-feature-desc">{f.desc}</div>
                {f.preview}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="lp-cta">
        <div className="lp-cta-inner">
          <div className="lp-cta-left">
            <h2 className="lp-cta-title">Ready to Master Any Concept?</h2>
            <p className="lp-cta-sub">
              Start your learning journey today and unlock your true potential with ConceptGraph AI.
            </p>
          </div>
          <div className="lp-cta-btns">
            <button className="lp-btn-cta-primary" onClick={() => navigate('/login')}>
              Get Started Free &nbsp;→
            </button>
            <button className="lp-btn-cta-ghost" onClick={() => navigate('/login')}>
              Login
            </button>
          </div>
          <div className="lp-cta-rocket">
            <svg width="70" height="70" viewBox="0 0 80 80" fill="none">
              <ellipse cx="40" cy="66" rx="14" ry="5" fill="rgba(255,255,255,0.08)"/>
              <path d="M40 6 C28 6 20 22 20 40 L20 56 Q30 60 40 58 Q50 60 60 56 L60 40 C60 22 52 6 40 6Z"
                fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>
              <circle cx="40" cy="30" r="8" fill="rgba(255,255,255,0.25)" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5"/>
              <path d="M20 50 L12 60 L24 55Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
              <path d="M60 50 L68 60 L56 55Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.25)" strokeWidth="1"/>
              <path d="M33 56 Q36 68 40 72 Q44 68 47 56" fill="rgba(251,146,60,0.45)" stroke="rgba(251,146,60,0.6)" strokeWidth="1"/>
            </svg>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          {/* Brand */}
          <div className="lp-footer-brand">
            <div className="lp-logo">
              <div className="lp-logo-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="4" fill="white" opacity="0.9"/>
                  <circle cx="5"  cy="7"  r="2.5" fill="white" opacity="0.7"/>
                  <circle cx="19" cy="7"  r="2.5" fill="white" opacity="0.7"/>
                  <circle cx="5"  cy="17" r="2.5" fill="white" opacity="0.7"/>
                  <circle cx="19" cy="17" r="2.5" fill="white" opacity="0.7"/>
                  <line x1="12" y1="12" x2="5"  y2="7"  stroke="white" strokeWidth="1.5" opacity="0.6"/>
                  <line x1="12" y1="12" x2="19" y2="7"  stroke="white" strokeWidth="1.5" opacity="0.6"/>
                  <line x1="12" y1="12" x2="5"  y2="17" stroke="white" strokeWidth="1.5" opacity="0.6"/>
                  <line x1="12" y1="12" x2="19" y2="17" stroke="white" strokeWidth="1.5" opacity="0.6"/>
                </svg>
              </div>
              <div className="lp-logo-name">
                <span className="lp-logo-text">ConceptGraph <span>AI</span></span>
                <span className="lp-logo-tagline">Learn. Connect. Master.</span>
              </div>
            </div>
            <p className="lp-footer-tagline">
              The AI-powered learning platform that maps knowledge and finds your blind spots.
            </p>
          </div>

          {/* Product */}
          <div>
            <div className="lp-footer-col-title">Product</div>
            <div className="lp-footer-links">
              {['Features', 'How It Works', 'Pricing', 'Updates'].map(l => (
                <button key={l} className="lp-footer-link">{l}</button>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <div className="lp-footer-col-title">Resources</div>
            <div className="lp-footer-links">
              {['Blog', 'Guides', 'Help Center', 'Community'].map(l => (
                <button key={l} className="lp-footer-link">{l}</button>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <div className="lp-footer-col-title">Company</div>
            <div className="lp-footer-links">
              {['About Us', 'Careers', 'Privacy Policy', 'Terms of Service'].map(l => (
                <button key={l} className="lp-footer-link">{l}</button>
              ))}
            </div>
          </div>

          {/* Social */}
          <div>
            <div className="lp-footer-col-title">Connect with us</div>
            <div className="lp-social-row">
              {[
                { label: 'X',  title: 'Twitter'  },
                { label: 'in', title: 'LinkedIn'  },
                { label: 'gh', title: 'GitHub'    },
                { label: 'Di', title: 'Discord'   },
                { label: 'M',  title: 'Medium'    },
              ].map(s => (
                <button key={s.title} className="lp-social-btn" title={s.title}>{s.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="lp-footer-bottom">
          © 2024 ConceptGraph AI. All rights reserved.
        </div>
      </footer>

    </div>
  )
}
