import { useRef, useEffect, useState, useCallback } from 'react'
import { drawCircleLabel } from '../utils/canvasTextUtils'

/* ── colour helpers ─────────────────────────────────────────── */
const ratingColor = r =>
  r === 'strong'  ? '#22c55e'
  : r === 'partial' || r === 'moderate' ? '#f59e0b'
  : r === 'weak'  ? '#ef4444'
  : '#6366f1'

/* Roll up subtopic ratings into a single parent rating */
const aggregateRating = (ratings) => {
  const valid = ratings.filter(Boolean)
  if (!valid.length) return undefined
  if (valid.every(r => r === 'strong'))  return 'strong'
  if (valid.some(r => r === 'weak'))     return 'weak'
  return 'partial'
}

/* wrapText and drawLabel replaced by shared drawCircleLabel from canvasTextUtils */

/* ── draw an arrowed line between two circles ───────────────── */
function drawArrow(ctx, x1, y1, x2, y2, r1, r2, color, dashLen = 0) {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const dist  = Math.hypot(x2 - x1, y2 - y1)
  if (dist < r1 + r2 + 4) return   // nodes too close – skip

  const sx = x1 + r1 * Math.cos(angle)
  const sy = y1 + r1 * Math.sin(angle)
  const ex = x2 - r2 * Math.cos(angle)
  const ey = y2 - r2 * Math.sin(angle)

  ctx.beginPath()
  ctx.moveTo(sx, sy)
  ctx.lineTo(ex, ey)
  ctx.strokeStyle = color
  ctx.lineWidth   = dashLen ? 1.2 : 1.8
  if (dashLen) ctx.setLineDash([dashLen, 4])
  ctx.stroke()
  ctx.setLineDash([])

  /* arrowhead */
  const AL = 8, AA = Math.PI / 6
  ctx.beginPath()
  ctx.moveTo(ex, ey)
  ctx.lineTo(ex - AL * Math.cos(angle - AA), ey - AL * Math.sin(angle - AA))
  ctx.lineTo(ex - AL * Math.cos(angle + AA), ey - AL * Math.sin(angle + AA))
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

/* ── draw a filled circle with white border ─────────────────── */
function drawCircle(ctx, x, y, r, fillColor, glow = false, lineW = 2.5) {
  if (glow) {
    ctx.beginPath(); ctx.arc(x, y, r + 8, 0, 2 * Math.PI)
    ctx.fillStyle = fillColor + '22'; ctx.fill()
  }
  ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI)
  ctx.fillStyle   = fillColor
  ctx.shadowColor = glow ? fillColor + 'aa' : 'transparent'
  ctx.shadowBlur  = glow ? 18 : 0
  ctx.fill(); ctx.shadowBlur = 0
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = lineW; ctx.stroke()
}

/* drawLabel is now drawCircleLabel from canvasTextUtils */

/* ── distribute N angles evenly within an angular sector ───── */
function sectorAngles(center, totalArc, count) {
  if (count === 1) return [center]
  return Array.from({ length: count }, (_, i) =>
    center - totalArc / 2 + (totalArc / (count - 1)) * i
  )
}

/* ══════════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════════ */
export default function QuizMindMap({ topics, evalData, courseTitle, onSelectTopic, onSelectSubtopic }) {
  const wrapRef   = useRef(null)
  const canvasRef = useRef(null)
  const nodesRef  = useRef([])
  const [hovered, setHovered] = useState(null)
  const [width,   setWidth]   = useState(0)

  /* observe container width */
  useEffect(() => {
    const el = wrapRef.current; if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width || el.offsetWidth))
    ro.observe(el); setWidth(el.offsetWidth)
    return () => ro.disconnect()
  }, [])

  /* ── DRAW ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !topics.length || width < 80) return
    const ctx = canvas.getContext('2d')

    const N = topics.length

    // Collect ALL subtopics — no limit, no cuts
    const subsPerTopic = topics.map(t =>
      typeof t === 'object' && Array.isArray(t.subtopics)
        ? t.subtopics.map(s => typeof s === 'string' ? s : (s.name || '')).filter(Boolean)
        : []
    )
    const maxSubsAny = Math.max(...subsPerTopic.map(s => s.length), 1)

    // ── Fixed node radii ──
    const CR = 68, TR = 54, SR = 36
    const GAP_T = 24   // minimum gap between topic node edges
    const GAP_S = 20   // minimum gap between subtopic node edges

    const SECTOR = (2 * Math.PI) / N

    // ── RING1: circumference must seat all N topic nodes without touching ──
    const RING1 = Math.max(180, Math.ceil(N * (2 * TR + GAP_T) / (2 * Math.PI)))

    // ── RING2: derived so busiest topic fills only 78% of its sector ──
    // neededArc = subs*(2SR+GAP_S)/RING2 ≤ SECTOR*0.78
    // → RING2 ≥ maxSubs*(2SR+GAP_S) / (SECTOR*0.78)
    const FILL = 0.78
    const RING2_fromSubs = maxSubsAny <= 1
      ? 0
      : Math.ceil(maxSubsAny * (2 * SR + GAP_S) / (SECTOR * FILL))
    // Also clear topic nodes radially
    const RING2 = Math.max(RING1 + TR + SR + 55, RING2_fromSubs)

    // ── Canvas: square big enough for RING2 + node radius + padding ──
    const PAD  = SR + 90
    const SIZE = Math.max(Math.ceil((RING2 + PAD) * 2), width)
    const W = SIZE, H = SIZE
    const cx = W / 2, cy = H / 2

    const dpr = window.devicePixelRatio || 1
    canvas.width        = Math.round(W * dpr)
    canvas.height       = Math.round(H * dpr)
    canvas.style.width  = W + 'px'
    canvas.style.height = H + 'px'
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, W, H)

    // ── Gather all node positions ──
    const allNodes = []

    topics.forEach((t, i) => {
      const tName = typeof t === 'string' ? t : t.name
      const subs  = subsPerTopic[i]

      const ownRating       = evalData?.[tName]?.rating
      const effectiveRating = ownRating ?? aggregateRating(subs.map(s => evalData?.[s]?.rating))

      const θ  = (2 * Math.PI * i) / N - Math.PI / 2
      const tx = cx + RING1 * Math.cos(θ)
      const ty = cy + RING1 * Math.sin(θ)

      allNodes.push({ name: tName, x: tx, y: ty, kind: 'topic', parent: null, rating: effectiveRating })

      if (subs.length > 0) {
        // Arc for THIS topic's subtopics — guaranteed ≤ SECTOR*FILL, so no cross-topic collision
        const arc = subs.length === 1 ? 0
          : (subs.length * (2 * SR + GAP_S)) / RING2   // always ≤ SECTOR*FILL by RING2 construction

        const angles = sectorAngles(θ, arc, subs.length)
        angles.forEach((sθ, si) => {
          const sx = cx + RING2 * Math.cos(sθ)
          const sy = cy + RING2 * Math.sin(sθ)
          const subOwnRating = evalData?.[subs[si]]?.rating ?? effectiveRating
          allNodes.push({ name: subs[si], x: sx, y: sy, kind: 'subtopic', parent: tName, rating: subOwnRating })
        })
      }
    })

    nodesRef.current = allNodes

    /* ─── PASS 1: Edges ─── */
    allNodes.filter(n => n.kind === 'topic').forEach(tn => {
      const tColor = ratingColor(tn.rating)
      drawArrow(ctx, cx, cy, tn.x, tn.y, CR, TR, 'rgba(99,102,241,0.5)', 0)
      allNodes.filter(n => n.kind === 'subtopic' && n.parent === tn.name).forEach(sn => {
        drawArrow(ctx, tn.x, tn.y, sn.x, sn.y, TR, SR, tColor + '88', 5)
      })
    })

    /* ─── PASS 2: Center node ─── */
    const cGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, CR)
    cGrad.addColorStop(0, '#818cf8'); cGrad.addColorStop(1, '#4f46e5')
    ctx.beginPath(); ctx.arc(cx, cy, CR, 0, 2 * Math.PI)
    ctx.fillStyle = cGrad
    ctx.shadowColor = 'rgba(99,102,241,0.55)'; ctx.shadowBlur = 22
    ctx.fill(); ctx.shadowBlur = 0
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2.5; ctx.stroke()
    drawCircleLabel(ctx, courseTitle || 'Course', cx, cy, CR, 14, true)

    /* ─── PASS 3: Topic + subtopic nodes ─── */
    allNodes.forEach(n => {
      const isTopic = n.kind === 'topic'
      const isHov   = hovered?.name === n.name
      const color   = ratingColor(n.rating)
      const NR      = isTopic ? TR : SR

      drawCircle(ctx, n.x, n.y, NR,
        isTopic ? (isHov ? color : color + 'dd') : (isHov ? color : color + 'aa'),
        isHov, isTopic ? 2.5 : 1.8)
      drawCircleLabel(ctx, n.name, n.x, n.y, NR, isTopic ? 13 : 10, isTopic && isHov)

      if (isHov) {
        const pill = isTopic ? (n.rating ? 'Retake quiz →' : 'Start quiz →') : 'Quiz this subtopic →'
        ctx.font = `bold 8px Inter,sans-serif`
        const pw = ctx.measureText(pill).width + 14
        const px = n.x - pw / 2, py = n.y + NR + 7
        ctx.beginPath()
        ctx.roundRect ? ctx.roundRect(px, py, pw, 16, 8) : (() => ctx.rect(px, py, pw, 16))()
        ctx.fillStyle = isTopic ? color : '#6366f1'; ctx.fill()
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'
        ctx.fillText(pill, n.x, py + 8)
      }
    })

  }, [topics, evalData, courseTitle, hovered, width])

  /* ── hit-test ── */
  const hitTest = useCallback(e => {
    const canvas = canvasRef.current; if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left, my = e.clientY - rect.top
    const W  = width
    const half = Math.min(W / 2, canvas.style.height ? parseInt(canvas.style.height) / 2 : W * 0.47)
    const TR = Math.min(62, half * 0.18) + 8
    const SR = Math.min(42, half * 0.13) + 6
    // check subtopics first (smaller, on outer ring)
    for (const n of [...nodesRef.current].reverse()) {
      const r  = n.kind === 'subtopic' ? SR : TR
      const dx = mx - n.x, dy = my - n.y
      if (dx * dx + dy * dy < r * r) return n
    }
    return null
  }, [width])

  const onMouseMove  = useCallback(e => setHovered(hitTest(e)), [hitTest])
  const onMouseLeave = useCallback(() => setHovered(null), [])
  const onClick      = useCallback(e => {
    const n = hitTest(e); if (!n) return
    if (n.kind === 'subtopic') {
      // Pass subtopic with its parent so questions are specific to THIS subtopic
      if (onSelectSubtopic) {
        onSelectSubtopic(n.name, n.parent)
      } else {
        onSelectTopic(n.name)
      }
    } else {
      onSelectTopic(n.name)
    }
  }, [hitTest, onSelectTopic, onSelectSubtopic])

  return (
    <div style={{ position: 'relative' }}>
      {/* overflow:auto so the canvas can scroll when larger than the page column */}
      <div ref={wrapRef} style={{ width: '100%', overflowX: 'auto', overflowY: 'auto' }}>
        <canvas
          ref={canvasRef}
          style={{ display: 'block', borderRadius: 16, cursor: hovered ? 'pointer' : 'default' }}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onClick={onClick}
        />
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 12, paddingLeft: 4, alignItems: 'center' }}>
        {[
          ['#22c55e', 'Mastered'],
          ['#f59e0b', 'In Progress'],
          ['#ef4444', 'Needs Work'],
          ['#6366f1', 'Not Started'],
        ].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />
            <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>{l}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 6, opacity: 0.7 }}>
          <svg width="26" height="10" viewBox="0 0 26 10">
            <line x1="0" y1="5" x2="18" y2="5" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3"/>
            <polygon points="18,2.5 26,5 18,7.5" fill="#94a3b8"/>
          </svg>
          <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>Subtopic</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: 0.7 }}>
          <svg width="26" height="10" viewBox="0 0 26 10">
            <line x1="0" y1="5" x2="18" y2="5" stroke="#6366f1" strokeWidth="1.8"/>
            <polygon points="18,2.5 26,5 18,7.5" fill="#6366f1"/>
          </svg>
          <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 500 }}>Topic</span>
        </div>
      </div>
    </div>
  )
}
