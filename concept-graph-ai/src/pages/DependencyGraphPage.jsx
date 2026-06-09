import { useEffect, useState, useCallback } from 'react'
import DependencyViewer from '../components/DependencyViewer'
import { Link } from 'react-router-dom'
import { onEvalChange, offEvalChange } from '../utils/evalBus'

export default function DependencyGraphPage() {
  const [dependencyData, setDependencyData] = useState(null)
  const [topicsData, setTopicsData] = useState(null)
  const [evalData, setEvalData] = useState({})

  const readStorage = useCallback(() => {
    try {
      const deps   = localStorage.getItem('learningDependencyData')
      const topics = localStorage.getItem('learningTopicsData')
      const evals  = localStorage.getItem('learningEvaluationData')
      if (deps)   setDependencyData(JSON.parse(deps))
      if (topics) setTopicsData(JSON.parse(topics))
      if (evals)  setEvalData(JSON.parse(evals))
    } catch (e) {
      console.error('Failed to load dependency data:', e)
    }
  }, [])

  useEffect(() => {
    readStorage()
    // Re-read whenever any quiz completes (same-tab or cross-tab)
    onEvalChange(readStorage)
    return () => offEvalChange(readStorage)
  }, [readStorage])

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.03em', marginBottom: 4 }}>
          Dependency Graph
        </h1>
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          Visualise how your topics relate — coloured by your knowledge level
        </p>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  label: 'Strong — know it well'       },
          { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'Partial — some knowledge'    },
          { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'Weak — needs study'          },
          { color: '#9ca3af', bg: 'rgba(156,163,175,0.1)',label: 'Untested'                    },
        ].map(l => (
          <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
            <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>{l.label}</span>
          </div>
        ))}
      </div>

      {dependencyData ? (
        <div className="t-card">
          <DependencyViewer
            dependencyData={dependencyData}
            evalData={evalData}
            isLoading={false}
            error={null}
          />
        </div>
      ) : (
        /* Empty state */
        <div className="t-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 20px',
            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2rem',
          }}>
            🔗
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0f172a', marginBottom: 10 }}>
            No Dependency Data Yet
          </h2>
          <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: 28, maxWidth: 400, margin: '0 auto 28px' }}>
            Upload a syllabus first to generate topic dependencies. The graph will appear here automatically after analysis.
          </p>
          <Link
            to="/syllabuses"
            id="dep-graph-upload-link"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 10,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff', fontWeight: 700, fontSize: '0.9rem',
              textDecoration: 'none', boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
              transition: 'opacity .18s',
            }}
          >
            📄 Upload Syllabus
          </Link>
        </div>
      )}
    </div>
  )
}
