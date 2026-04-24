import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import './LandingPage.css'

/* ── Concept map data ────────────────────────────────────────── */
const nodes = [
  { id: 'programming', label: 'Programming', x: 50, y: 48, status: 'center', size: 'large' },
  { id: 'functions',   label: 'Functions',   x: 22, y: 18, status: 'strong'  },
  { id: 'variables',   label: 'Variables',   x: 78, y: 18, status: 'strong'  },
  { id: 'conditions',  label: 'Conditions',  x: 10, y: 50, status: 'partial' },
  { id: 'loops',       label: 'Loops',       x: 88, y: 50, status: 'weak'    },
  { id: 'oop',         label: 'OOP',         x: 22, y: 80, status: 'partial' },
  { id: 'arrays',      label: 'Arrays',      x: 78, y: 78, status: 'strong'  },
  { id: 'recursion',   label: 'Recursion',   x: 50, y: 88, status: 'strong'  },
]

const edges = [
  { from: 'programming', to: 'functions'  },
  { from: 'programming', to: 'variables'  },
  { from: 'programming', to: 'conditions' },
  { from: 'programming', to: 'loops'      },
  { from: 'programming', to: 'oop'        },
  { from: 'programming', to: 'arrays'     },
  { from: 'programming', to: 'recursion'  },
]

const statusConfig = {
  center:  { bg: '#fff',      border: '#6366f1', dot: '#6366f1', text: '#1a2340', icon: null       },
  strong:  { bg: '#f0fdf4',   border: '#22c55e', dot: '#22c55e', text: '#14532d', icon: '✓'        },
  partial: { bg: '#fefce8',   border: '#f59e0b', dot: '#f59e0b', text: '#713f12', icon: '!'        },
  weak:    { bg: '#fff7ed',   border: '#ef4444', dot: '#ef4444', text: '#7c2d12', icon: '⚠'        },
}

/* ── Actual steps in the website ─────────────────────────────── */
const steps = [
  {
    num: '1',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="6" y="3" width="20" height="26" rx="3" stroke="white" strokeWidth="2"/>
        <line x1="10" y1="10" x2="22" y2="10" stroke="white" strokeWidth="2"/>
        <line x1="10" y1="15" x2="22" y2="15" stroke="white" strokeWidth="2"/>
        <line x1="10" y1="20" x2="18" y2="20" stroke="white" strokeWidth="2"/>
        <circle cx="24" cy="26" r="5" fill="#22c55e" stroke="white" strokeWidth="1.5"/>
        <line x1="22" y1="26" x2="24" y2="28" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="24" y1="28" x2="27" y2="24" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    color: 'blue',
    title: 'Upload Your Syllabus',
    desc:  'Go to the Learn page and upload any PDF syllabus. The system extracts all text using PDF.js.',
  },
  {
    num: '2',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="4" fill="white"/>
        <circle cx="6"  cy="8"  r="2.5" fill="white" opacity="0.8"/>
        <circle cx="26" cy="8"  r="2.5" fill="white" opacity="0.8"/>
        <circle cx="6"  cy="24" r="2.5" fill="white" opacity="0.8"/>
        <circle cx="26" cy="24" r="2.5" fill="white" opacity="0.8"/>
        <line x1="16" y1="16" x2="6"  y2="8"  stroke="white" strokeWidth="1.5"/>
        <line x1="16" y1="16" x2="26" y2="8"  stroke="white" strokeWidth="1.5"/>
        <line x1="16" y1="16" x2="6"  y2="24" stroke="white" strokeWidth="1.5"/>
        <line x1="16" y1="16" x2="26" y2="24" stroke="white" strokeWidth="1.5"/>
      </svg>
    ),
    color: 'purple',
    title: 'AI Builds Concept Graph',
    desc:  'Ollama (llama3.1) reads the document and extracts all topics, subtopics, and their relationships.',
  },
  {
    num: '3',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4" y="6" width="24" height="4" rx="2" fill="white" opacity="0.9"/>
        <rect x="4" y="14" width="24" height="4" rx="2" fill="white" opacity="0.9"/>
        <rect x="4" y="22" width="16" height="4" rx="2" fill="white" opacity="0.9"/>
        <circle cx="26" cy="24" r="4" fill="#22c55e" stroke="white" strokeWidth="1.5"/>
        <path d="M24 24 L25.5 25.5 L28.5 22.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    color: 'green',
    title: 'Take AI-Generated Quizzes',
    desc:  'AI generates 3 targeted exam-style questions per topic. Answer them to get evaluated by Ollama.',
  },
  {
    num: '4',
    icon: (
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <rect x="4"  y="20" width="5" height="8" rx="1.5" fill="white" opacity="0.9"/>
        <rect x="13" y="14" width="5" height="14" rx="1.5" fill="white" opacity="0.9"/>
        <rect x="22" y="8"  width="5" height="20" rx="1.5" fill="white" opacity="0.9"/>
        <path d="M6 18 L15 12 L24 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
        <circle cx="24" cy="6" r="2" fill="white"/>
      </svg>
    ),
    color: 'orange',
    title: 'Get Insights & Fix Root Causes',
    desc:  'See mastery ratings per topic, identify prerequisite gaps with the root cause dependency graph, and revisit weak areas.',
  },
]

/* ── Concept Map component ───────────────────────────────────── */
function ConceptMap() {
  const svgRef = useRef(null)
  const [svgSize, setSvgSize] = useState({ w: 500, h: 380 })

  useEffect(() => {
    const update = () => {
      if (svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        setSvgSize({ w: rect.width, h: rect.height })
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const getPos = (node) => ({
    x: (node.x / 100) * svgSize.w,
    y: (node.y / 100) * svgSize.h,
  })

  return (
    <div className="lp-concept-map-wrapper">
      <svg ref={svgRef} className="lp-concept-svg" width="100%" height="100%"
        viewBox={`0 0 ${svgSize.w} ${svgSize.h}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="glow-filter">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
            <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {edges.map((edge, i) => {
          const from = getPos(nodes.find(n => n.id === edge.from))
          const to   = getPos(nodes.find(n => n.id === edge.to))
          const toNode = nodes.find(n => n.id === edge.to)
          const colors = { strong: '#22c55e', partial: '#f59e0b', weak: '#ef4444', center: '#6366f1' }
          const color  = colors[toNode.status] || '#6366f1'
          return (
            <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={color} strokeWidth="1.5" strokeOpacity="0.4"
              strokeDasharray={toNode.status === 'weak' ? '6,4' : 'none'}
              className="lp-edge-line"
            />
          )
        })}
      </svg>

      <div className="lp-nodes-overlay">
        {nodes.map(node => {
          const cfg = statusConfig[node.status]
          const isCenter = node.status === 'center'
          return (
            <div key={node.id} className={`lp-node ${isCenter ? 'lp-node-center' : ''}`}
              style={{ left: `${node.x}%`, top: `${node.y}%`, background: cfg.bg, borderColor: cfg.border }}>
              {!isCenter && cfg.icon && (
                <span className="lp-node-icon" style={{ background: cfg.dot, color: '#fff' }}>
                  {cfg.icon}
                </span>
              )}
              <span className="lp-node-label" style={{ color: cfg.text, fontWeight: isCenter ? 700 : 600 }}>
                {node.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ── Legend component ────────────────────────────────────────── */
function MapLegend() {
  const items = [
    { color: '#22c55e', label: 'Strong'       },
    { color: '#f59e0b', label: 'Partial'      },
    { color: '#ef4444', label: 'Weak'         },
    { color: '#9ca3af', label: 'Not Attempted'},
  ]
  return (
    <div className="lp-map-legend">
      {items.map(({ color, label }) => (
        <div key={label} className="lp-legend-item">
          <span className="lp-legend-dot" style={{ background: color }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="lp-root">

      {/* ─── Navbar ─── */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-logo">
            <div className="lp-logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
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
            <span className="lp-logo-text">ConceptGraphAI</span>
          </div>

          <div className="lp-nav-links">
            <button className="lp-nav-link lp-nav-btn lp-nav-active" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Home</button>
            <button className="lp-nav-link lp-nav-btn" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Features</button>
            <button className="lp-nav-link lp-nav-btn" onClick={() => navigate('/about')}>About Us</button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">

          {/* Left */}
          <div className="lp-hero-text">
            <div className="lp-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              AI-Powered Concept Learning
            </div>

            <h1 className="lp-hero-heading">
              Understand Concepts.<br/>
              <span className="lp-hero-heading-accent">Not Just Answers.</span>
            </h1>

            <p className="lp-hero-sub">
              AI builds a smart concept map from your syllabus,
              detects weak foundations, and guides you to
              master every topic with clarity.
            </p>

            <button className="lp-btn-primary lp-btn-hero" onClick={() => navigate('/login')} id="hero-get-started-btn">
              Get Started &nbsp;›
            </button>

            {/* Mini feature pills */}
            <div className="lp-feature-pills">
              {[
                { icon: '🧠', title: 'AI Analysis',      sub: 'Smart evaluation'     },
                { icon: '🔗', title: 'Concept Graph',    sub: 'Visual learning'      },
                { icon: '🔍', title: 'Root Cause',       sub: 'Find weak basics'     },
                { icon: '📈', title: 'Progress Tracking',sub: 'Improve continuously' },
              ].map(p => (
                <div key={p.title} className="lp-pill">
                  <span className="lp-pill-icon">{p.icon}</span>
                  <div>
                    <p className="lp-pill-title">{p.title}</p>
                    <p className="lp-pill-sub">{p.sub}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: concept map card */}
          <div className="lp-map-card">
            <MapLegend />
            <div className="lp-hero-map">
              <ConceptMap />
            </div>
            {/* Insight box */}
            <div className="lp-insight-box">
              <span className="lp-insight-icon">💡</span>
              <p className="lp-insight-text">
                <strong>Weak in Loops?</strong> Your understanding may be affected because{' '}
                <span style={{ color: '#22c55e', fontWeight: 600 }}>Functions</span> and{' '}
                <span style={{ color: '#f59e0b', fontWeight: 600 }}>Conditions</span> are not fully strong.
              </p>
            </div>
          </div>

        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section className="lp-how" id="features">
        <div className="lp-how-inner">
          <div className="lp-how-header">
            <h2 className="lp-how-title">How it works</h2>
            <p className="lp-how-sub">Simple steps to better understanding</p>
          </div>

          <div className="lp-how-steps">
            {steps.map((s, i) => (
              <div key={s.num} style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div className="lp-step">
                  <div className={`lp-step-icon lp-step-icon-${s.color}`}>{s.icon}</div>
                  <div>
                    <div className="lp-step-num-badge">{s.num}</div>
                    <div className="lp-step-num">{s.title}</div>
                    <div className="lp-step-desc">{s.desc}</div>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div className="lp-step-arrow">- - →</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  )
}
