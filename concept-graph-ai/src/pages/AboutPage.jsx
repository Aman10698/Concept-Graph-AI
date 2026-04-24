

const features = [
  {
    icon: '📄',
    title: 'Syllabus Upload',
    desc: 'Upload any PDF or text syllabus. The system extracts all content using PDF.js and sends it to the AI pipeline.',
    color: '#6366f1',
  },
  {
    icon: '🧠',
    title: 'AI Topic Extraction',
    desc: 'Ollama (llama3.1) reads the document and identifies all key topics and subtopics with their relationships.',
    color: '#3b82f6',
  },
  {
    icon: '🔗',
    title: 'Dependency Graph',
    desc: 'Topics are mapped into a prerequisite dependency graph showing which concepts must be learned before others.',
    color: '#8b5cf6',
  },
  {
    icon: '❓',
    title: 'Smart Question Generation',
    desc: 'Ollama generates 3 targeted exam-style questions per topic — explicitly tagged so you always get the right questions.',
    color: '#f59e0b',
  },
  {
    icon: '✍️',
    title: 'AI Answer Evaluation',
    desc: 'Your answers are evaluated across accuracy, depth, examples, and clarity. Each topic gets a mastery rating.',
    color: '#22c55e',
  },
  {
    icon: '📚',
    title: 'Multi-Syllabus Sessions',
    desc: 'Every uploaded syllabus is saved as an independent session in MongoDB. Switch between them anytime — progress persists.',
    color: '#ef4444',
  },
]

const techStack = [
  { name: 'React',       role: 'Frontend UI',             color: '#61dafb' },
  { name: 'Ollama',      role: 'AI / LLM (llama3.1)',     color: '#f59e0b' },
  { name: 'Node.js',     role: 'Backend server',          color: '#68a063' },
  { name: 'Express',     role: 'REST API',                color: '#374151' },
  { name: 'MongoDB',     role: 'Session persistence',     color: '#22c55e' },
  { name: 'Firebase',    role: 'Authentication',          color: '#f97316' },
  { name: 'PDF.js',      role: 'Document text extraction',color: '#6366f1' },
  { name: 'Canvas API',  role: 'Dependency graph render', color: '#3b82f6' },
]

export default function AboutPage() {

  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>

      {/* ── Hero ── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '4px 14px',
          borderRadius: 999, background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
          marginBottom: 14,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#6366f1' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#6366f1' }}>Open Source Project</span>
        </div>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em', marginBottom: 10 }}>
          ConceptGraphAI
        </h1>
        <p style={{ color: '#6b7280', fontSize: '1rem', lineHeight: 1.7, maxWidth: 600 }}>
          An AI-powered learning platform that turns any syllabus into an interactive, personalized study experience —
          powered by local Ollama models and MongoDB.
        </p>
      </div>

      {/* ── How it works ── */}
      <div style={{ marginBottom: 40 }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
          How It Works
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 14 }}>
          {features.map(f => (
            <div key={f.title} className="t-card" style={{ padding: '20px 18px', borderTop: `3px solid ${f.color}` }}>
              <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>{f.icon}</div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>{f.title}</h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── AI Pipeline ── */}
      <div className="t-card" style={{ padding: '24px 24px', marginBottom: 24 }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
          AI Pipeline
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
          {[
            { step: '1', label: 'Upload PDF',         color: '#6366f1' },
            { step: '2', label: 'Extract Text',       color: '#3b82f6' },
            { step: '3', label: 'Ollama Topics',      color: '#8b5cf6' },
            { step: '4', label: 'Generate Questions', color: '#f59e0b' },
            { step: '5', label: 'Dependency Map',     color: '#22c55e' },
            { step: '6', label: 'Evaluate Answers',   color: '#ef4444' },
          ].map((s, i, arr) => (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', minWidth: 90 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', margin: '0 auto 6px',
                  background: `${s.color}15`, border: `2px solid ${s.color}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.85rem', fontWeight: 800, color: s.color,
                }}>{s.step}</div>
                <p style={{ fontSize: '0.72rem', fontWeight: 600, color: '#374151', lineHeight: 1.3 }}>{s.label}</p>
              </div>
              {i < arr.length - 1 && (
                <div style={{ width: 28, height: 1, background: '#e2e8f0', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Tech stack ── */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          Tech Stack
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 10 }}>
          {techStack.map(t => (
            <div key={t.name} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 14px', borderRadius: 10,
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
              <div>
                <p style={{ fontSize: '0.83rem', fontWeight: 700, color: '#0f172a' }}>{t.name}</p>
                <p style={{ fontSize: '0.72rem', color: '#9ca3af' }}>{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Data & Privacy ── */}
      <div className="t-card" style={{ padding: '22px 24px', marginBottom: 28, background: 'rgba(99,102,241,0.03)', border: '1.5px solid rgba(99,102,241,0.12)' }}>
        <h2 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
          Data & Privacy
        </h2>
        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            'All AI processing is done locally using Ollama — no data is sent to external AI services.',
            'Your syllabuses and progress are stored in a local MongoDB instance on your machine.',
            'Authentication is handled by Firebase (email/password only).',
            'You can delete any session from the My Syllabuses page at any time.',
          ].map(item => (
            <li key={item} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ color: '#22c55e', fontWeight: 700, flexShrink: 0, marginTop: 1 }}>✓</span>
              <span style={{ fontSize: '0.83rem', color: '#374151', lineHeight: 1.5 }}>{item}</span>
            </li>
          ))}
        </ul>
      </div>


    </div>
  )
}
