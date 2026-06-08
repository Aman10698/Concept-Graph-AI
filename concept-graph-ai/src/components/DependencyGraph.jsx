import { useMemo, useState, useCallback, useRef, useEffect } from 'react';

/* ═══ Layout ════════════════════════════════════════════════════════ */
const NW = 188, NH = 74;
const RW = 210, RH = 86;
const HGAP = 28, VGAP = 88;
const PAD  = 56;

/* ═══ Colours ═══════════════════════════════════════════════════════ */
const C = {
  strong:      { border:'#22c55e', iconBg:'#dcfce7', iconFg:'#16a34a', badge:'#f0fdf4', badgeTxt:'#16a34a', dot:'#22c55e', label:'Strong'      },
  partial:     { border:'#f59e0b', iconBg:'#fef3c7', iconFg:'#b45309', badge:'#fffbeb', badgeTxt:'#b45309', dot:'#f59e0b', label:'Partial'     },
  weak:        { border:'#ef4444', iconBg:'#fee2e2', iconFg:'#dc2626', badge:'#fef2f2', badgeTxt:'#dc2626', dot:'#ef4444', label:'Weak'        },
  not_started: { border:'#d1d5db', iconBg:'#f3f4f6', iconFg:'#6b7280', badge:'#f9fafb', badgeTxt:'#6b7280', dot:'#9ca3af', label:'Not Started' },
  // 'current' is used by Bloom quiz nodes for the root/active concept
  current:     { border:'#6366f1', iconBg:'#eef2ff', iconFg:'#4f46e5', badge:'#eef2ff', badgeTxt:'#4f46e5', dot:'#6366f1', label:'Current'     },
};

/* ═══ Icons (SVG path groups, 20×20 viewBox) ═══════════════════════ */
const ICONS = [
  fg=>[<circle key="a" cx="10" cy="3"  r="2.2" stroke={fg} strokeWidth="1.6" fill="none"/>,<circle key="b" cx="3" cy="17" r="2.2" stroke={fg} strokeWidth="1.6" fill="none"/>,<circle key="c" cx="17" cy="17" r="2.2" stroke={fg} strokeWidth="1.6" fill="none"/>,<line key="d" x1="10" y1="5.2" x2="3"  y2="14.8" stroke={fg} strokeWidth="1.5"/>,<line key="e" x1="10" y1="5.2" x2="17" y2="14.8" stroke={fg} strokeWidth="1.5"/>,<line key="f" x1="5.2" y1="17" x2="14.8" y2="17" stroke={fg} strokeWidth="1.5"/>],
  fg=>[<path key="a" d="M7 2h6M10 2v6L5 16a1 1 0 0 0 .9 1.5h8.2a1 1 0 0 0 .9-1.5L10 8" stroke={fg} strokeWidth="1.6" fill="none" strokeLinecap="round"/>,<circle key="b" cx="8" cy="14.5" r="1" fill={fg}/>,<circle key="c" cx="11" cy="12.5" r="1" fill={fg}/>],
  fg=>[<path key="a" d="M5 2h8l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" stroke={fg} strokeWidth="1.5" fill="none"/>,<path key="b" d="M13 2v4h4" stroke={fg} strokeWidth="1.5" fill="none"/>,<line key="c" x1="7" y1="10" x2="14" y2="10" stroke={fg} strokeWidth="1.4"/>,<line key="d" x1="7" y1="13" x2="14" y2="13" stroke={fg} strokeWidth="1.4"/>],
  fg=>[<path key="a" d="M10 1.5L18 5.5v8L10 17.5 2 13.5v-8z" stroke={fg} strokeWidth="1.5" fill="none"/>,<line key="b" x1="2"  y1="5.5" x2="10" y2="9.5" stroke={fg} strokeWidth="1.3"/>,<line key="c" x1="18" y1="5.5" x2="10" y2="9.5" stroke={fg} strokeWidth="1.3"/>,<line key="d" x1="10" y1="9.5" x2="10" y2="17.5" stroke={fg} strokeWidth="1.3"/>],
  fg=>[<path key="a" d="M10 2C10 2 3 9 3 13a7 7 0 0 0 14 0C17 9 10 2 10 2z" stroke={fg} strokeWidth="1.6" fill="none"/>],
  fg=>[<path key="a" d="M16 9h-1.2a6 6 0 1 0-5.4 8H16a4 4 0 0 0 0-8z" stroke={fg} strokeWidth="1.6" fill="none"/>],
  fg=>[<line key="a" x1="10" y1="2" x2="10" y2="18" stroke={fg} strokeWidth="1.6"/>,<line key="b" x1="4" y1="18" x2="16" y2="18" stroke={fg} strokeWidth="1.6"/>,<line key="c" x1="4"  y1="6" x2="16" y2="6" stroke={fg} strokeWidth="1.4"/>,<path key="d" d="M4 6L2 11h4z" stroke={fg} strokeWidth="1.2" fill="none"/>,<path key="e" d="M16 6L14 11h4z" stroke={fg} strokeWidth="1.2" fill="none"/>],
  fg=>[<rect key="a" x="2" y="7" width="16" height="7" rx="1.5" stroke={fg} strokeWidth="1.5" fill="none"/>,<line key="b" x1="5" y1="7" x2="5" y2="10" stroke={fg} strokeWidth="1.3"/>,<line key="c" x1="8" y1="7" x2="8" y2="11" stroke={fg} strokeWidth="1.3"/>,<line key="d" x1="11" y1="7" x2="11" y2="10" stroke={fg} strokeWidth="1.3"/>,<line key="e" x1="14" y1="7" x2="14" y2="11" stroke={fg} strokeWidth="1.3"/>],
  fg=>[<circle key="a" cx="6"  cy="6"  r="2" fill={fg}/>,<circle key="b" cx="14" cy="6"  r="2" fill={fg}/>,<circle key="c" cx="6"  cy="14" r="2" fill={fg}/>,<circle key="d" cx="14" cy="14" r="2" fill={fg}/>,<circle key="e" cx="10" cy="10" r="2" fill={fg}/>],
  fg=>[<circle key="a" cx="10" cy="3"  r="2" stroke={fg} strokeWidth="1.5" fill="none"/>,<circle key="b" cx="5"  cy="15" r="2" stroke={fg} strokeWidth="1.5" fill="none"/>,<circle key="c" cx="15" cy="15" r="2" stroke={fg} strokeWidth="1.5" fill="none"/>,<line key="d" x1="10" y1="5" x2="10" y2="10" stroke={fg} strokeWidth="1.4"/>,<line key="e" x1="10" y1="10" x2="5"  y2="13" stroke={fg} strokeWidth="1.4"/>,<line key="f" x1="10" y1="10" x2="15" y2="13" stroke={fg} strokeWidth="1.4"/>],
];
const iconFor = (name='') => { let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xffff; return h%ICONS.length; };

/* ═══ Tree builder ══════════════════════════════════════════════════ */
function buildTree(nodes) {
  if (!nodes.length) return [];
  const map = {};
  nodes.forEach(n => { map[n.name] = { ...n, children: [], depth: 0 }; });

  const root = nodes.find(n => n.isRoot)
    || nodes.find(n => !n.parent || /^none$/i.test(n.parent))
    || nodes[0];
  const rootName = root.name;

  nodes.forEach(n => {
    if (n.name === rootName) return;
    const raw = (n.parent || '').trim();
    if (!raw || /^none$/i.test(raw)) { if (map[rootName]) map[rootName].children.push(map[n.name]); return; }
    const parentNode = map[raw] || Object.values(map).find(m => m.name.toLowerCase() === raw.toLowerCase());
    if (parentNode && parentNode.name !== n.name) parentNode.children.push(map[n.name]);
    else if (map[rootName]) map[rootName].children.push(map[n.name]);
  });

  const assignDepth = (node, d) => { node.depth = d; node.children.forEach(c => assignDepth(c, d+1)); };
  if (map[rootName]) assignDepth(map[rootName], 0);
  return map[rootName] ? [map[rootName]] : [];
}

/* ═══ Layout ════════════════════════════════════════════════════════ */
function treeW(node) {
  const w = node.depth===0 ? RW : NW;
  if (!node.children.length) return w;
  return Math.max(w, node.children.reduce((s,c) => s+treeW(c), 0) + HGAP*(node.children.length-1));
}
function doLayout(roots) {
  const pos = [];
  let ox = 0;
  roots.forEach(root => {
    const w = treeW(root);
    place(root, ox, 0, w);
    ox += w + HGAP;
  });
  function place(node, ox, y, w) {
    const nw = node.depth===0 ? RW : NW;
    const nh = node.depth===0 ? RH : NH;
    pos.push({ node, x: ox + w/2 - nw/2, y, w: nw, h: nh });
    let cx = ox;
    node.children.forEach(c => { const cw=treeW(c); place(c, cx, y+nh+VGAP, cw); cx+=cw+HGAP; });
  }
  return pos;
}

/* ═══ SVG Node ══════════════════════════════════════════════════════ */
function SvgNode({ x, y, w, h, node, selectedName, onClick }) {
  const cfg = C[node.status] || C.not_started;
  const sel = selectedName === node.name;
  const score = node.score ?? node.prerequisiteScore;

  const CHARS = node.depth === 0 ? 22 : 18;
  const words = node.name.split(' ');
  const lines = [];
  let cur = '';
  for (const wd of words) {
    const test = cur ? cur + ' ' + wd : wd;
    if (test.length > CHARS && cur) {
      lines.push(cur);
      if (lines.length === 2) { break; }
      cur = wd;
    } else {
      cur = test;
    }
  }
  if (cur && lines.length < 2) lines.push(cur);
  if (lines.length === 2 && words.join(' ').length > lines.join(' ').length + 2) {
    lines[1] = lines[1].slice(0, CHARS - 1) + '…';
  }

  const iconEl = ICONS[iconFor(node.name)];
  const ibx = x + 10, iby = y + h / 2 - 16;
  const tx  = x + 52;
  const nameY  = lines.length > 1 ? y + h / 2 - 13 : y + h / 2 - 5;
  const badgeY = y + h / 2 + (lines.length > 1 ? 12 : 8);

  return (
    <g onClick={() => onClick(node)} style={{ cursor:'pointer' }}>
      {sel && <rect x={x-4} y={y-4} width={w+8} height={h+8} rx="16" fill="none" stroke={cfg.border} strokeWidth="3" opacity="0.4"/>}
      <rect x={x+2} y={y+4} width={w} height={h} rx="12" fill="rgba(0,0,0,0.055)"/>
      <rect x={x} y={y} width={w} height={h} rx="12" fill="#fff" stroke={cfg.border} strokeWidth={sel?2.2:1.7}/>
      <rect x={ibx} y={iby} width={32} height={32} rx="8" fill={cfg.iconBg}/>
      <g transform={`translate(${ibx+6},${iby+6})`}>
        <svg width="20" height="20" viewBox="0 0 20 20">{iconEl(cfg.iconFg)}</svg>
      </g>
      {lines.map((ln, i) => (
        <text key={i} x={tx} y={nameY + i * 14}
          style={{ fontSize: node.depth===0 ? '0.82rem' : '0.72rem', fontWeight:700, fill:'#1e1b4b', fontFamily:'Inter,sans-serif' }}>
          {ln}
        </text>
      ))}
      <rect x={tx} y={badgeY-9} width={48} height={17} rx="8" fill={cfg.badge}/>
      <text x={tx+24} y={badgeY+1} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize:'0.59rem', fontWeight:700, fill:cfg.badgeTxt, fontFamily:'Inter,sans-serif' }}>
        {cfg.label}
      </text>
      {typeof score === 'number' && (
        <text x={tx+55} y={badgeY+1} dominantBaseline="middle"
          style={{ fontSize:'0.72rem', fontWeight:700, fill:'#374151', fontFamily:'Inter,sans-serif' }}>
          {score}%
        </text>
      )}
    </g>
  );
}

/* ═══ SVG Edges ═════════════════════════════════════════════════════ */
function SvgEdges({ positions, posMap }) {
  return (
    <g>
      <defs>
        {Object.entries(C).map(([s,cfg]) => (
          <marker key={s} id={`arr-${s}`} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 z" fill={cfg.border}/>
          </marker>
        ))}
        <marker id="arr-cross" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L7,3 z" fill="#94a3b8"/>
        </marker>
      </defs>
      {positions.map(({ node, x, y, w, h }) =>
        (node.children||[]).map(child => {
          const cp = posMap[child.name]; if (!cp) return null;
          const cfg = C[child.status] || C.not_started;
          const x1=x+w/2, y1=y+h, x2=cp.x+cp.w/2, y2=cp.y, my=(y1+y2)/2;
          return (
            <path key={`e-${node.name}-${child.name}`}
              d={`M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`}
              fill="none" stroke={cfg.border} strokeWidth="1.8"
              markerEnd={`url(#arr-${child.status||'not_started'})`}/>
          );
        })
      )}
    </g>
  );
}

/* ═══ Detail Panel ══════════════════════════════════════════════════ */
function DetailPanel({ node, allNodes, weaknessData, onClose, onPractice, onQuizTopic }) {
  // ── All hooks MUST come before any early return (Rules of Hooks) ──
  const [aiData,    setAiData]    = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError,   setAiError]   = useState(null);

  // Fetch AI explanation whenever node changes
  useEffect(() => {
    if (!node) return;
    // Skip for statuses that don't need AI explanation
    if (node.status === 'strong' || node.status === 'current' || node.status === 'not_started') {
      setAiData(null);
      setAiError(null);
      return;
    }

    setAiData(null);
    setAiError(null);
    setAiLoading(true);

    const score    = node.score ?? node.prerequisiteScore;
    const siblings = (allNodes || [])
      .filter(n => n.name !== node.name && n.score != null)
      .slice(0, 5)
      .map(n => ({ name: n.name, status: n.status, score: n.score ?? n.prerequisiteScore }));

    console.log('[DetailPanel] Fetching explanation for:', node.name, node.status);

    fetch('http://localhost:5000/api/sessions/explain-node', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topicName:   node.name,
        parentTopic: (allNodes || []).find(n => n.isRoot)?.name || node.name,
        status:      node.status,
        score,
        siblings,
      }),
    })
      .then(r => r.json())
      .then(j => {
        console.log('[DetailPanel] explain-node response:', j);
        if (j.success) setAiData(j.data);
        else setAiError(j.message || 'Could not load explanation');
      })
      .catch(e => {
        console.error('[DetailPanel] explain-node fetch error:', e.message);
        setAiError('Network error — make sure backend is running');
      })
      .finally(() => setAiLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.name, node?.status]);

  // ── Now safe to early-return after all hooks ──
  if (!node) return null;

  const cfg   = C[node.status] || C.not_started;
  const score = node.score ?? node.prerequisiteScore;
  const iconEl = ICONS[iconFor(node.name)];

  const isNotStarted = node.status === 'not_started';
  const isStrong     = node.status === 'strong';

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'14px 16px 12px', borderBottom:'1.5px solid #f1f5f9', flexShrink:0 }}>
        <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#1e1b4b' }}>Topic Details</span>
        <button onClick={onClose} style={{ border:'none', background:'none', cursor:'pointer',
          fontSize:'1rem', color:'#9ca3af', padding:'2px 4px', lineHeight:1 }}>✕</button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:14, minHeight:0 }}>

        {/* Topic identity */}
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
          <div style={{ width:44, height:44, borderRadius:12, flexShrink:0, background:cfg.iconBg,
            border:`1.5px solid ${cfg.border}33`, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="22" height="22" viewBox="0 0 20 20">{iconEl(cfg.iconFg)}</svg>
          </div>
          <div style={{ minWidth:0, flex:1 }}>
            <p style={{ fontWeight:800, fontSize:'0.95rem', color:'#1e1b4b', margin:'0 0 5px',
              wordBreak:'break-word', overflowWrap:'break-word', lineHeight:1.35 }}>{node.name}</p>
            <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
              <span style={{ fontSize:'0.63rem', fontWeight:700, padding:'2px 8px', borderRadius:99,
                background:cfg.badge, color:cfg.badgeTxt, border:`1px solid ${cfg.border}44` }}>{cfg.label}</span>
              {typeof score==='number' && (
                <span style={{ fontSize:'0.75rem', fontWeight:600, color:'#6b7280' }}>{score}% Mastery</span>
              )}
            </div>
          </div>
        </div>

        {/* ─ STRONG: clean congrats card ─ */}
        {isStrong && (
          <div style={{ padding:'14px', borderRadius:12, background:'#f0fdf4', border:'1.5px solid #bbf7d0', textAlign:'center' }}>
            <div style={{ fontSize:'1.6rem', marginBottom:6 }}>✅</div>
            <p style={{ fontWeight:700, fontSize:'0.88rem', color:'#15803d', margin:'0 0 4px' }}>Well understood!</p>
            <p style={{ fontSize:'0.78rem', color:'#4ade80', margin:0, lineHeight:1.5 }}>
              You have a solid grasp of “{node.name}”. Keep practising to maintain your mastery.
            </p>
          </div>
        )}

        {/* ─ NOT STARTED: prompt to quiz ─ */}
        {isNotStarted && (
          <div style={{ padding:'14px', borderRadius:12, background:'#f8faff', border:'1.5px solid #e0e7ff' }}>
            <p style={{ fontWeight:700, fontSize:'0.82rem', color:'#4338ca', margin:'0 0 6px' }}>
              🎯 Not quizzed yet
            </p>
            <p style={{ fontSize:'0.78rem', color:'#6b7280', margin:0, lineHeight:1.6 }}>
              This topic hasn’t been individually tested. Taking a quiz will reveal your exact strengths and gaps here.
            </p>
          </div>
        )}

        {/* ─ LOADING AI explanation ─ */}
        {aiLoading && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[80,60,90,50].map((w,i) => (
              <div key={i} style={{ height:12, borderRadius:6, background:'#e2e8f0',
                width:`${w}%`, animation:'pulse 1.4s ease infinite' }} />
            ))}
            <p style={{ fontSize:'0.72rem', color:'#9ca3af', margin:0, textAlign:'center' }}>
              Ollama is analysing this topic…
            </p>
          </div>
        )}

        {/* ─ AI fetch error ─ */}
        {!aiLoading && aiError && (
          <div style={{ padding:'10px 12px', borderRadius:10, background:'#fef2f2',
            border:'1.5px solid #fecaca' }}>
            <p style={{ fontSize:'0.7rem', fontWeight:700, color:'#b91c1c', margin:'0 0 3px' }}>Could not load AI explanation</p>
            <p style={{ fontSize:'0.72rem', color:'#6b7280', margin:0 }}>{aiError}</p>
          </div>
        )}

        {/* ─ AI EXPLANATION (weak/partial nodes) ─ */}
        {!aiLoading && aiData && (
          <>
            {/* What is this topic */}
            {aiData.what && (
              <div style={{ padding:'12px 14px', borderRadius:12, background:'#f8faff', border:'1.5px solid #e0e7ff' }}>
                <p style={{ fontSize:'0.65rem', fontWeight:800, color:'#6366f1', textTransform:'uppercase',
                  letterSpacing:'0.07em', margin:'0 0 5px' }}>What is this topic?</p>
                <p style={{ fontSize:'0.8rem', color:'#374151', margin:0, lineHeight:1.6 }}>{aiData.what}</p>
              </div>
            )}

            {/* Concept explanation — the actual teaching content */}
            {aiData.explanation && (
              <div style={{ padding:'12px 14px', borderRadius:12, background:'#f0f9ff', border:'1.5px solid #bae6fd' }}>
                <p style={{ fontSize:'0.65rem', fontWeight:800, color:'#0284c7', textTransform:'uppercase',
                  letterSpacing:'0.07em', margin:'0 0 6px', display:'flex', alignItems:'center', gap:5 }}>
                  <span>📖</span> Explanation
                </p>
                <p style={{ fontSize:'0.8rem', color:'#374151', margin:0, lineHeight:1.7 }}>{aiData.explanation}</p>
              </div>
            )}

            {/* Why weak */}
            {aiData.whyWeak && (
              <div style={{ padding:'12px 14px', borderRadius:12,
                background: node.status==='weak' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)',
                border: `1.5px solid ${node.status==='weak' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                <p style={{ fontSize:'0.65rem', fontWeight:800,
                  color: node.status==='weak' ? '#dc2626' : '#b45309',
                  textTransform:'uppercase', letterSpacing:'0.07em', margin:'0 0 5px' }}>
                  Why {node.status==='weak' ? 'weak?' : 'partial?'}
                </p>
                <p style={{ fontSize:'0.8rem', color:'#374151', margin:0, lineHeight:1.6 }}>{aiData.whyWeak}</p>
              </div>
            )}

            {/* Gaps */}
            {aiData.gaps?.length > 0 && (
              <div>
                <p style={{ fontSize:'0.65rem', fontWeight:800, color:'#6366f1', textTransform:'uppercase',
                  letterSpacing:'0.07em', margin:'0 0 8px' }}>Knowledge Gaps</p>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {aiData.gaps.map((gap, i) => (
                    <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                      <div style={{ width:18, height:18, borderRadius:5, flexShrink:0,
                        background:'rgba(239,68,68,0.1)', border:'1.5px solid rgba(239,68,68,0.25)',
                        display:'flex', alignItems:'center', justifyContent:'center',
                        fontSize:'0.6rem', fontWeight:800, color:'#ef4444' }}>✕</div>
                      <p style={{ fontSize:'0.78rem', color:'#374151', margin:0, lineHeight:1.5, flex:1 }}>{gap}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Study steps */}
            {aiData.studySteps?.length > 0 && (
              <div>
                <p style={{ fontSize:'0.65rem', fontWeight:800, color:'#6366f1', textTransform:'uppercase',
                  letterSpacing:'0.07em', margin:'0 0 8px' }}>How to Fix It</p>
                {aiData.studySteps.map((step, i) => (
                  <div key={i} style={{ display:'flex', gap:10, marginBottom:8, alignItems:'flex-start' }}>
                    <div style={{ width:22, height:22, borderRadius:7, flexShrink:0,
                      background:'rgba(99,102,241,0.1)',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:'0.65rem', fontWeight:800, color:'#6366f1' }}>{i+1}</div>
                    <p style={{ fontSize:'0.78rem', color:'#374151', margin:0, lineHeight:1.55 }}>{step}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─ Ollama root-cause (from dep-graph analysis) ─ */}
        {weaknessData?.rootCause && !aiData && !aiLoading && (
          <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(239,68,68,0.04)',
            border:'1.5px solid rgba(239,68,68,0.15)' }}>
            <p style={{ fontSize:'0.68rem', fontWeight:700, color:'#b91c1c', margin:'0 0 4px',
              textTransform:'uppercase', letterSpacing:'0.06em' }}>Root Cause (Ollama)</p>
            <p style={{ fontSize:'0.76rem', color:'#374151', margin:0, lineHeight:1.6 }}>{weaknessData.rootCause}</p>
          </div>
        )}

        {/* Practice / Quiz buttons — always show Quiz This for any node */}
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
          <button
            onClick={() => onQuizTopic ? onQuizTopic(node.name) : onPractice && onPractice(node.name)}
            style={{
              width: '100%', padding: '13px', borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff',
              fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
          >
            <span style={{ fontSize: '1rem' }}>🎯</span>
            {isNotStarted ? 'Quiz This Topic Now' : 'Re-quiz This Topic'}
          </button>

          {/* Secondary: learning path navigation for already-tested nodes */}
          {!isNotStarted && onPractice && (
            <button
              onClick={() => onPractice(node.name)}
              style={{
                width: '100%', padding: '10px', borderRadius: 10,
                border: '1.5px solid rgba(99,102,241,0.25)',
                background: 'rgba(99,102,241,0.04)', color: '#6366f1',
                fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.09)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; }}
            >
              View Learning Path
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══ Legend ═══════════════════════════════════════════════════════ */
const LEGEND=[{s:'strong',icon:'✓',label:'Strong'},{s:'partial',icon:'!',label:'Partial'},{s:'weak',icon:'✗',label:'Weak'},{s:'not_started',icon:'○',label:'Not Started'},{s:'current',icon:'◉',label:'Current Topic'}];

/* ═══ Main exported component ══════════════════════════════════════ */
export default function DependencyGraph({ nodes=[], graphData=null, topicName='', weaknessData=null, onNavigatePractice, onQuizTopic, fullScreen=false }) {
  const [zoom, setZoom] = useState(1);
  const [selectedNode, setSelectedNode] = useState(null);
  const autoRef = useRef(false);

  const { positions, posMap, rootNode } = useMemo(() => {
    if (!nodes.length) return { positions:[], posMap:{}, rootNode:null };
    const roots = buildTree(nodes);
    if (!roots.length) return { positions:[], posMap:{}, rootNode:null };
    const pos = doLayout(roots);
    const pm = {};
    pos.forEach(p => { pm[p.node.name]=p; });
    return { positions:pos, posMap:pm, rootNode:roots[0] };
  }, [nodes]);

  useEffect(() => {
    if (!autoRef.current && rootNode) {
      setSelectedNode(rootNode);
      autoRef.current = true;
    }
  }, [rootNode]);

  const handleClick = useCallback(node => {
    setSelectedNode(prev => prev?.name===node.name ? null : node);
  }, []);

  if (!positions.length) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#9ca3af', fontSize:'0.9rem' }}>
      No prerequisite graph data available for this topic yet.
    </div>
  );

  /* SVG canvas — center tree horizontally */
  const minX = Math.min(...positions.map(p=>p.x));
  const maxX = Math.max(...positions.map(p=>p.x+p.w));
  const maxY = Math.max(...positions.map(p=>p.y+p.h));
  const treeW = maxX - minX;
  const treeH = maxY;
  // canvas dimensions at zoom=1
  const canvasW = Math.max(760, treeW + PAD * 2);
  const canvasH = Math.max(400, treeH + PAD * 2);
  // SVG pixel dimensions (scaled by zoom)
  const svgW = canvasW * zoom;
  const svgH = canvasH * zoom;
  // translate so tree is centred in canvas, then scale
  const dx = ((canvasW - treeW) / 2 - minX) * zoom;
  const dy = PAD * zoom;

  const weakCount   = nodes.filter(n=>n.status==='weak'||n.status==='current').length;
  const partialCount= nodes.filter(n=>n.status==='partial').length;

  /* ── Single-node case: no prerequisites found ─────────────── */
  if (positions.length === 1) {
    const p = positions[0];
    const cfg = C[p.node.status] || C.not_started;
    const iconEl = ICONS[iconFor(p.node.name)](cfg.iconFg);
    return (
      <div style={{ display:'flex', width:'100%', height:'100%', background:'#f8fafc', overflow:'hidden' }}>
        {/* Centered graph area */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
          justifyContent:'center', gap:18, padding:'32px 24px', minWidth:0, overflow:'hidden' }}>
          {/* Root node card */}
          <div style={{
            display:'flex', alignItems:'center', gap:14,
            padding:'18px 28px', borderRadius:18, background:'#fff',
            border:`2px solid ${cfg.border}55`,
            boxShadow:`0 4px 20px ${cfg.border}22, 0 1px 4px rgba(0,0,0,0.06)`,
          }}>
            <div style={{ width:48, height:48, borderRadius:13, flexShrink:0, background:cfg.iconBg,
              border:`1.5px solid ${cfg.border}44`, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <svg width="24" height="24" viewBox="0 0 20 20">{iconEl}</svg>
            </div>
            <div>
              <p style={{ fontWeight:800, fontSize:'1.05rem', color:'#0f172a', margin:'0 0 6px' }}>{p.node.name}</p>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'3px 9px', borderRadius:99,
                  background:cfg.badge, color:cfg.badgeTxt }}>{cfg.label}</span>
                {p.node.score != null && (
                  <span style={{ fontSize:'0.78rem', fontWeight:700, color:cfg.iconFg }}>{p.node.score}% Mastery</span>
                )}
              </div>
            </div>
          </div>

          {/* Helpful message */}
          <div style={{ textAlign:'center', maxWidth:380 }}>
            <p style={{ fontSize:'0.82rem', fontWeight:600, color:'#374151', margin:'0 0 6px' }}>
              No prerequisite connections yet
            </p>
            <p style={{ fontSize:'0.75rem', color:'#9ca3af', margin:0, lineHeight:1.65 }}>
              Quiz more subtopics in this syllabus to build a full prerequisite graph.
              The right panel shows Ollama's analysis based on your current score.
            </p>
          </div>
        </div>

        {/* Detail panel — fixed width, fully contained */}
        <div style={{
          width: 320, flexShrink: 0,
          borderLeft: '1.5px solid #e8eaef',
          background: '#fff',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: '-4px 0 20px rgba(0,0,0,0.06)',
        }}>
          <DetailPanel
            key={p.node.name}
            node={p.node}
            allNodes={nodes}
            weaknessData={weaknessData}
            onClose={() => {}}
            onPractice={onNavigatePractice}
            onQuizTopic={onQuizTopic}
          />
        </div>
      </div>
    );
  }

  /* Outer wrapper fills what it's given */
  return (
    <div style={{
      display:'flex', flexDirection:'column',
      width:'100%', height:'100%',
      background:'#f8fafc', overflow:'hidden',
    }}>

      {/* ── Info banner ── */}
      {topicName && (weakCount>0||partialCount>0) && (
        <div style={{
          flexShrink:0, margin:'12px 16px 0', display:'flex', alignItems:'flex-start', gap:10,
          padding:'10px 14px', borderRadius:10, background:'#eef2ff', border:'1.5px solid rgba(99,102,241,0.2)',
        }}>
          <div style={{ width:26, height:26, borderRadius:7, flexShrink:0, background:'rgba(99,102,241,0.12)',
            display:'flex', alignItems:'center', justifyContent:'center' }}>
            <svg width="12" height="12" viewBox="0 0 20 20" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round">
              <circle cx="10" cy="10" r="9"/><line x1="10" y1="6" x2="10" y2="10"/><circle cx="10" cy="14" r="1" fill="#6366f1"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize:'0.8rem', fontWeight:700, color:'#1e1b4b', margin:'0 0 1px' }}>
              This graph shows why you are finding &ldquo;{topicName}&rdquo; difficult.
            </p>
            <p style={{ fontSize:'0.72rem', color:'#6b7280', margin:0 }}>Click on any node to see detailed analysis and recommendations.</p>
          </div>
        </div>
      )}

      {/* ── Graph + Panel row (fills remaining height) ── */}
      <div style={{ flex:1, display:'flex', minHeight:0, overflow:'hidden' }}>

        {/* ── LEFT: scrollable graph canvas ── */}
        <div style={{ flex:1, position:'relative', overflow:'auto', minWidth:0 }}>

          {/* Zoom controls — sticky top-left */}
          <div style={{ position:'sticky', top:14, left:14, zIndex:20, width:0, height:0 }}>
            <div style={{ position:'absolute', display:'flex', flexDirection:'column', gap:6, top:0, left:0 }}>
              {[
                { lbl:'+', fn:()=>setZoom(z=>Math.min(z+0.15,2.5)) },
                { lbl:'−', fn:()=>setZoom(z=>Math.max(z-0.15,0.4)) },
                { lbl:<svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="#6b7280" strokeWidth="2"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4"/></svg>, fn:()=>setZoom(1) },
              ].map(({lbl,fn},i)=>(
                <button key={i} onClick={fn} style={{
                  width:34, height:34, borderRadius:9, border:'1.5px solid #e2e8f0',
                  background:'#fff', cursor:'pointer', fontFamily:'inherit',
                  fontSize:'1.1rem', fontWeight:700, color:'#374151',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  boxShadow:'0 2px 8px rgba(0,0,0,0.07)',
                }}>{lbl}</button>
              ))}
            </div>
          </div>

          {/* SVG tree */}
          <svg
            width={svgW} height={svgH}
            style={{ display:'block', background:'linear-gradient(135deg,#f8faff 0%,#eef2ff 100%)' }}
          >
            <defs>
              {Object.entries(C).map(([s,cfg])=>(
                <marker key={s} id={`arr-${s}`} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L7,3 z" fill={cfg.border}/>
                </marker>
              ))}
            </defs>
            <g transform={`translate(${dx},${dy}) scale(${zoom})`}>
              <SvgEdges positions={positions} posMap={posMap}/>
              {positions.map(({node,x,y,w,h})=>(
                <SvgNode key={node.name} x={x} y={y} w={w} h={h}
                  node={{...node, score:node.score??node.prerequisiteScore}}
                  selectedName={selectedNode?.name}
                  onClick={handleClick}/>
              ))}
            </g>
          </svg>
        </div>

        {/* ── RIGHT: detail panel — fixed 320 px, fully contained ── */}
        {selectedNode && (
          <div style={{
            width: 320, flexShrink: 0,
            borderLeft: '1.5px solid #e8eaef',
            background: '#fff',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '-4px 0 20px rgba(0,0,0,0.06)',
          }}>
            <DetailPanel
              key={selectedNode.name}
              node={{...selectedNode, score:selectedNode.score??selectedNode.prerequisiteScore}}
              allNodes={nodes.map(n=>({...n, score:n.score??n.prerequisiteScore}))}
              weaknessData={weaknessData}
              onClose={()=>setSelectedNode(null)}
              onPractice={onNavigatePractice}
              onQuizTopic={onQuizTopic}
            />
          </div>
        )}
      </div>

      {/* ── Legend strip ── */}
      <div style={{
        flexShrink:0, display:'flex', gap:20, justifyContent:'center', flexWrap:'wrap',
        padding:'8px 16px', borderTop:'1.5px solid #f1f5f9', background:'#fff',
      }}>
        {LEGEND.map(({s,icon,label})=>{
          const cfg=C[s];
          return (
            <div key={s} style={{ display:'flex', alignItems:'center', gap:7 }}>
              <div style={{ width:22, height:22, borderRadius:'50%', background:cfg.dot,
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                <span style={{ fontSize:'0.58rem', fontWeight:900, color:'#fff' }}>{icon}</span>
              </div>
              <span style={{ fontSize:'0.74rem', color:'#6b7280', fontWeight:500 }}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
