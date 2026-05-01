import { useRef, useEffect, useState, useCallback } from 'react'

/* ── layout constants ── */
const ROOT_W = 210, ROOT_H = 84
const TOPIC_W = 165, TOPIC_H = 88
const SUB_W   = 148, SUB_H   = 64
const H_GAP1  = 72   // root → topics
const H_GAP2  = 48   // topics → subtopics
const V_GAP   = 12   // between sibling subtopics
const COL_GAP = 28   // horizontal gap between topic columns
const PAD     = 56   // canvas padding
const MIN_SCALE = 0.08, MAX_SCALE = 4
const CANVAS_H  = 680

/* ── colour helpers ── */
const ratingColor = r =>
  r === 'strong' ? '#22c55e'
  : r === 'partial' || r === 'moderate' ? '#f59e0b'
  : r === 'weak' ? '#ef4444'
  : '#6366f1'

const ratingLabel = r =>
  r === 'strong' ? 'Strong'
  : r === 'partial' || r === 'moderate' ? 'Partial'
  : r === 'weak' ? 'Weak'
  : 'Not Practiced'

const aggregateRating = arr => {
  const v = arr.filter(Boolean)
  if (!v.length) return undefined
  if (v.every(r => r === 'strong')) return 'strong'
  if (v.some(r  => r === 'weak'))   return 'weak'
  return 'partial'
}

/* ── build world-space layout ── */
function buildLayout(topics, evalData) {
  const cols = topics.map(t => ({
    name: typeof t === 'string' ? t : t.name,
    desc: typeof t === 'object' ? (t.description || '') : '',
    subs: typeof t === 'object' && Array.isArray(t.subtopics)
      ? t.subtopics.map(s => typeof s === 'string' ? s : (s.name || '')).filter(Boolean)
      : [],
  }))

  const colW   = Math.max(SUB_W, TOPIC_W) + COL_GAP
  const totalW = cols.length * colW - COL_GAP + PAD * 2
  const rootX  = totalW / 2 - ROOT_W / 2
  const rootY  = PAD
  const nodes  = []

  nodes.push({ id: '__root__', kind: 'root', x: rootX, y: rootY, w: ROOT_W, h: ROOT_H })

  const topicY = rootY + ROOT_H + H_GAP1
  cols.forEach((col, ci) => {
    // Parent topic colour rules:
    //  1. If the topic node itself was directly quizzed → use its own rating
    //  2. Else if ALL subtopics have been tested → aggregate their ratings
    //  3. Else → undefined (indigo "Not Practiced")
    const subRatings = col.subs.map(s => evalData?.[s]?.rating)
    const allSubsTested = col.subs.length > 0 && subRatings.every(r => r != null)
    const rating = evalData?.[col.name]?.rating
      ?? (allSubsTested ? aggregateRating(subRatings) : undefined)
    const cx = PAD + ci * colW + (colW - COL_GAP) / 2
    const tX = cx - TOPIC_W / 2
    nodes.push({
      id: `t${ci}`, kind: 'topic', name: col.name, desc: col.desc,
      x: tX, y: topicY, w: TOPIC_W, h: TOPIC_H,
      rating, parent: '__root__', subs: col.subs,
    })
    const subY0 = topicY + TOPIC_H + H_GAP2
    col.subs.forEach((sName, si) => {
      nodes.push({
        id: `s${ci}_${si}`, kind: 'subtopic', name: sName, desc: '',
        x: cx - SUB_W / 2, y: subY0 + si * (SUB_H + V_GAP), w: SUB_W, h: SUB_H,
        rating: evalData?.[sName]?.rating,   // only use its OWN rating — never inherit parent's
        parent: `t${ci}`,
      })
    })
  })

  const maxSubs = Math.max(...cols.map(c => c.subs.length), 0)
  const totalH  = topicY + TOPIC_H + H_GAP2 + maxSubs * (SUB_H + V_GAP) + PAD
  return { nodes, totalW, totalH }
}

/* ── canvas helpers ── */
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
  const words = text.split(' ')
  let line = '', lines = []
  for (const word of words) {
    const t = line ? line + ' ' + word : word
    if (ctx.measureText(t).width > maxW && line) {
      lines.push(line); line = word
      if (lines.length >= maxLines) break
    } else { line = t }
  }
  if (line && lines.length < maxLines) lines.push(line)
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineH))
  return y + lines.length * lineH
}

function drawBezierArrow(ctx, x1, y1, x2, y2, color) {
  const my = (y1 + y2) / 2
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.bezierCurveTo(x1, my, x2, my, x2, y2 - 6)
  ctx.strokeStyle = color + 'bb'; ctx.lineWidth = 1.8; ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x2, y2)
  ctx.lineTo(x2 - 5, y2 - 9); ctx.lineTo(x2 + 5, y2 - 9)
  ctx.closePath(); ctx.fillStyle = color + 'bb'; ctx.fill()
}

function drawCard(ctx, node, isHov, courseTitle) {
  const { x, y, w, h, kind, name, rating } = node
  const col   = ratingColor(rating)
  const R = 12

  /* shadow */
  ctx.shadowColor   = isHov ? col + '55' : 'rgba(0,0,0,0.10)'
  ctx.shadowBlur    = isHov ? 22 : 10
  ctx.shadowOffsetY = isHov ? 5 : 3

  if (kind === 'root') {
    const g = ctx.createLinearGradient(x, y, x + w, y + h)
    g.addColorStop(0, '#4f46e5'); g.addColorStop(1, '#7c3aed')
    rrect(ctx, x, y, w, h, R); ctx.fillStyle = g; ctx.fill()
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    rrect(ctx, x, y, w, h, R)
    ctx.strokeStyle = 'rgba(255,255,255,0.28)'; ctx.lineWidth = 1.5; ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Inter,sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(courseTitle || 'Course', x + w / 2, y + h / 2)
  } else {
    /* white card */
    rrect(ctx, x, y, w, h, R); ctx.fillStyle = '#fff'; ctx.fill()
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
    /* top colour bar */
    ctx.save(); rrect(ctx, x, y, w, h, R); ctx.clip()
    ctx.fillStyle = col; ctx.fillRect(x, y, w, 4); ctx.restore()
    /* border */
    rrect(ctx, x, y, w, h, R)
    ctx.strokeStyle = col + (isHov ? 'cc' : '44')
    ctx.lineWidth = isHov ? 2 : 1.5; ctx.stroke()

    const pad = 10
    let curY = y + 14
    /* name */
    ctx.fillStyle = '#1e293b'
    ctx.font = `bold ${kind === 'topic' ? 12 : 11}px Inter,sans-serif`
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    curY = wrapText(ctx, name, x + pad, curY, w - pad * 2, kind === 'topic' ? 15 : 13, 2) + 4

    /* rating badge */
    const label = ratingLabel(rating)
    ctx.font = 'bold 8px Inter,sans-serif'
    const bw = ctx.measureText(label).width + 12, bh = 14, br = 7
    rrect(ctx, x + pad, curY, bw, bh, br)
    ctx.fillStyle = col + '22'; ctx.fill()
    ctx.strokeStyle = col + '55'; ctx.lineWidth = 1
    rrect(ctx, x + pad, curY, bw, bh, br); ctx.stroke()
    ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(label, x + pad + bw / 2, curY + bh / 2)

    /* hover hint */
    if (isHov) {
      ctx.font = '8px Inter,sans-serif'
      ctx.fillStyle = col; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
      ctx.fillText('Quiz →', x + w - pad, y + h - pad / 2)
    }
  }
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
}

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */
export default function QuizMindMap({ topics = [], evalData = {}, courseTitle = '', onSelectTopic, onSelectSubtopic, onCardClick }) {
  const wrapRef   = useRef(null)
  const canvasRef = useRef(null)
  const nodesRef  = useRef([])
  const vpRef     = useRef({ ox: 0, oy: 0, scale: 1 })
  const dragRef   = useRef(null)
  const [hovered,   setHovered]   = useState(null)
  const [width,     setWidth]     = useState(0)
  const [vpVer,     setVpVer]     = useState(0)

  /* observe width */
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width || el.offsetWidth))
    ro.observe(el); setWidth(el.offsetWidth)
    return () => ro.disconnect()
  }, [])

  /* fit-to-view */
  const fitView = useCallback(() => {
    const vw = wrapRef.current?.offsetWidth || width
    const vh = CANVAS_H
    const { nodes } = buildLayout(topics, evalData)
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
  }, [width, topics])

  /* DRAW */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !topics.length || width < 80) return
    const ctx = canvas.getContext('2d')
    const dpr = window.devicePixelRatio || 1
    const W   = Math.max(width, 300)
    const H   = CANVAS_H
    canvas.width  = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px'

    const { nodes } = buildLayout(topics, evalData)
    nodesRef.current = nodes

    const { ox, oy, scale } = vpRef.current
    ctx.save()
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)
    ctx.translate(ox, oy)
    ctx.scale(scale, scale)

    /* PASS 1 — arrows */
    const byId = Object.fromEntries(nodes.map(n => [n.id, n]))
    nodes.filter(n => n.parent).forEach(n => {
      const p  = byId[n.parent]; if (!p) return
      const col = ratingColor(n.rating)
      drawBezierArrow(ctx,
        p.x + p.w / 2, p.y + p.h,
        n.x + n.w / 2, n.y,
        col)
    })

    /* PASS 2 — cards */
    nodes.forEach(n => drawCard(ctx, n, hovered?.id === n.id, courseTitle))

    ctx.restore()
  }, [topics, evalData, courseTitle, hovered, width, vpVer])

  /* fit on first load */
  useEffect(() => {
    if (width > 0 && topics.length) {
      const id = setTimeout(fitView, 120)
      return () => clearTimeout(id)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topics, width])

  /* ── Scroll-to-zoom — ONLY fires when mouse is over the canvas ── */
  useEffect(() => {
    const el = canvasRef.current; if (!el) return
    const onWheel = (e) => {
      e.preventDefault()   // blocks page scroll + browser zoom ONLY while over canvas
      const rect   = el.getBoundingClientRect()
      const { ox, oy, scale } = vpRef.current
      const factor = e.deltaY < 0 ? 1.06 : 1 / 1.06
      const ns  = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor))
      const mx  = e.clientX - rect.left
      const my  = e.clientY - rect.top
      vpRef.current = {
        scale: ns,
        ox: mx - (mx - ox) * (ns / scale),
        oy: my - (my - oy) * (ns / scale),
      }
      setVpVer(v => v + 1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])   // canvas ref never changes, so [] is fine

  /* hit test (screen → world) */
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

  /* global drag / click */
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
        if (n) {
          const parentNode = nodesRef.current.find(p => p.id === n.parent)
          const parentName = parentNode?.name || courseTitle
          if (onCardClick) {
            onCardClick(n.name, parentName)
          }
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
  }, [hitNode, onSelectTopic, onSelectSubtopic])

  /* toolbar zoom */
  const zoom = factor => {
    const vw = wrapRef.current?.offsetWidth || width
    const { ox, oy, scale } = vpRef.current
    const ns = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * factor))
    const mx = vw / 2, my = CANVAS_H / 2
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
        <button style={btnSt()} title="Zoom in"     onClick={() => zoom(1.12)}>＋</button>
        <button style={btnSt()} title="Zoom out"    onClick={() => zoom(1 / 1.12)}>－</button>
        <button style={btnSt({ fontSize: '0.72rem', fontWeight: 700 })} title="Fit view" onClick={fitView}>⊡</button>
        <button style={btnSt({ fontSize: '0.65rem', fontWeight: 700 })} title="Reset"    onClick={() => { vpRef.current = { ox: 0, oy: 0, scale: 1 }; setVpVer(v => v + 1) }}>1:1</button>
      </div>

      {/* Hint */}
      <div style={{
        position: 'absolute', bottom: 46, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(6px)',
        border: '1px solid rgba(99,102,241,0.12)', borderRadius: 999,
        padding: '4px 14px', fontSize: '0.68rem', color: '#6b7280', pointerEvents: 'none', whiteSpace: 'nowrap',
      }}>
        Scroll to zoom · Drag to pan · Click a card to quiz
      </div>

      {/* Canvas */}
      <div ref={wrapRef} style={{
        width: '100%', height: CANVAS_H, overflow: 'hidden', borderRadius: 16,
        background: 'linear-gradient(135deg,#f8faff 0%,#eef2ff 100%)',
        border: '1.5px solid rgba(99,102,241,0.1)', position: 'relative',
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
