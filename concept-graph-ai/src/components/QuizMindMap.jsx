import { useRef, useEffect, useState, useCallback, useMemo } from 'react'

/* ─── Layout constants ───────────────────────────────────── */
const ROOT_H_MIN = 52
const ROOT_H_2L  = 70
const ROOT_FONT  = 'bold 14px Inter,sans-serif'
const ROOT_PAD_X = 24
const TOPIC_W  = 170, TOPIC_H  = 90
const SUB_W    = 152, SUB_H    = 64
const H_GAP1   = 72    // root → module row
const H_GAP2   = 48    // module → first topic
const V_GAP    = 12    // between sibling topics
const COL_GAP  = 28    // horizontal gap between module columns
const PAD      = 56
const MIN_SCALE = 0.05, MAX_SCALE = 4

/* ─── Measure root node size ─────────────────────────────── */
let _measureCtx = null
const measureRootNode = (title) => {
  if (!_measureCtx) {
    const c = document.createElement('canvas')
    _measureCtx = c.getContext('2d')
  }
  _measureCtx.font = ROOT_FONT
  const words  = (title || 'Course').split(' ')
  const maxW   = 320, minW = 180
  const singleW = _measureCtx.measureText(title).width + ROOT_PAD_X * 2
  if (singleW <= maxW) return { w: Math.max(minW, Math.ceil(singleW)), h: ROOT_H_MIN }
  let bestW = maxW
  for (let i = 1; i < words.length; i++) {
    const w = Math.max(
      _measureCtx.measureText(words.slice(0, i).join(' ')).width,
      _measureCtx.measureText(words.slice(i).join(' ')).width
    ) + ROOT_PAD_X * 2
    if (w < bestW) bestW = w
  }
  return { w: Math.max(minW, Math.ceil(bestW)), h: ROOT_H_2L }
}

/* ─── Rating helpers ─────────────────────────────────────── */
const ratingColor = r =>
  r === 'strong'  ? '#22c55e'
  : r === 'partial' || r === 'moderate' ? '#f59e0b'
  : r === 'weak'  ? '#ef4444'
  : '#6366f1'

const ratingLabel = r =>
  r === 'strong'  ? 'Strong'
  : r === 'partial' || r === 'moderate' ? 'Partial'
  : r === 'weak'  ? 'Weak'
  : 'Not Practiced'

const aggregateRating = arr => {
  const v = arr.filter(Boolean)
  if (!v.length) return undefined
  if (v.every(r => r === 'strong')) return 'strong'
  if (v.some(r  => r === 'weak'))   return 'weak'
  return 'partial'
}

/* ─── Normalize topic name ───────────────────────────────── */
const _normName = s =>
  (s || '').replace(/^\s*[\d]+([\.][\d]*)?\.*\s*/, '').toLowerCase().replace(/\s+/g, ' ').trim()

/* ─── Recursively flatten ALL descendants into a name list ── */
function flattenDescendants(subtopics) {
  if (!Array.isArray(subtopics)) return []
  const result = []
  for (const s of subtopics) {
    const name = typeof s === 'string' ? s : (s?.name || '')
    if (!name) continue
    result.push(name)
    if (typeof s === 'object' && Array.isArray(s.subtopics) && s.subtopics.length > 0) {
      result.push(...flattenDescendants(s.subtopics))
    }
  }
  return result
}

/* ─── Build column data from raw topics ──────────────────── */
function buildColumns(rawTopics, evalData) {
  const seen = new Map()
  for (const t of rawTopics) {
    const name = typeof t === 'string' ? t : (t?.name || '')
    const key  = _normName(name)
    if (!key) continue
    const subs = typeof t === 'object' && Array.isArray(t.subtopics) ? t.subtopics : []
    if (seen.has(key)) {
      seen.get(key).descendants.push(...flattenDescendants(subs))
    } else {
      seen.set(key, { name, descendants: flattenDescendants(subs) })
    }
  }

  // Deduplicate descendants globally
  const globalSeen = new Set()
  return Array.from(seen.values()).map(col => {
    const deduped = col.descendants.filter(d => {
      const k = _normName(d)
      if (!k || globalSeen.has(k)) return false
      globalSeen.add(k)
      return true
    })
    const subRatings = deduped.map(d => evalData?.[d]?.rating)
    const allTested  = deduped.length > 0 && subRatings.every(r => r != null)
    const rating     = evalData?.[col.name]?.rating ?? (allTested ? aggregateRating(subRatings) : undefined)
    return { name: col.name, descendants: deduped, rating }
  })
}

/* ─── Build world-space layout ───────────────────────────── */
function buildLayout(topics, evalData, courseTitle) {
  const cols = buildColumns(topics, evalData)
  const { w: ROOT_W, h: ROOT_H } = measureRootNode(courseTitle || '')

  const colW   = Math.max(SUB_W, TOPIC_W) + COL_GAP
  const totalW = cols.length > 0 ? cols.length * colW - COL_GAP + PAD * 2 : ROOT_W + PAD * 2
  const rootX  = totalW / 2 - ROOT_W / 2
  const rootY  = PAD
  const nodes  = []

  nodes.push({ id: '__root__', kind: 'root', x: rootX, y: rootY, w: ROOT_W, h: ROOT_H })

  const topicY = rootY + ROOT_H + H_GAP1
  cols.forEach((col, ci) => {
    const cx = PAD + ci * colW + (colW - COL_GAP) / 2
    nodes.push({
      id: `t${ci}`, kind: 'topic', name: col.name,
      x: cx - TOPIC_W / 2, y: topicY, w: TOPIC_W, h: TOPIC_H,
      rating: col.rating, parent: '__root__',
    })

    // Each topic fans directly from its module node (not chained to sibling)
    const subY0 = topicY + TOPIC_H + H_GAP2
    col.descendants.forEach((dName, si) => {
      nodes.push({
        id: `s${ci}_${si}`, kind: 'subtopic', name: dName,
        x: cx - SUB_W / 2,
        y: subY0 + si * (SUB_H + V_GAP),
        w: SUB_W, h: SUB_H,
        rating: evalData?.[dName]?.rating,
        parent: `t${ci}`,    // ← ALL topics fan from the module, not chained
        topicId: `t${ci}`,
      })
    })
  })

  const maxDesc = cols.length > 0 ? Math.max(...cols.map(c => c.descendants.length), 0) : 0
  const totalH  = topicY + (cols.length > 0 ? TOPIC_H + H_GAP2 + maxDesc * (SUB_H + V_GAP) : 0) + PAD
  return { nodes, totalW, totalH }
}

/* ─── Canvas primitives ──────────────────────────────────── */
function rrect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function wrapText(ctx, text, x, y, maxW, lineH, maxLines = 2) {
  const words = (text || '').split(' ')
  let line = '', lines = []
  for (const word of words) {
    const t = line ? line + ' ' + word : word
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line); line = word
      if (lines.length >= maxLines) { line = ''; break }
    } else { line = t }
  }
  if (line && lines.length < maxLines) lines.push(line)

  lines.forEach((l, i) => {
    let drawn = l
    if (ctx.measureText(drawn).width > maxW) {
      while (drawn.length > 1 && ctx.measureText(drawn + '\u2026').width > maxW)
        drawn = drawn.slice(0, -1)
      drawn += '\u2026'
    }
    ctx.fillText(drawn, x, y + i * lineH)
  })
  return y + lines.length * lineH
}

/* ─── Draw a single connector line (straight, no arrowhead) ─ */
function drawConnector(ctx, x1, y1, x2, y2, col) {
  const my = (y1 + y2) / 2
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.bezierCurveTo(x1, my, x2, my, x2, y2)
  ctx.strokeStyle = col + '88'
  ctx.lineWidth = 1.5
  ctx.stroke()
  // small dot at destination
  ctx.beginPath()
  ctx.arc(x2, y2, 3, 0, Math.PI * 2)
  ctx.fillStyle = col + 'aa'
  ctx.fill()
}

function drawCard(ctx, node, isHov, courseTitle) {
  const { x, y, w, h, kind, name, rating } = node
  const col = ratingColor(rating)
  const R   = 12

  ctx.shadowColor   = isHov ? col + '55' : 'rgba(0,0,0,0.08)'
  ctx.shadowBlur    = isHov ? 18 : 8
  ctx.shadowOffsetY = isHov ? 4  : 3

  if (kind === 'root') {
    const g = ctx.createLinearGradient(x, y, x + w, y + h)
    g.addColorStop(0, '#4f46e5'); g.addColorStop(1, '#7c3aed')
    rrect(ctx, x, y, w, h, R); ctx.fillStyle = g; ctx.fill()
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    rrect(ctx, x, y, w, h, R)
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5; ctx.stroke()

    ctx.fillStyle = '#fff'; ctx.font = ROOT_FONT
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    const title  = courseTitle || 'Course'
    const maxTW  = w - ROOT_PAD_X * 2
    const words  = title.split(' ')
    const lines  = []; let cur = ''
    for (const word of words) {
      const t = cur ? cur + ' ' + word : word
      if (ctx.measureText(t).width > maxTW && cur) { lines.push(cur); cur = word }
      else cur = t
      if (lines.length >= 2) break
    }
    if (cur) lines.push(cur)
    const lineH = 18
    let ty = y + (h - lines.length * lineH) / 2
    for (const l of lines) { ctx.fillText(l, x + w / 2, ty); ty += lineH }

  } else {
    // module (topic) or leaf (subtopic)
    const isModule = kind === 'topic'

    // background
    rrect(ctx, x, y, w, h, R)
    if (isModule) {
      const g2 = ctx.createLinearGradient(x, y, x, y + h)
      g2.addColorStop(0, '#ffffff')
      g2.addColorStop(1, col + '11')
      ctx.fillStyle = g2
    } else {
      ctx.fillStyle = '#fff'
    }
    ctx.fill()
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

    // top colour bar (thicker for modules)
    ctx.save(); rrect(ctx, x, y, w, h, R); ctx.clip()
    ctx.fillStyle = col
    ctx.fillRect(x, y, w, isModule ? 5 : 3)
    ctx.restore()

    // border
    rrect(ctx, x, y, w, h, R)
    ctx.strokeStyle = col + (isHov ? 'cc' : '44')
    ctx.lineWidth = isHov ? 2 : isModule ? 1.8 : 1.4
    ctx.stroke()

    const pad = 10
    let curY  = y + 14
    const fs  = isModule ? 12 : 11
    const lh  = fs + 4

    ctx.save()
    rrect(ctx, x, y, w, h, R)
    ctx.clip()

    ctx.fillStyle = '#1e293b'
    ctx.font = `bold ${fs}px Inter,sans-serif`
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    curY = wrapText(ctx, name, x + pad, curY, w - pad * 2, lh, 2) + 4

    ctx.restore()

    // rating badge
    const label = ratingLabel(rating)
    ctx.font = 'bold 8px Inter,sans-serif'
    const bw = ctx.measureText(label).width + 12, bh = 13, br = 6
    rrect(ctx, x + pad, curY, bw, bh, br)
    ctx.fillStyle = col + '22'; ctx.fill()
    ctx.strokeStyle = col + '55'; ctx.lineWidth = 1
    rrect(ctx, x + pad, curY, bw, bh, br); ctx.stroke()
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(label, x + pad + bw / 2, curY + bh / 2)

    if (isHov) {
      ctx.font = '8px Inter,sans-serif'
      ctx.fillStyle = col; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
      ctx.fillText('Quiz →', x + w - pad, y + h - 6)
    }
  }
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
}

/* ══════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════ */
export default function QuizMindMap({
  topics = [], evalData = {}, courseTitle = '',
  onSelectTopic, onSelectSubtopic, onCardClick,
  revision = 0,
}) {
  const wrapRef   = useRef(null)
  const canvasRef = useRef(null)
  const nodesRef  = useRef([])
  const vpRef     = useRef({ ox: 0, oy: 0, scale: 1 })
  const [hovered,  setHovered]  = useState(null)
  const [width,    setWidth]    = useState(0)
  const [vpVer,    setVpVer]    = useState(0)
  // Dynamic canvas height — computed from actual layout so nothing is ever clipped
  const [canvasH,  setCanvasH]  = useState(700)

  // Recompute canvas height whenever topics change
  const computedLayout = useMemo(() => {
    if (!topics.length) return null
    return buildLayout(topics, evalData, courseTitle)
  // evalData intentionally omitted — height only depends on topic structure
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, courseTitle])

  useEffect(() => {
    if (!computedLayout) return
    const needed = Math.max(700, computedLayout.totalH + PAD * 2)
    setCanvasH(needed)
  }, [computedLayout])

  // Bump revision → immediate redraw
  useEffect(() => {
    if (revision > 0) setVpVer(v => v + 1)
  }, [revision])

  // ResizeObserver for responsive width
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width || el.offsetWidth))
    ro.observe(el); setWidth(el.offsetWidth)
    return () => ro.disconnect()
  }, [])

  const fitView = useCallback(() => {
    const vw = wrapRef.current?.offsetWidth || width
    const vh = canvasH
    const { nodes } = buildLayout(topics, evalData, courseTitle)
    if (!nodes.length) return
    const xs = nodes.map(n => [n.x, n.x + n.w]).flat()
    const ys = nodes.map(n => [n.y, n.y + n.h]).flat()
    const minX = Math.min(...xs), maxX = Math.max(...xs)
    const minY = Math.min(...ys), maxY = Math.max(...ys)
    const tw = maxX - minX + PAD * 2, th = maxY - minY + PAD * 2
    const s  = Math.min(vw / tw, vh / th, 1)
    vpRef.current = {
      scale: s,
      ox: (vw - tw * s) / 2 - minX * s + PAD * s,
      oy: (vh - th * s) / 2 - minY * s + PAD * s,
    }
    setVpVer(v => v + 1)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, topics, courseTitle, canvasH])

  /* DRAW */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !topics.length || width < 80) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W   = Math.max(width, 300)
    const H   = canvasH
    canvas.width  = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'

    const { nodes } = buildLayout(topics, evalData, courseTitle)
    nodesRef.current = nodes

    const { ox, oy, scale } = vpRef.current
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)
    ctx.translate(ox, oy)
    ctx.scale(scale, scale)

    const byId = Object.fromEntries(nodes.map(n => [n.id, n]))

    /* PASS 1 — connectors */
    nodes.filter(n => n.parent).forEach(n => {
      const p = byId[n.parent]; if (!p) return
      const col = ratingColor(n.rating)
      // connect from bottom-centre of parent to top-centre of child
      drawConnector(ctx, p.x + p.w / 2, p.y + p.h, n.x + n.w / 2, n.y, col)
    })

    /* PASS 2 — cards */
    nodes.forEach(n => drawCard(ctx, n, hovered?.id === n.id, courseTitle))

    ctx.restore()
  }, [topics, evalData, courseTitle, hovered, width, vpVer, canvasH])

  // Auto-fit on topics or size change
  useEffect(() => {
    if (width > 0 && topics.length && canvasH > 100) {
      const id = setTimeout(fitView, 140)
      return () => clearTimeout(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, width, canvasH])

  /* wheel zoom */
  useEffect(() => {
    const el = canvasRef.current; if (!el) return
    const onWheel = e => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const { ox, oy, scale } = vpRef.current
      const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06
      const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor))
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      vpRef.current = {
        scale: ns,
        ox: mx - (mx - ox) * (ns / scale),
        oy: my - (my - oy) * (ns / scale),
      }
      setVpVer(v => v + 1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  /* hit test */
  const hitNode = useCallback((cx, cy) => {
    const canvas = canvasRef.current; if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const { ox, oy, scale } = vpRef.current
    const wx = (cx - rect.left - ox) / scale
    const wy = (cy - rect.top  - oy) / scale
    for (const n of [...nodesRef.current].reverse()) {
      if (n.kind === 'root') continue
      if (wx >= n.x && wx <= n.x + n.w && wy >= n.y && wy <= n.y + n.h) return n
    }
    return null
  }, [])

  /* drag + click */
  useEffect(() => {
    let dragging = false, moved = false
    let startX = 0, startY = 0, startOx = 0, startOy = 0

    const onDown = e => {
      if (e.button !== 0) return
      dragging = true; moved = false
      startX = e.clientX; startY = e.clientY
      startOx = vpRef.current.ox; startOy = vpRef.current.oy
      if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
    }
    const onMove = e => {
      if (!dragging) {
        const n = hitNode(e.clientX, e.clientY)
        setHovered(n)
        if (canvasRef.current) canvasRef.current.style.cursor = n ? 'pointer' : 'grab'
        return
      }
      const dx = e.clientX - startX, dy = e.clientY - startY
      if (!moved && Math.hypot(dx, dy) > 5) moved = true
      if (moved) {
        vpRef.current.ox = startOx + dx; vpRef.current.oy = startOy + dy
        setVpVer(v => v + 1)
        if (canvasRef.current) canvasRef.current.style.cursor = 'grabbing'
      }
    }
    const onUp = e => {
      if (!dragging) return
      dragging = false
      if (!moved) {
        const n = hitNode(e.clientX, e.clientY)
        if (n && onCardClick) {
          const byId = Object.fromEntries(nodesRef.current.map(x => [x.id, x]))
          const topicNode = n.kind === 'topic' ? n : (n.topicId ? byId[n.topicId] : null)
          const parentName = topicNode?.name || courseTitle
          onCardClick(n.name, parentName)
        }
      }
      if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
    }

    const canvas = canvasRef.current; if (!canvas) return
    canvas.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup',   onUp)
    return () => {
      canvas.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup',   onUp)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitNode, onCardClick, courseTitle])

  /* toolbar zoom */
  const zoom = factor => {
    const vw = wrapRef.current?.offsetWidth || width
    const { ox, oy, scale } = vpRef.current
    const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor))
    const mx = vw / 2, my = canvasH / 2
    vpRef.current = { scale: ns, ox: mx - (mx - ox) * (ns / scale), oy: my - (my - oy) * (ns / scale) }
    setVpVer(v => v + 1)
  }

  const btnSt = (extra = {}) => ({
    width: 32, height: 32, border: '1.5px solid rgba(99,102,241,0.2)',
    borderRadius: 8, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(6px)',
    boxShadow: '0 2px 6px rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', fontSize: '1rem', color: '#6366f1', ...extra,
  })

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>

      {/* Toolbar */}
      <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button style={btnSt()} title="Zoom in"  onClick={() => zoom(1.12)}>＋</button>
        <button style={btnSt()} title="Zoom out" onClick={() => zoom(1 / 1.12)}>－</button>
        <button style={btnSt({ fontSize: '0.72rem', fontWeight: 700 })} title="Fit view" onClick={fitView}>⊡</button>
        <button style={btnSt({ fontSize: '0.65rem', fontWeight: 700 })} title="Reset"
          onClick={() => { vpRef.current = { ox: 0, oy: 0, scale: 1 }; setVpVer(v => v + 1) }}>1:1</button>
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 46, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)',
        border: '1px solid rgba(99,102,241,0.12)', borderRadius: 999,
        padding: '4px 14px', fontSize: '0.68rem', color: '#6b7280',
        pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        Scroll to zoom · Drag to pan · Click a card to quiz
      </div>

      {/* Canvas — height is dynamic, never clips any node */}
      <div ref={wrapRef} style={{
        width: '100%', height: canvasH, overflow: 'hidden', borderRadius: 16,
        background: 'linear-gradient(135deg,#f8faff 0%,#eef2ff 100%)',
        border: '1.5px solid rgba(99,102,241,0.1)', position: 'relative',
        transition: 'height 0.3s ease',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', cursor: 'grab' }} />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 10, paddingLeft: 4, alignItems: 'center' }}>
        {[['#22c55e','Strong'],['#f59e0b','Partial'],['#ef4444','Needs Work'],['#6366f1','Not Practiced']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
            <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
