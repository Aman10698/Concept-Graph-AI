import { useMemo } from 'react';

const NODE_W = 172, NODE_H = 60, H_GAP = 28, V_GAP = 88, PAD = 32;

const STATUS = {
  current:     { color:'#6366f1', bg:'#eef2ff', border:'#a5b4fc', badge:null,  badgeBg:null },
  strong:      { color:'#16a34a', bg:'#f0fdf4', border:'#86efac', badge:'✓',   badgeBg:'#22c55e' },
  partial:     { color:'#b45309', bg:'#fffbeb', border:'#fcd34d', badge:'!',   badgeBg:'#f59e0b' },
  weak:        { color:'#b91c1c', bg:'#fef2f2', border:'#fca5a5', badge:'✗',   badgeBg:'#ef4444' },
  not_started: { color:'#64748b', bg:'#f8fafc', border:'#cbd5e1', badge:'○',   badgeBg:'#94a3b8' },
};

/* ── Tree layout ────────────────────────────────────────────────── */
function buildRoots(nodes) {
  const map = {};
  nodes.forEach(n => { map[n.name] = { ...n, children: [] }; });
  const roots = [];
  nodes.forEach(n => {
    if (n.parent && n.parent !== 'none' && map[n.parent]) {
      map[n.parent].children.push(map[n.name]);
    } else {
      roots.push(map[n.name]);
    }
  });
  return roots;
}

function subtreeW(node) {
  if (!node.children.length) return NODE_W;
  const sum = node.children.reduce((s, c) => s + subtreeW(c), 0);
  return Math.max(NODE_W, sum + H_GAP * (node.children.length - 1));
}

function layout(roots) {
  const out = [];
  let ox = 0;
  roots.forEach(root => {
    const w = subtreeW(root);
    place(root, ox, 0, w);
    ox += w + H_GAP;
  });
  function place(node, ox, y, w) {
    out.push({ node, x: ox + w / 2 - NODE_W / 2, y });
    let cx = ox;
    node.children.forEach(c => {
      const cw = subtreeW(c);
      place(c, cx, y + NODE_H + V_GAP, cw);
      cx += cw + H_GAP;
    });
  }
  return out;
}

/* ── Node component (SVG group) ─────────────────────────────────── */
function NodeBox({ x, y, node }) {
  const cfg = STATUS[node.status] || STATUS.not_started;
  const words = node.name.split(' ');
  // wrap into max 2 lines of ~18 chars
  const lines = [];
  let cur = '';
  words.forEach(w => {
    if ((cur + ' ' + w).trim().length > 18 && cur) { lines.push(cur.trim()); cur = w; }
    else cur = (cur + ' ' + w).trim();
  });
  if (cur) lines.push(cur);
  const lineH = 16;
  const textY = y + NODE_H / 2 - ((lines.length - 1) * lineH) / 2;

  return (
    <g>
      {/* Shadow */}
      <rect x={x+2} y={y+3} width={NODE_W} height={NODE_H} rx="12"
        fill="rgba(0,0,0,0.06)" />
      {/* Box */}
      <rect x={x} y={y} width={NODE_W} height={NODE_H} rx="12"
        fill={cfg.bg} stroke={cfg.color} strokeWidth="1.8" />
      {/* Label */}
      {lines.map((line, i) => (
        <text key={i} x={x + NODE_W / 2} y={textY + i * lineH}
          textAnchor="middle" dominantBaseline="middle"
          style={{ fontSize:'0.76rem', fontWeight:600, fill:cfg.color, fontFamily:'inherit' }}>
          {line}
        </text>
      ))}
      {/* Status badge */}
      {cfg.badge && (
        <>
          <circle cx={x + NODE_W - 13} cy={y + 13} r="11" fill="#fff" />
          <circle cx={x + NODE_W - 13} cy={y + 13} r="9"  fill={cfg.badgeBg} />
          <text x={x + NODE_W - 13} y={y + 14} textAnchor="middle"
            dominantBaseline="middle"
            style={{ fontSize:'0.6rem', fontWeight:900, fill:'#fff', fontFamily:'inherit' }}>
            {cfg.badge}
          </text>
        </>
      )}
      {/* Reason tooltip strip */}
      {node.reason && (
        <title>{node.reason}</title>
      )}
    </g>
  );
}

/* ── Main component ─────────────────────────────────────────────── */
export default function DependencyGraph({ nodes = [] }) {
  const positioned = useMemo(() => {
    if (!nodes.length) return [];
    return layout(buildRoots(nodes));
  }, [nodes]);

  if (!positioned.length) return null;

  const minX = Math.min(...positioned.map(p => p.x));
  const maxX = Math.max(...positioned.map(p => p.x + NODE_W));
  const maxY = Math.max(...positioned.map(p => p.y + NODE_H));
  const W  = maxX - minX + PAD * 2;
  const H  = maxY + PAD * 2;
  const dx = -minX + PAD;
  const dy = PAD;

  // posMap for edge lookup
  const posMap = {};
  positioned.forEach(p => { posMap[p.node.name] = p; });

  const LEGEND = [
    ['strong','Strong'], ['partial','Partial'], ['weak','Weak'], ['not_started','Not Started']
  ];

  return (
    <div style={{ overflowX:'auto', width:'100%' }}>
      <svg width={W} height={H} style={{ display:'block', margin:'0 auto', minWidth:320 }}>
        <defs>
          {Object.entries(STATUS).map(([s, cfg]) => (
            <marker key={s} id={`dep-arr-${s}`} markerWidth="8" markerHeight="8"
              refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L7,3 z" fill={cfg.color} />
            </marker>
          ))}
        </defs>

        {/* ── Edges ── */}
        {positioned.map(({ node, x, y }) =>
          node.children?.map(child => {
            const cp = posMap[child.name];
            if (!cp) return null;
            const cfg = STATUS[cp.node.status] || STATUS.not_started;
            const x1 = x + dx + NODE_W / 2, y1 = y + dy + NODE_H;
            const x2 = cp.x + dx + NODE_W / 2, y2 = cp.y + dy;
            const my = (y1 + y2) / 2;
            return (
              <path key={`${node.name}-${child.name}`}
                d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
                fill="none" stroke={cfg.color} strokeWidth="2"
                strokeDasharray={cfg === STATUS.not_started ? '5,4' : undefined}
                markerEnd={`url(#dep-arr-${cp.node.status})`} />
            );
          })
        )}

        {/* ── Nodes ── */}
        {positioned.map(({ node, x, y }) => (
          <NodeBox key={node.name} x={x + dx} y={y + dy} node={node} />
        ))}
      </svg>

      {/* Legend */}
      <div style={{ display:'flex', gap:20, justifyContent:'center', flexWrap:'wrap',
        marginTop:14, paddingTop:12, borderTop:'1px solid #f1f5f9' }}>
        {LEGEND.map(([s, label]) => {
          const cfg = STATUS[s];
          return (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:18, height:18, borderRadius:'50%',
                background: cfg.badgeBg, display:'flex', alignItems:'center',
                justifyContent:'center', flexShrink:0 }}>
                <span style={{ fontSize:'0.55rem', color:'#fff', fontWeight:900,
                  lineHeight:1 }}>{cfg.badge}</span>
              </div>
              <span style={{ fontSize:'0.72rem', color:'#6b7280', fontWeight:500 }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
