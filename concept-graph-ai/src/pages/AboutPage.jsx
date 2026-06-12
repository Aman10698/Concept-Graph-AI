import { FileText, Brain, Network, HelpCircle, Award, Layers, Check, Database, Server, Code, Shield } from 'lucide-react'

const features = [
  {
    icon: <FileText size={26} strokeWidth={1.5} />,
    title: 'Syllabus Upload',
    desc: 'Upload any PDF or text syllabus. The system extracts all content using PDF.js and sends it to the AI pipeline.',
    color: '#6366f1',
    bg: '#e0e7ff'
  },
  {
    icon: <Brain size={26} strokeWidth={1.5} />,
    title: 'AI Topic Extraction',
    desc: 'Ollama (llama3.1) reads the document and identifies all key topics and subtopics with their relationships.',
    color: '#3b82f6',
    bg: '#dbeafe'
  },
  {
    icon: <Network size={26} strokeWidth={1.5} />,
    title: 'Dependency Graph',
    desc: 'Topics are mapped into a prerequisite dependency graph showing which concepts must be learned before others.',
    color: '#8b5cf6',
    bg: '#ede9fe'
  },
  {
    icon: <HelpCircle size={26} strokeWidth={1.5} />,
    title: 'Smart Question Generation',
    desc: 'Ollama generates targeted exam-style questions per topic — explicitly tagged so you always get the right questions.',
    color: '#f59e0b',
    bg: '#fef3c7'
  },
  {
    icon: <Award size={26} strokeWidth={1.5} />,
    title: 'AI Answer Evaluation',
    desc: 'Your answers are evaluated across accuracy, depth, examples, and clarity. Each topic gets a mastery rating.',
    color: '#10b981',
    bg: '#d1fae5'
  },
  {
    icon: <Layers size={26} strokeWidth={1.5} />,
    title: 'Multi-Syllabus Sessions',
    desc: 'Every uploaded syllabus is saved as an independent session. Switch between them anytime — progress persists.',
    color: '#ef4444',
    bg: '#fee2e2'
  },
]

const techStack = [
  { name: 'React',       role: 'Frontend UI',             color: '#0ea5e9' },
  { name: 'Ollama',      role: 'AI / LLM (llama3.1)',     color: '#f59e0b' },
  { name: 'Node.js',     role: 'Backend server',          color: '#22c55e' },
  { name: 'Express',     role: 'REST API',                color: '#64748b' },
  { name: 'MongoDB',     role: 'Session persistence',     color: '#10b981' },
  { name: 'Firebase',    role: 'Authentication',          color: '#f97316' },
  { name: 'PDF.js',      role: 'Document text extraction',color: '#ef4444' },
  { name: 'Canvas API',  role: 'Dependency graph render', color: '#6366f1' },
]

export default function AboutPage() {

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', paddingBottom: 60 }}>

      <style>{`
        .about-card {
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid #e2e8f0;
          background: #ffffff;
        }
        .about-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 28px rgba(0,0,0,0.06);
          border-color: #cbd5e1;
        }
        .tech-pill {
          transition: transform 0.2s;
        }
        .tech-pill:hover {
          transform: scale(1.02);
        }
      `}</style>

      {/* ── Hero ── */}
      <div style={{ marginBottom: 50, textAlign: 'center', paddingTop: 20 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px',
          borderRadius: 999, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
          marginBottom: 20,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#6366f1', boxShadow: '0 0 8px rgba(99,102,241,0.5)' }} />
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6366f1', letterSpacing: '0.02em' }}>Open Source Learning Platform</span>
        </div>
        <h1 style={{ fontSize: '2.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em', margin: '0 0 16px 0' }}>
          ConceptGraphAI
        </h1>
        <p style={{ color: '#64748b', fontSize: '1.05rem', lineHeight: 1.7, maxWidth: 640, margin: '0 auto' }}>
          An intelligent learning ecosystem that transforms static syllabuses into dynamic, personalized mastery graphs. 
          Powered entirely by local <span style={{ color: '#0f172a', fontWeight: 600 }}>Ollama</span> models and <span style={{ color: '#0f172a', fontWeight: 600 }}>MongoDB</span>.
        </p>
      </div>

      {/* ── How it works ── */}
      <div style={{ marginBottom: 56 }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24, textAlign: 'center' }}>
          Platform Features
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
          {features.map(f => (
            <div key={f.title} className="about-card" style={{ padding: '24px', borderRadius: 16 }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 12, marginBottom: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: f.bg, color: f.color
              }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0f172a', marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: '0.85rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Pipeline ── */}
      <div className="about-card" style={{ padding: '32px', marginBottom: 56, borderRadius: 20 }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 28, textAlign: 'center' }}>
          The AI Pipeline
        </h2>
        <div style={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center', gap: 0 }}>
          {[
            { step: '1', label: 'Upload PDF',         color: '#6366f1' },
            { step: '2', label: 'Extract Text',       color: '#3b82f6' },
            { step: '3', label: 'Ollama Topics',      color: '#8b5cf6' },
            { step: '4', label: 'Generate Questions', color: '#f59e0b' },
            { step: '5', label: 'Dependency Map',     color: '#10b981' },
            { step: '6', label: 'Evaluate Answers',   color: '#ef4444' },
          ].map((s, i, arr) => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ textAlign: 'center', width: 100 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', margin: '0 auto 10px',
                  background: `${s.color}15`, border: `2px solid ${s.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1rem', fontWeight: 800, color: s.color,
                }}>{s.step}</div>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#334155', lineHeight: 1.3 }}>{s.label}</p>
              </div>
              {i < arr.length - 1 && (
                <div style={{ width: 30, height: 2, background: '#e2e8f0', flexShrink: 0, marginTop: -24 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Tech stack ── */}
      <div style={{ marginBottom: 56 }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 24, textAlign: 'center' }}>
          Technology Stack
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 14 }}>
          {techStack.map(t => (
            <div key={t.name} className="tech-pill" style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: 12,
              background: '#f8fafc', border: '1px solid #e2e8f0',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0, boxShadow: `0 0 6px ${t.color}66` }} />
              <div>
                <p style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', margin: '0 0 2px 0' }}>{t.name}</p>
                <p style={{ fontSize: '0.75rem', color: '#64748b', margin: 0 }}>{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Data & Privacy ── */}
      <div className="about-card" style={{ padding: '32px', borderRadius: 20, background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <Shield size={24} color="#6366f1" strokeWidth={2.5} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            Data & Privacy Focus
          </h2>
        </div>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            'All AI processing is done locally using Ollama — no data is sent to external AI services.',
            'Your syllabuses and progress are stored in a local MongoDB instance on your machine.',
            'Authentication is handled securely by Firebase (email/password only).',
            'You can delete any session from the My Syllabuses page at any time.',
          ].map(item => (
            <li key={item} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ background: '#dcfce7', borderRadius: '50%', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 2 }}>
                <Check size={14} color="#16a34a" strokeWidth={3} />
              </div>
              <span style={{ fontSize: '0.9rem', color: '#475569', lineHeight: 1.5, fontWeight: 500 }}>{item}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  )
}
