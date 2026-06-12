import { useNavigate } from 'react-router-dom'
import {
  Network, Share2, UploadCloud, BrainCircuit, Activity, LineChart,
  Target, Zap, Lock, Database, ArrowRight, ShieldCheck, Cpu
} from 'lucide-react'
import './LandingPage.css'

/* ══════════════════════════════════════════════════════════════
   MINI CONCEPT NODE (used in hero mockup)
══════════════════════════════════════════════════════════════ */
function MiniNode({ name, badge, badgeBg, badgeColor, barColor, pct, isRoot = false }) {
  return (
    <div className={`lp-mini-node${isRoot ? ' lp-mini-node-root' : ''}`}>
      <div className="lp-mini-node-header">
        <div className="lp-mini-node-name">{name}</div>
      </div>
      <span className="lp-mini-node-badge" style={{ background: badgeBg, color: badgeColor }}>
        {badge}
      </span>
      <div className="lp-mini-bar-bg">
        <div className="lp-mini-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
      <div className="lp-mini-pct">{pct}% Mastery</div>
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
              <Network size={16} color="white" />
            </div>
            <div>
              <div className="lp-mockup-title-text">Dependency Graph</div>
              <div className="lp-mockup-title-sub">Real-time mastery tracking</div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="lp-mockup-body">
          {/* Graph area */}
          <div className="lp-mockup-graph">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flex: 1 }}>
              <MiniNode name="Machine Learning" badge="Root Concept" badgeBg="#f5f3ff" badgeColor="#6d28d9"
                barColor="#6d28d9" pct={65} isRoot />

              <div className="lp-mini-arrow">↓</div>

              <div style={{ display: 'flex', gap: 12 }}>
                <MiniNode name="Linear Algebra" badge="Strong" badgeBg="#dcfce7" badgeColor="#10b981"
                  barColor="#10b981" pct={90} />
                <MiniNode name="Prob & Stats" badge="Partial" badgeBg="#fef3c7" badgeColor="#f59e0b"
                  barColor="#f59e0b" pct={60} />
              </div>

              <div style={{ display: 'flex', gap: 100 }}>
                <div className="lp-mini-arrow">↓</div>
                <div className="lp-mini-arrow">↓</div>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <MiniNode name="Calculus" badge="Strong" badgeBg="#dcfce7" badgeColor="#10b981"
                  barColor="#10b981" pct={88} />
                <MiniNode name="Desc. Statistics" badge="Partial" badgeBg="#fef3c7" badgeColor="#f59e0b"
                  barColor="#f59e0b" pct={75} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%', paddingRight: 20 }}>
                <div className="lp-mini-arrow">↓</div>
              </div>

              <div style={{ alignSelf: 'flex-end', marginRight: 10 }}>
                <MiniNode name="Pandas" badge="Weak" badgeBg="#fee2e2" badgeColor="#ef4444"
                  barColor="#ef4444" pct={22} />
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
      iconBg: '#3b82f6',
      iconEl: <UploadCloud size={24} color="white" />,
      title: 'Upload Syllabus',
      desc: 'Provide your syllabus or topic. Our AI engine extracts all the fundamental concepts.',
    },
    {
      num: '2',
      iconBg: '#8b5cf6',
      iconEl: <Network size={24} color="white" />,
      title: 'Generate Graph',
      desc: 'We map all concepts and their dependencies to create a personalized knowledge tree.',
    },
    {
      num: '3',
      iconBg: '#10b981',
      iconEl: <Target size={24} color="white" />,
      title: 'Practice & Master',
      desc: 'Take AI-generated quizzes to identify weak areas and track your mastery level.',
    },
  ]

  const features = [
    {
      iconEl: <Network size={22} color="#6d28d9" />,
      iconBg: '#f4f0ff',
      title: 'Visual Dependency Graphs',
      desc: 'See exactly how concepts connect. Never learn advanced topics before mastering the basics.',
    },
    {
      iconEl: <BrainCircuit size={22} color="#10b981" />,
      iconBg: '#dcfce7',
      title: 'Root Cause Diagnostics',
      desc: 'Failing a quiz? Our AI traces back through the graph to find the exact prerequisite you missed.',
    },
    {
      iconEl: <Activity size={22} color="#f59e0b" />,
      iconBg: '#fef3c7',
      title: "Bloom's Taxonomy Levels",
      desc: "Track if you just Remember a concept or if you can actually Apply and Evaluate it.",
    },
    {
      iconEl: <Zap size={22} color="#ef4444" />,
      iconBg: '#fee2e2',
      title: 'AI Flashcards & Quizzes',
      desc: 'Generate tailored practice questions instantly for any node on your graph.',
    },
    {
      iconEl: <LineChart size={22} color="#3b82f6" />,
      iconBg: '#dbeafe',
      title: 'Real-time Mastery Tracking',
      desc: 'Watch your nodes turn from red to green as your overall mastery percentage climbs.',
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
              <Network size={20} color="white" strokeWidth={2.5} />
            </div>
            <div className="lp-logo-name">
              <span className="lp-logo-text">ConceptGraph</span>
            </div>
          </div>

          {/* Center nav */}
          <div className="lp-nav-center">
            {['How It Works', 'Features'].map(link => (
              <button key={link} className="lp-nav-link"
                onClick={() => document.getElementById(link.toLowerCase().replace(/ /g, '-'))?.scrollIntoView({ behavior: 'smooth' })}>
                {link}
              </button>
            ))}
          </div>

          {/* Right side CTA */}
          <div className="lp-nav-right">
            <button className="lp-btn-login" onClick={() => navigate('/login')}>Login</button>
            <button className="lp-btn-cta" onClick={() => navigate('/login')}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          {/* Left text */}
          <div className="lp-hero-text">
            <div className="lp-badge">
              <Cpu size={14} /> AI-Powered Learning Engine
            </div>

            <h1 className="lp-hero-heading">
              Understand Concepts.
              <span className="lp-hero-heading-accent">Not Just Answers.</span>
            </h1>

            <p className="lp-hero-sub">
              ConceptGraph AI maps your knowledge, finds weak foundations, and helps you master complex topics step by step with visual learning and smart analytics.
            </p>

            <div className="lp-hero-ctas">
              <button className="lp-btn-hero-primary" onClick={() => navigate('/login')}>
                Start Learning Free <ArrowRight size={18} />
              </button>
            </div>

            <div className="lp-hero-trust">
              {['Smart Analytics', 'Visual Learning', 'Root Cause Diagnostics'].map(label => (
                <div key={label} className="lp-trust-item">
                  <ShieldCheck size={16} color="#6d28d9" />
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
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="lp-features" id="features">
        <div className="lp-features-inner">
          <div className="lp-section-label">POWERFUL FEATURES</div>
          <h2 className="lp-section-heading">Everything You Need to Master Any Subject</h2>

          <div className="lp-features-grid">
            {features.map(f => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon-wrap" style={{ background: f.iconBg }}>
                  {f.iconEl}
                </div>
                <div className="lp-feature-title">{f.title}</div>
                <div className="lp-feature-desc">{f.desc}</div>
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
              Start your learning journey today and unlock your true potential with ConceptGraph.
            </p>
          </div>
          <div className="lp-cta-btns">
            <button className="lp-btn-cta-primary" onClick={() => navigate('/login')}>
              Get Started Free <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <div className="lp-logo">
              <div className="lp-logo-icon">
                <Network size={20} color="white" />
              </div>
              <div className="lp-logo-name">
                <span className="lp-logo-text">ConceptGraph</span>
              </div>
            </div>
            <p className="lp-footer-tagline">
              The AI-powered learning platform that maps knowledge and finds your blind spots.
            </p>
          </div>

          <div className="lp-footer-bottom">
            © 2024 ConceptGraph AI. All rights reserved.
          </div>
        </div>
      </footer>

    </div>
  )
}
