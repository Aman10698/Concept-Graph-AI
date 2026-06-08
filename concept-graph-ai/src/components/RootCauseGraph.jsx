/**
 * RootCauseGraph.jsx
 *
 * React Flow DAG with Dagre auto-layout.
 *
 * Node types:  root | category | concept
 * Edge types:  hierarchy (solid) | prerequisite (dashed)
 * Layout:      Dagre TB (Top → Bottom), auto-positioned — NO manual coordinates
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  ReactFlowProvider,
  Handle,
  Position,
} from '@xyflow/react'
import Dagre from '@dagrejs/dagre'
import '@xyflow/react/dist/style.css'

/* ─── Status palette ──────────────────────────────────────────────── */
const PAL = {
  strong:      { bg: '#f0fdf4', border: '#86efac', dot: '#22c55e', text: '#15803d', chip: '#dcfce7', label: 'Strong'        },
  partial:     { bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b', text: '#92400e', chip: '#fef3c7', label: 'Partial'       },
  moderate:    { bg: '#fffbeb', border: '#fcd34d', dot: '#f59e0b', text: '#92400e', chip: '#fef3c7', label: 'Partial'       },
  weak:        { bg: '#fff1f2', border: '#fca5a5', dot: '#ef4444', text: '#991b1b', chip: '#fee2e2', label: 'Weak'          },
  not_started: { bg: '#f8fafc', border: '#cbd5e1', dot: '#94a3b8', text: '#6b7280', chip: '#f1f5f9', label: 'Not Attempted' },
}
const getPal = s => PAL[s] || PAL.not_started

/* ─── Node dimensions (used by Dagre) ──────────────────────────────── */
const DIMS = {
  root:      { w: 240, h: 70  },
  category:  { w: 210, h: 105 },
  concept:   { w: 195, h: 120 },
  subreason: { w: 175, h: 68  },
}
const getDim = t => DIMS[t] || DIMS.concept

/* ═══════════════════════════════════════════════════════════════════
   Custom Node Components
═══════════════════════════════════════════════════════════════════ */

function RootNode({ data }) {
  return (
    <>
      {/* target handle lets prerequisite edges point to root without React Flow warnings */}
      <Handle type="target" position={Position.Top}    style={{ background: '#a78bfa', opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ background: '#a78bfa' }} />
      <div style={{
        width: DIMS.root.w, padding: '14px 18px',
        borderRadius: 20,
        background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
        border: '2.5px solid #a78bfa',
        boxShadow: '0 8px 28px rgba(99,102,241,0.38)',
        textAlign: 'center', color: '#fff',
      }}>
        <p style={{ fontSize: '1rem', fontWeight: 800, lineHeight: 1.3, marginBottom: 3 }}>{data.label}</p>
        <p style={{ fontSize: '0.68rem', opacity: 0.78 }}>Root Concept</p>
      </div>
    </>
  )
}

function CategoryNode({ data }) {
  const s = getPal(data.status)
  return (
    <>
      <Handle type="target" position={Position.Top}    style={{ background: s.border }} />
      <Handle type="source" position={Position.Bottom} style={{ background: s.border }} />
      <div style={{
        width: DIMS.category.w, padding: '11px 14px',
        borderRadius: 16,
        background: s.bg,
        border: `2px solid ${s.border}`,
        boxShadow: '0 3px 14px rgba(0,0,0,0.09)',
      }}>
        {/* Header bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: s.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Category
          </span>
          {data.score !== null && data.score !== undefined && (
            <span style={{ fontSize: '0.66rem', fontWeight: 800, background: s.chip, color: s.text, borderRadius: 6, padding: '1px 7px' }}>
              {data.score}%
            </span>
          )}
        </div>
        <p style={{ fontWeight: 800, fontSize: '0.84rem', color: s.text, lineHeight: 1.3, marginBottom: 6, wordBreak: 'break-word' }}>
          {data.label}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.dot }} />
          <span style={{ fontSize: '0.67rem', fontWeight: 600, color: s.text }}>{s.label}</span>
        </div>
      </div>
    </>
  )
}

function ConceptNode({ data, onClick }) {
  const s = getPal(data.status)
  return (
    <>
      <Handle type="target" position={Position.Top}    style={{ background: s.border }} />
      <Handle type="source" position={Position.Bottom} style={{ background: s.border }} />
      <div
        onClick={() => data.onPractice?.(data.label)}
        style={{
          width: DIMS.concept.w, padding: '10px 12px',
          borderRadius: 14,
          background: s.bg,
          border: `1.5px solid ${s.border}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
          cursor: 'pointer',
          transition: 'transform 0.15s, box-shadow 0.18s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.13)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)' }}
      >
        {/* Name + score */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 5 }}>
          <p style={{ fontWeight: 700, fontSize: '0.78rem', color: s.text, lineHeight: 1.3, flex: 1, wordBreak: 'break-word' }}>
            {data.label}
          </p>
          {data.score !== null && data.score !== undefined && (
            <span style={{ fontSize: '0.65rem', fontWeight: 800, background: s.chip, color: s.text, borderRadius: 6, padding: '1px 6px', flexShrink: 0 }}>
              {data.score}%
            </span>
          )}
        </div>
        {/* Status dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: data.description ? 5 : 0 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
          <span style={{ fontSize: '0.63rem', fontWeight: 600, color: s.text }}>{s.label}</span>
        </div>
        {/* Description */}
        {data.description && (
          <p style={{
            fontSize: '0.62rem', color: '#6b7280', lineHeight: 1.35,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', wordBreak: 'break-word',
          }}>
            {data.description}
          </p>
        )}
        {/* Click hint */}
        <p style={{ fontSize: '0.58rem', color: s.dot, fontWeight: 600, marginTop: 5, textAlign: 'right' }}>
          Click to practice →
        </p>
      </div>
    </>
  )
}

/* ─── SubReasonNode: explains WHY a weak node is weak ───────────── */
function SubReasonNode({ data }) {
  const isWeak = data.status === 'weak'
  const color  = isWeak ? '#ef4444' : '#f59e0b'
  const bg     = isWeak ? '#fff1f2' : '#fffbeb'
  const chip   = isWeak ? '#fee2e2' : '#fef3c7'
  return (
    <>
      <Handle type="target" position={Position.Top} style={{ background: color, opacity: 0.6 }} />
      <div
        onClick={() => data.onPractice?.(data.parentLabel || data.label)}
        style={{
          width: DIMS.subreason.w,
          padding: '8px 12px',
          borderRadius: 10,
          background: bg,
          border: `1.5px dashed ${color}`,
          boxShadow: `0 2px 10px ${color}22`,
          cursor: 'pointer',
          transition: 'transform 0.15s, box-shadow 0.18s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 6px 18px ${color}44` }}
        onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = `0 2px 10px ${color}22` }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
          <span style={{
            fontSize: '0.58rem', fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.07em', color, background: chip,
            padding: '1px 6px', borderRadius: 4,
          }}>Gap</span>
        </div>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color, lineHeight: 1.3, wordBreak: 'break-word' }}>
          {data.label}
        </p>
        <p style={{ fontSize: '0.6rem', color: '#9ca3af', marginTop: 3 }}>Click parent to practice →</p>
      </div>
    </>
  )
}

const NODE_TYPES = {
  root:      RootNode,
  category:  CategoryNode,
  concept:   ConceptNode,
  subreason: SubReasonNode,
}

/* ═══════════════════════════════════════════════════════════════════
   Dagre auto-layout
═══════════════════════════════════════════════════════════════════ */
function applyDagreLayout(rawNodes, rawEdges) {
  const g = new Dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir:  'TB',   // Top → Bottom
    nodesep:  55,     // horizontal gap between siblings
    ranksep:  90,     // vertical gap between ranks
    marginx:  48,
    marginy:  40,
  })

  rawNodes.forEach(n => {
    const dim = getDim(n.data.nodeType)
    g.setNode(n.id, { width: dim.w, height: dim.h })
  })
  rawEdges.forEach(e => g.setEdge(e.source, e.target))

  Dagre.layout(g)

  return rawNodes.map(n => {
    const { x, y } = g.node(n.id)
    const dim = getDim(n.data.nodeType)
    return { ...n, position: { x: x - dim.w / 2, y: y - dim.h / 2 } }
  })
}

/* ═══════════════════════════════════════════════════════════════════
   Convert Ollama output → React Flow nodes + edges
   topicsData: the topics array from the uploaded document (for sub-reason expansion)
═══════════════════════════════════════════════════════════════════ */
function buildFlowElements(apiNodes, apiEdges, onPractice, topicsData = []) {
  if (!apiNodes?.length) return { nodes: [], edges: [] }

  // Build a fast lookup: normalized topic name → subtopics array
  const subLookup = new Map()
  for (const t of topicsData) {
    const name = (typeof t === 'string' ? t : t.name || '').toLowerCase().trim()
    const subs = Array.isArray(t.subtopics)
      ? t.subtopics.map(s => (typeof s === 'string' ? s : s?.name || '')).filter(Boolean)
      : []
    if (name && subs.length) subLookup.set(name, subs)
  }

  const rawNodes = apiNodes.map(n => ({
    id:   String(n.id),
    type: n.type === 'root' ? 'root' : n.type === 'category' ? 'category' : 'concept',
    position: { x: 0, y: 0 },   // Dagre will override these
    data: {
      label:       n.name,
      nodeType:    n.type,
      status:      n.status || 'not_started',
      score:       n.score  ?? null,
      description: n.description || null,
      onPractice,
    },
  }))

  const rawEdges = (apiEdges || []).map((e, i) => {
    const isPrereq = e.type === 'prerequisite'
    return {
      id:        `e-${i}`,
      source:    String(e.source),
      target:    String(e.target),
      type:      'smoothstep',
      animated:  isPrereq,
      markerEnd: {
        type:  MarkerType.ArrowClosed,
        color: isPrereq ? '#a78bfa' : '#94a3b8',
        width: 14, height: 14,
      },
      style: {
        stroke:          isPrereq ? '#a78bfa' : '#94a3b8',
        strokeWidth:     1.8,
        strokeDasharray: isPrereq ? '6 4' : undefined,
      },
      ...(isPrereq ? {
        label:        'prereq',
        labelStyle:   { fontSize: 9, fill: '#7c3aed' },
        labelBgStyle: { fill: 'rgba(255,255,255,0.9)', borderRadius: 3 },
      } : {}),
    }
  })

  // ── Inject sub-reason nodes under every weak/partial node ──────────
  // For each concept/category node that is weak or partial, look up its
  // subtopics in topicsData and append them as child 'subreason' nodes.
  const extraNodes = []
  const extraEdges = []
  let srIdx = 0

  for (const n of apiNodes) {
    const isWeak = n.status === 'weak' || n.status === 'partial'
    if (!isWeak || n.type === 'root') continue

    // Try exact then partial match in subLookup
    const key   = (n.name || '').toLowerCase().trim()
    let subtopics = subLookup.get(key)
    if (!subtopics) {
      for (const [k, v] of subLookup) {
        if (k.includes(key) || key.includes(k)) { subtopics = v; break }
      }
    }
    if (!subtopics?.length) continue

    // Limit to 4 sub-reason nodes per weak parent
    subtopics.slice(0, 4).forEach(sub => {
      const srId = `sr-${srIdx++}`
      extraNodes.push({
        id:   srId,
        type: 'subreason',
        position: { x: 0, y: 0 },
        data: {
          label:       sub,
          nodeType:    'subreason',
          status:      n.status,   // inherit parent's weakness
          parentLabel: n.name,
          onPractice,
        },
      })
      extraEdges.push({
        id:     `sr-e-${srId}`,
        source: String(n.id),
        target: srId,
        type:   'smoothstep',
        animated: false,
        markerEnd: {
          type:  MarkerType.ArrowClosed,
          color: n.status === 'weak' ? '#ef4444' : '#f59e0b',
          width: 12, height: 12,
        },
        style: {
          stroke:          n.status === 'weak' ? '#ef4444' : '#f59e0b',
          strokeWidth:     1.4,
          strokeDasharray: '5 4',
          opacity: 0.75,
        },
        label:        'gap',
        labelStyle:   { fontSize: 8, fill: n.status === 'weak' ? '#ef4444' : '#f59e0b' },
        labelBgStyle: { fill: 'rgba(255,255,255,0.9)', borderRadius: 3 },
      })
    })
  }

  const allNodes = [...rawNodes, ...extraNodes]
  const allEdges = [...rawEdges, ...extraEdges]

  const layoutedNodes = applyDagreLayout(allNodes, allEdges)
  return { nodes: layoutedNodes, edges: allEdges }
}

/* ─── Fallback when Ollama hasn't responded ───────────────────────── */
function buildFallback(topics, subject) {
  const names = topics.map(t => (typeof t === 'string' ? t : t.name)).slice(0, 9)
  const nodes = [
    { id: 'root', name: subject || 'Course', type: 'root', status: 'not_started', score: null, description: 'Main topic.' },
  ]
  const edges = []
  const perCat = Math.ceil(names.length / 3)
  const cats   = Math.min(3, Math.ceil(names.length / perCat))

  for (let c = 0; c < cats; c++) {
    const catId = `cat-${c}`
    nodes.push({ id: catId, name: `Topic Group ${c + 1}`, type: 'category', status: 'not_started', score: null, description: null })
    edges.push({ source: 'root', target: catId, type: 'hierarchy' })
    const slice = names.slice(c * perCat, (c + 1) * perCat)
    slice.forEach((nm, i) => {
      const cid = `concept-${c}-${i}`
      nodes.push({ id: cid, name: nm, type: 'concept', status: 'not_started', score: null, description: `Complete a quiz on "${nm}".` })
      edges.push({ source: catId, target: cid, type: 'hierarchy' })
    })
  }
  return { nodes, edges, recommendedPath: [] }
}

function getWeakTopics(topicNames, evalData) {
  return topicNames
    .filter(n => ['weak', 'partial', 'moderate'].includes(evalData?.[n]?.rating))
    .sort((a, b) => (evalData[a]?.confidence ?? 100) - (evalData[b]?.confidence ?? 100))
}

/* ─── Learning Path Panel ─────────────────────────────────────────── */
function LearningPathPanel({ path }) {
  if (!path?.length) return null

  // Accept both string[] and {topic, score, status}[]
  const items = path
    .map(p => (typeof p === 'string' ? { topic: p, score: null, status: 'not_started' } : p))
    .filter(p => p?.topic)
    .slice(0, 8)

  return (
    <div style={{ padding: '18px 24px 22px', borderTop: '1px solid #f1f5f9' }}>
      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 14 }}>
        📍 Recommended Learning Path
      </p>
      <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', paddingBottom: 4, gap: 0 }}>
        {items.map((item, idx) => {
          const s      = getPal(item.status)
          const isLast = idx === items.length - 1
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 12, padding: '9px 14px', minWidth: 130, maxWidth: 170 }}>
                <p style={{ fontSize: '0.76rem', fontWeight: 700, color: s.text, marginBottom: 3, wordBreak: 'break-word', lineHeight: 1.3 }}>
                  {item.topic}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot }} />
                  <span style={{ fontSize: '0.64rem', fontWeight: 600, color: s.text }}>{s.label}</span>
                  {item.score != null && (
                    <span style={{ marginLeft: 'auto', fontSize: '0.64rem', fontWeight: 700, background: s.chip, color: s.text, borderRadius: 5, padding: '1px 5px' }}>
                      {item.score}%
                    </span>
                  )}
                </div>
              </div>
              {!isLast && <span style={{ padding: '0 5px', color: '#94a3b8', fontSize: '1.1rem', fontWeight: 700 }}>→</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Inner Flow — must be inside ReactFlowProvider
═══════════════════════════════════════════════════════════════════ */
function FlowInner({ apiData, topics, focusTopic, courseTitle, onPractice, topicsData }) {
  const graphData = apiData || buildFallback(topics, focusTopic || courseTitle || (topics[0]?.name || 'Course'))

  const { nodes, edges } = useMemo(
    () => buildFlowElements(graphData.nodes, graphData.edges, onPractice, topicsData),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(graphData.nodes), JSON.stringify(graphData.edges), JSON.stringify(topicsData)]
  )

  const miniMapColor = n => getPal(n.data?.status).dot

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={NODE_TYPES}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.08}
      maxZoom={2.5}
      proOptions={{ hideAttribution: true }}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable={false}
    >
      <Background color="#dde3ef" gap={22} size={1} />
      <Controls showInteractive={false} />
      <MiniMap
        nodeColor={miniMapColor}
        maskColor="rgba(238,242,255,0.55)"
        style={{ borderRadius: 10, border: '1px solid #e2e8f0' }}
        zoomable pannable
      />
    </ReactFlow>
  )
}

/* ═══════════════════════════════════════════════════════════════════
   Main exported component
═══════════════════════════════════════════════════════════════════ */
export default function RootCauseGraph({ topics, evalData = {}, dependencyData, onClose, onPractice, courseTitle }) {
  const topicNames = topics.map(t => (typeof t === 'string' ? t : t.name))
  const weakTopics = getWeakTopics(topicNames, evalData)

  const [focusTopic, setFocusTopic] = useState(weakTopics[0] || null)
  const [apiData,    setApiData]    = useState(null)
  const [loading,    setLoading]    = useState(false)

  const fetchGraph = useCallback((subject) => {
    if (!subject) return
    setApiData(null)
    setLoading(true)
    fetch('http://localhost:5000/api/analyze-dependencies', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topics:        topicNames.length > 1 ? topicNames : [subject],
        focusTopic:    subject,
        subject:       courseTitle || subject,
        extractedText: '',
      }),
    })
      .then(r => r.json())
      .then(j => {
        if (j.success) {
          // Support both new { nodes, edges } and legacy { treeNodes } shapes
          const d = j.data
          if (d?.nodes?.length) {
            setApiData(d)
          } else if (d?.treeNodes?.length) {
            // Convert legacy treeNodes → new format on-the-fly
            setApiData(convertLegacy(d, subject))
          }
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicNames.join(','), courseTitle])

  useEffect(() => {
    if (focusTopic) fetchGraph(focusTopic)
    else if (dependencyData) setApiData(dependencyData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTopic])

  useEffect(() => {
    const nw = getWeakTopics(topicNames, evalData)
    if (nw.length > 0 && !focusTopic) setFocusTopic(nw[0])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalData])

  const title = focusTopic || courseTitle || topicNames[0] || 'Course'

  return (
    <div style={{ border: '1.5px solid #e2e8f0', borderRadius: 18, background: '#fff', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '18px 24px 14px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>
            Dependency Graph — {title}
          </h3>
          <p style={{ fontSize: '0.76rem', color: '#6b7280' }}>
            {weakTopics.length > 0
              ? 'Prerequisite map for your weakest topics. Click any concept to practice.'
              : `Prerequisite map for ${title}. Click any concept to practice.`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          {[['#22c55e','Strong'],['#f59e0b','Partial'],['#ef4444','Weak'],['#94a3b8','Not Attempted']].map(([c,l]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
              <span style={{ fontSize: '0.74rem', color: '#374151', fontWeight: 600 }}>{l}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <svg width="28" height="10"><line x1="0" y1="5" x2="28" y2="5" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5,4"/></svg>
            <span style={{ fontSize: '0.74rem', color: '#374151', fontWeight: 600 }}>Prerequisite</span>
          </div>
          {onClose && <button onClick={onClose} style={{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:'1.1rem', padding:'2px 6px' }}>✕</button>}
        </div>
      </div>

      {/* ── Topic tabs ── */}
      {weakTopics.length > 0 && (
        <div style={{ padding: '12px 20px 0', borderBottom: '1px solid #f1f5f9' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            Weak topics — select to analyse:
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingBottom: 12 }}>
            {weakTopics.map(t => {
              const r = evalData?.[t]?.rating, conf = evalData?.[t]?.confidence ?? 0
              const color = r === 'weak' ? '#ef4444' : '#f59e0b'
              return (
                <button key={t} onClick={() => setFocusTopic(t)} style={{
                  padding: '6px 14px', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700,
                  background: focusTopic === t ? color : '#f8fafc',
                  color: focusTopic === t ? '#fff' : color,
                  border: `1.5px solid ${color}`, cursor: 'pointer', transition: 'all 0.15s',
                }}>
                  {t} — {conf}% confidence
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Notices ── */}
      {weakTopics.length === 0 && Object.keys(evalData).length === 0 && (
        <div style={{ margin: '12px 20px', padding: '12px 16px', borderRadius: 10, background: '#fffbeb', border: '1.5px solid #fcd34d' }}>
          <p style={{ fontSize: '0.82rem', color: '#92400e', fontWeight: 600 }}>
            💡 Complete some quizzes first — the graph will automatically highlight weak topics.
          </p>
        </div>
      )}
      {weakTopics.length === 0 && Object.keys(evalData).length > 0 && (
        <div style={{ margin: '12px 20px', padding: '12px 16px', borderRadius: 10, background: '#f0fdf4', border: '1.5px solid #86efac' }}>
          <p style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 600 }}>
            🎉 All topics strong! Showing full course dependency graph.
          </p>
        </div>
      )}

      {/* ── React Flow canvas ── */}
      <div style={{ height: 560, background: 'linear-gradient(135deg,#f8faff,#eef2ff)', position: 'relative' }}>
        {loading ? (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div className="t-spinner" />
            <p style={{ fontWeight: 700, color: '#0f172a' }}>Building dependency graph for "{focusTopic}"…</p>
            <p style={{ fontSize: '0.78rem', color: '#6b7280' }}>Ollama is mapping prerequisites (~30 s)</p>
          </div>
        ) : (
          <ReactFlowProvider key={focusTopic || 'default'}>
            <FlowInner
              apiData={apiData}
              topics={topics}
              focusTopic={focusTopic}
              courseTitle={courseTitle}
              onPractice={onPractice}
              topicsData={topics}
            />
          </ReactFlowProvider>
        )}
      </div>

      {/* ── Learning Path ── */}
      {!loading && <LearningPathPanel path={apiData?.recommendedPath} />}

      {/* ── Hint ── */}
      {!loading && (
        <div style={{ padding: '6px 20px 14px', fontSize: '0.72rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>🖱️</span>
          Scroll to zoom · Drag to pan · Drag nodes to rearrange · Click a concept node to practice
        </div>
      )}
    </div>
  )
}

/* ─── Backwards-compat converter: treeNodes → {nodes, edges} ─────── */
function convertLegacy(d, subject) {
  const nodeMap = {}
  const nodes   = (d.treeNodes || []).map(n => {
    nodeMap[n.id] = n
    return {
      id: String(n.id), name: n.name,
      type: n.level === 0 ? 'root' : n.level === 1 ? 'category' : 'concept',
      status: n.status || 'not_started', score: n.score ?? null,
      description: n.description || null,
    }
  })
  const edges = (d.treeNodes || [])
    .filter(n => n.parentId)
    .map(n => ({ source: String(n.parentId), target: String(n.id), type: 'hierarchy' }))
  const prereqEdges = (d.prerequisiteEdges || []).map(e => ({ ...e, type: 'prerequisite' }))
  return { nodes, edges: [...edges, ...prereqEdges], recommendedPath: d.recommendedPath || [] }
}
