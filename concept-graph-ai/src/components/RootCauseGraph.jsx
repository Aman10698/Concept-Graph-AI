import { useState, useEffect, useCallback } from 'react'

const BOX_W = 160, BOX_H = 80, ROW_H = 160, COL_GAP = 24, PAD_X = 40, PAD_Y = 24

const RATING = {
  strong:   { bg: '#f0fdf4', border: '#86efac', dot: '#22c55e', text: '#15803d', label: 'Strong' },
  partial:  { bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b', text: '#92400e', label: 'Partial' },
  moderate: { bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b', text: '#92400e', label: 'Partial' },
  weak:     { bg: '#fff1f2', border: '#fca5a5', dot: '#ef4444', text: '#991b1b', label: 'Weak' },
  none:     { bg: '#f8fafc', border: '#e2e8f0', dot: '#94a3b8', text: '#6b7280', label: 'Not Attempted' },
}

function styleFor(name, evalData, isRoot) {
  if (isRoot) return { bg: '#ede9fe', border: '#c4b5fd', dot: '#7c3aed', text: '#5b21b6', label: '' }
  return RATING[evalData?.[name]?.rating] ?? RATING.none
}

function buildLayout(nodes) {
  const byLevel = {}
  nodes.forEach(n => { if (!byLevel[n.level]) byLevel[n.level] = []; byLevel[n.level].push(n) })
  const levels = Object.keys(byLevel).map(Number).sort((a, b) => a - b)
  const l1 = byLevel[1] || []
  const numCols = Math.max(l1.length, 1)
  const innerW = numCols * BOX_W + (numCols - 1) * COL_GAP
  const totalW = innerW + 2 * PAD_X
  const positions = {}

  const root = byLevel[0]?.[0]
  if (root) positions[root.id] = { x: PAD_X + innerW / 2 - BOX_W / 2, y: PAD_Y }
  l1.forEach((n, i) => { positions[n.id] = { x: PAD_X + i * (BOX_W + COL_GAP), y: PAD_Y + ROW_H } })

  levels.filter(l => l >= 2).forEach(l => {
    ;(byLevel[l] || []).forEach(n => {
      const parent = nodes.find(p => p.id === n.parentId)
      const pp = parent ? positions[parent.id] : null
      const siblings = (byLevel[l] || []).filter(s => s.parentId === n.parentId)
      const idx = siblings.indexOf(n)
      const sibW = siblings.length * BOX_W + (siblings.length - 1) * COL_GAP
      const startX = pp ? pp.x + BOX_W / 2 - sibW / 2 : PAD_X + idx * (BOX_W + COL_GAP)
      positions[n.id] = { x: startX + idx * (BOX_W + COL_GAP), y: PAD_Y + l * ROW_H }
    })
  })

  return { positions, width: totalW, height: PAD_Y + levels.length * ROW_H + BOX_H + PAD_Y }
}

function buildFallback(topics, subject) {
  const names = topics.map(t => typeof t === 'string' ? t : t.name)
  return [
    { id: 'root', name: subject || 'Course', level: 0, parentId: null },
    ...names.map((n, i) => ({ id: `l1-${i}`, name: n, level: 1, parentId: 'root' })),
  ]
}

/* ── Derive weak/partial topics from evalData, sorted by confidence asc ── */
function getWeakTopics(topicNames, evalData) {
  return topicNames
    .filter(n => evalData?.[n]?.rating === 'weak' || evalData?.[n]?.rating === 'partial' || evalData?.[n]?.rating === 'moderate')
    .sort((a, b) => (evalData[a]?.confidence ?? 100) - (evalData[b]?.confidence ?? 100))
}

export default function RootCauseGraph({ topics, evalData, dependencyData, onClose, onPractice, courseTitle }) {
  const topicNames = topics.map(t => typeof t === 'string' ? t : t.name)

  const weakTopics = getWeakTopics(topicNames, evalData)
  const [focusTopic, setFocusTopic] = useState(weakTopics[0] || null)
  const [treeData,   setTreeData]   = useState(null)
  const [loading,    setLoading]    = useState(false)

  const fetchTree = useCallback((subject) => {
    if (!subject) return
    setTreeData(null)
    setLoading(true)

    // Always pass the topic itself as the only item — backend detects singleMode
    // and generates "what you need to know BEFORE this topic" prerequisites
    fetch('http://localhost:5000/api/analyze-dependencies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topics: [subject], extractedText: '', subject }),
    })
      .then(r => r.json())
      .then(j => { if (j.success) setTreeData(j.data) })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  /* When focusTopic changes → re-fetch */
  useEffect(() => {
    if (focusTopic) {
      fetchTree(focusTopic)
    } else if (dependencyData) {
      // No weak topics: use existing whole-course dependency data
      setTreeData(dependencyData)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTopic])

  /* If new weak topics become available (after quizzes), auto-focus the weakest */
  useEffect(() => {
    const newWeak = getWeakTopics(topicNames, evalData)
    if (newWeak.length > 0 && !focusTopic) {
      setFocusTopic(newWeak[0])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalData])

  const treeNodes = treeData?.treeNodes?.length
    ? treeData.treeNodes
    : buildFallback(topics, focusTopic || courseTitle || topicNames[0])

  const { positions, width, height } = buildLayout(treeNodes)
  const title = focusTopic || courseTitle || topicNames[0] || 'Course'

  const arrows = treeNodes.filter(n => n.parentId && n.level >= 2).map(n => {
    const p = positions[n.id]
    const parent = treeNodes.find(x => x.id === n.parentId)
    const pp = parent ? positions[parent.id] : null
    if (!p || !pp) return null
    return { key: n.id, x1: pp.x + BOX_W / 2, y1: pp.y + BOX_H, x2: p.x + BOX_W / 2, y2: p.y }
  }).filter(Boolean)

  const rootNode = treeNodes.find(n => n.level === 0)
  const l1Nodes  = treeNodes.filter(n => n.level === 1 && n.parentId === rootNode?.id)
  const rp       = rootNode && positions[rootNode.id]
  const l1pos    = l1Nodes.map(n => positions[n.id]).filter(Boolean)
  const junctionY = rp ? rp.y + BOX_H + (ROW_H - BOX_H) * 0.45 : 0
  const rootCX    = rp ? rp.x + BOX_W / 2 : 0

  return (
    <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 18, background: '#fff', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 24px 14px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>
            Dependency Graph – {title}
          </h3>
          <p style={{ fontSize: '0.76rem', color: '#6b7280' }}>
            {weakTopics.length > 0
              ? 'Showing prerequisite concepts for topics where you scored weak or partial.'
              : `Shows prerequisite concepts required to understand ${title}.`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          {[['#22c55e','Strong'],['#f59e0b','Partial'],['#ef4444','Weak'],['#94a3b8','Not Attempted']].map(([c,l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: c }} />
              <span style={{ fontSize: '0.76rem', color: '#374151', fontWeight: 600 }}>{l}</span>
            </div>
          ))}
          {onClose && <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '1.1rem', padding: '2px 6px' }}>✕</button>}
        </div>
      </div>

      {/* ── Weak topic tabs (driven by quiz results) ── */}
      {weakTopics.length > 0 && (
        <div style={{ padding: '12px 20px 0', borderBottom: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Topics needing attention (based on your quiz results) — select to analyse:
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 12 }}>
            {weakTopics.map(t => {
              const r     = evalData?.[t]?.rating
              const conf  = evalData?.[t]?.confidence ?? 0
              const color = r === 'weak' ? '#ef4444' : '#f59e0b'
              const isActive = focusTopic === t
              return (
                <button
                  key={t}
                  onClick={() => setFocusTopic(t)}
                  style={{
                    padding: '6px 14px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700,
                    background: isActive ? color : '#f8fafc',
                    color: isActive ? '#fff' : color,
                    border: `1.5px solid ${color}`,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {t} — {conf}% confidence
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── No quiz data notice ── */}
      {weakTopics.length === 0 && Object.keys(evalData).length === 0 && (
        <div style={{ margin: '12px 20px', padding: '12px 16px', borderRadius: 10, background: '#fffbeb', border: '1.5px solid #fcd34d' }}>
          <p style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>
            💡 Complete some quizzes first — the dependency graph will automatically highlight topics that need attention based on your performance.
          </p>
        </div>
      )}

      {/* ── All strong notice ── */}
      {weakTopics.length === 0 && Object.keys(evalData).length > 0 && (
        <div style={{ margin: '12px 20px', padding: '12px 16px', borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
          <p style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 600 }}>
            🎉 Great job! All your quiz topics are strong. Showing full course dependency graph below.
          </p>
        </div>
      )}

      {/* ── Graph area ── */}
      <div style={{ padding: '24px 16px 16px', overflowX: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <div className="t-spinner" style={{ margin: '0 auto 14px' }} />
            <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>Analysing prerequisites for "{focusTopic}"…</p>
            <p style={{ fontSize: '0.78rem', color: '#6b7280' }}>Ollama is mapping what you need to learn to improve this topic (~30 s)</p>
          </div>
        ) : (
          <div style={{ position: 'relative', width: Math.max(width, 400), height, margin: '0 auto' }}>

            {/* SVG arrows */}
            <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'none', zIndex: 0 }}>
              <defs>
                <marker id="dep-arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <polygon points="0 0,8 3,0 6" fill="#9ca3af" />
                </marker>
              </defs>
              {rp && l1pos.length > 0 && <>
                <line x1={rootCX} y1={rp.y + BOX_H} x2={rootCX} y2={junctionY} stroke="#9ca3af" strokeWidth="1.5" />
                {l1pos.length > 1 && <line x1={l1pos[0].x + BOX_W / 2} y1={junctionY} x2={l1pos[l1pos.length - 1].x + BOX_W / 2} y2={junctionY} stroke="#9ca3af" strokeWidth="1.5" />}
                {l1pos.map((p, i) => <line key={i} x1={p.x + BOX_W / 2} y1={junctionY} x2={p.x + BOX_W / 2} y2={p.y} stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#dep-arr)" />)}
              </>}
              {arrows.map(a => <line key={a.key} x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2} stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#dep-arr)" />)}
            </svg>

            {/* Boxes */}
            {treeNodes.map(node => {
              const pos = positions[node.id]; if (!pos) return null
              const isRoot = node.level === 0
              const s = styleFor(node.name, evalData, isRoot)
              return (
                <div key={node.id}
                  onClick={() => !isRoot && onPractice?.(node.name)}
                  style={{ position: 'absolute', left: pos.x, top: pos.y, width: BOX_W, height: BOX_H, background: s.bg, border: `2px solid ${s.border}`, borderRadius: 14, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '8px 10px', cursor: isRoot ? 'default' : 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', transition: 'transform 0.15s,box-shadow 0.15s', zIndex: 1, boxSizing: 'border-box' }}
                  onMouseEnter={e => { if (!isRoot) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)' } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)' }}
                >
                  <p style={{ fontWeight: isRoot ? 800 : 700, fontSize: isRoot ? '0.95rem' : '0.82rem', color: s.text, lineHeight: 1.3, marginBottom: s.label ? 5 : 0, wordBreak: 'break-word' }}>{node.name}</p>
                  {s.label && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.dot }} />
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, color: s.text }}>{s.label}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Hint ── */}
      {!loading && (
        <div style={{ padding: '2px 20px 14px', fontSize: '0.72rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="20" height="14" viewBox="0 0 20 14"><line x1="10" y1="0" x2="10" y2="8" stroke="#cbd5e1" strokeWidth="1.5" /><polygon points="6,7 10,14 14,7" fill="#cbd5e1" /></svg>
          Arrows flow top → bottom (concept → prerequisite) · Click any prerequisite node to practice it
        </div>
      )}
    </div>
  )
}
