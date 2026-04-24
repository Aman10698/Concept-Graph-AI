/**
 * canvasTextUtils.js
 * Shared utility for drawing text strictly inside circular canvas nodes.
 * Guarantees labels never overflow the circle boundary.
 */

/**
 * Wrap text into lines that fit within maxW pixels.
 * Also hard-truncates any single word that is wider than maxW.
 */
export function wrapTextInCircle(ctx, text, maxW) {
  const words = text.split(' ')
  const lines = []
  let line = ''

  for (const word of words) {
    const candidate = line ? line + ' ' + word : word
    if (ctx.measureText(candidate).width > maxW && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)

  // Hard-truncate any individual line that is still too wide
  // (happens when a single word is longer than maxW)
  return lines.map(l => {
    while (l.length > 1 && ctx.measureText(l).width > maxW) {
      l = l.slice(0, -1)
    }
    return l
  })
}

/**
 * Draw centred, wrapped text that is guaranteed to stay inside a circle of
 * radius `r` centred at (x, y).
 *
 * Strategy:
 *  - maxW  = r * 1.3  →  each line ≤ 65 % of the diameter
 *  - maxLines derived so the text block height ≤ 85 % of the diameter
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {string}  text
 * @param {number}  x          centre x of the circle
 * @param {number}  y          centre y of the circle
 * @param {number}  r          radius of the circle
 * @param {number}  [fontSize=10]
 * @param {boolean} [bold=false]
 */
export function drawCircleLabel(ctx, text, x, y, r, fontSize = 10, bold = false) {
  const lh      = fontSize + 3                              // line height
  const maxW    = r * 1.55                                  // max line width (inscribed rectangle)
  const maxLines = Math.max(2, Math.floor((r * 1.8) / lh)) // lines that fit vertically

  ctx.font          = `${bold ? 'bold' : '700'} ${fontSize}px Inter,sans-serif`
  ctx.fillStyle     = '#fff'
  ctx.textAlign     = 'center'
  ctx.textBaseline  = 'middle'

  const lines = wrapTextInCircle(ctx, text, maxW).slice(0, maxLines)
  lines.forEach((l, i) =>
    ctx.fillText(l, x, y + (i - (lines.length - 1) / 2) * lh)
  )
}
