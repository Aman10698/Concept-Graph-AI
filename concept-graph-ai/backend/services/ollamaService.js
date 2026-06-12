/**
 * AI Service — Powered by Ollama (local LLM)
 * Calls http://localhost:11434 using the Ollama REST API.
 * All exported function signatures are identical to the old Gemini version
 * so no other file needs to change.
 */

const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

/* ─── low-level generate call ───────────────────────────────────────────── */
const generateText = async (prompt, options = {}) => {
  const body = {
    model: options.model || OLLAMA_MODEL,
    prompt,
    stream: false,
    // ⚠️  context: null suppresses Ollama's token-context array in the response.
    // Without this, Ollama sends back a `context` field with thousands of integers
    // (one per token in the context window) — this can be 200 KB+ per call and
    // accumulates rapidly in the worker heap when making many sequential calls.
    context: null,
    options: {
      temperature: options.temperature ?? 0.6,
      num_predict: options.numPredict ?? 800,  // cap default; callers set higher if needed
      top_p: options.topP ?? 0.9,
    },
  };

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${txt.slice(0, 200)}`);
  }

  const json = await res.json();
  // Only return the response text — discard context, stats, timings from the JSON
  const text = (json.response || '').trim();
  // Explicitly null out the parsed object to help V8 GC reclaim it
  json.context = null;
  return text;
};

/* ─── connection test ────────────────────────────────────────────────────── */
const testOllamaConnection = async () => {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) return false;
    const json = await res.json();
    const models = (json.models || []).map(m => m.name);
    console.log('✅ Ollama running. Available models:', models.join(', '));
    return models.some(m => m.startsWith(OLLAMA_MODEL.split(':')[0]));
  } catch {
    return false;
  }
};

/* ─── JSON extractor ─────────────────────────────────────────────────────── */
const extractJSON = (text) => {
  try { return JSON.parse(text); } catch (_) { /* fall through */ }
  const stripped = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch (_) { /* fall through */ }
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (_) { /* fall through */ } }
  return null;
};

/* ─── Heading outline pre-extractor ──────────────────────────────────────────────
 * Converts raw syllabus text into a compact heading-only outline.
 * A syllabus with 6 modules × 10 topics = ~60 lines × ~40 chars = ~2,400 chars.
 * Sending the outline instead of the full 40,000-char document means the LLM
 * only sees ~3,000 chars of input — well within any local model's context window.
 * Without this, llama3.1's 8,192-token context is exhausted by the document itself
 * and later modules are simply invisible to the model.
 ────────────────────────────────────────────────────────────── */
const extractHeadingOutline = (rawText) => {
  // Work line-by-line on the original text (preserves indentation signals)
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 2 && l.length <= 150);

  // Lines to skip — pedagogical noise, never topic names
  const NOISE = [
    /^(let'?s\s+(do|think|discuss|recall|explore))/i,
    /^do\s+this/i,
    /^activity\b/i,
    /^exercise\b/i,
    /^questions?$/i,
    /^note\s*:/i,
    /^figure\b/i,
    /^table\b/i,
    /^example\b/i,
    /^story\b/i,
    /^dialogue\b/i,
    /^references?$/i,
    /^bibliography/i,
    /^course\s+outcome/i,
    /^learning\s+objective/i,
    /^assessment\s+(scheme|pattern)/i,
    /^examination\s+(scheme|pattern)/i,
  ];
  const isNoise = (l) => NOISE.some(rx => rx.test(l));

  const isHeading = (l) => {
    if (isNoise(l)) return false;
    // 1. Numbered items — "1.", "1.1", "2.3.4", "I.", "II."
    if (/^\d+(\.\d+)*\.?\s+\S/.test(l)) return true;
    // 2. Roman numerals — "I.", "II.", "III.", "IV."
    if (/^(I{1,3}|IV|V?I{0,3})\.[\s).]/.test(l)) return true;
    // 3. Lettered items — "a.", "b)", "A.", "B)"
    if (/^[a-zA-Z][\.)\s]\s+\S/.test(l) && l.length <= 100) return true;
    // 4. MODULE / UNIT / CHAPTER / SECTION keyword
    if (/^(module|unit|chapter|section|part|topic|lesson)\s+[\d\w]/i.test(l)) return true;
    // 5. ALL-CAPS short heading — "INTRODUCTION TO AI"
    if (/^[A-Z][A-Z\s]{3,60}$/.test(l)) return true;
    // 6. Title Case phrase followed by colon — "Search Algorithms:"
    if (/^[A-Z][a-zA-Z\s]+:$/.test(l) && l.length <= 80) return true;
    // 7. Short Title Case line (no sentence-ending period)
    if (/^[A-Z][a-z]/.test(l) && !l.endsWith('.') && l.length <= 80) return true;
    // 8. Bullet / dash / star list items
    if (/^[\u2022\-\*•]\s+\S/.test(l) && l.length <= 100) return true;
    return false;
  };

  // Collect ALL matching heading lines — no per-scan break so we get every module
  const outline = [];
  let charCount = 0;
  const MAX_CHARS = 12000; // enough for 300+ topic lines

  // Always include the very first non-empty line (document title / course name)
  if (lines[0]) { outline.push(lines[0]); charCount += lines[0].length + 1; }

  for (let i = 1; i < lines.length; i++) {
    if (charCount >= MAX_CHARS) break;
    if (isHeading(lines[i])) {
      outline.push(lines[i]);
      charCount += lines[i].length + 1;
    }
  }

  return outline.join('\n');
};

/* ═══════════════════════════════════════════════════════════════════════════
   1. TOPIC EXTRACTION
══════════════════════════════════════════════════════════════════════════════ */
/**
 * Normalize a topic/subtopic name for deduplication comparison.
 * Strips numbered prefixes (1.1, 1., etc.), lowercases, collapses spaces.
 */
const normalizeName = (name) => {
  if (!name || typeof name !== 'string') return '';
  return name
    .replace(/^\s*[\d]+([.][\d]*)?\.?\s*/, '')  // strip leading "1." / "1.1" / "1.1."
    .replace(/^\s*[•\-*]\s*/, '')                 // strip leading bullet
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')                  // non-alphanum → space
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Deduplicate topics by normalized name, merge subtopics from duplicates.
 * Also deduplicates subtopics globally so the same concept only appears under ONE topic.
 */
const deduplicateTopics = (topics) => {
  if (!Array.isArray(topics)) return topics;

  // Step 1: Merge topic-level duplicates (same normalized name)
  const topicMap = new Map(); // normalizedName → merged topic object
  for (const t of topics) {
    const rawName = typeof t === 'string' ? t : (t.name || '');
    const key = normalizeName(rawName);
    if (!key) continue;
    if (topicMap.has(key)) {
      // Merge subtopics into existing entry
      const existing = topicMap.get(key);
      const newSubs = Array.isArray(t.subtopics) ? t.subtopics : [];
      existing.subtopics = [
        ...(existing.subtopics || []),
        ...newSubs,
      ];
    } else {
      topicMap.set(key, {
        name: rawName,
        description: t.description || '',
        subtopics: Array.isArray(t.subtopics) ? [...t.subtopics] : [],
      });
    }
  }

  // Step 2: Deduplicate subtopics within each topic
  const mergedTopics = Array.from(topicMap.values()).map(t => ({
    ...t,
    subtopics: (() => {
      const seen = new Set();
      return (t.subtopics || []).filter(s => {
        const sName = typeof s === 'string' ? s : (s?.name || '');
        const key = normalizeName(sName);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    })(),
  }));

  // Step 3: Remove subtopics that appear in MORE than one topic — keep only in first occurrence
  const globalSubtopicSeen = new Set();
  const result = mergedTopics.map(t => ({
    ...t,
    subtopics: (t.subtopics || []).filter(s => {
      const sName = typeof s === 'string' ? s : (s?.name || '');
      const key = normalizeName(sName);
      if (!key || globalSubtopicSeen.has(key)) return false;
      globalSubtopicSeen.add(key);
      return true;
    }),
  }));

  // Keep ALL topics — even those that end up with no subtopics — so they render in the mind map
  return result;
};

/* ─── helpers for new prompt output ────────────────────────────────────── */

/**
 * Convert the flat { nodes[], edges[] } format returned by the prompt
 * back into the nested { topics: [{ name, subtopics[] }] } format.
 */
const flatNodesToTopicsData = (nodes, edges) => {
  // Build adjacency: parentId → [childId, ...]
  const children = {};
  for (const e of (edges || [])) {
    if (!children[e.source]) children[e.source] = [];
    children[e.source].push(e.target);
  }

  const nodeMap = {};
  for (const n of (nodes || [])) nodeMap[n.id] = n;

  // Find root nodes (not a target in any edge)
  const targetIds = new Set((edges || []).map(e => e.target));
  const rootIds = (nodes || []).map(n => n.id).filter(id => !targetIds.has(id));
  const buildSubtopics = (id, depth = 0) => {
    if (depth > 5) return [];
    const kids = children[id] || []; // NO artificial child limit
    return kids.map(cid => ({
      name: nodeMap[cid]?.label || cid,
      subtopics: buildSubtopics(cid, depth + 1),
    }));
  };

  // If there's exactly one root, treat its children as top-level topics (modules)
  if (rootIds.length === 1) {
    const rootId = rootIds[0];
    const rootNode = nodeMap[rootId];
    const topLevel = children[rootId] || []; // NO artificial limit
    if (topLevel.length > 0) {
      return {
        chapterTitle: rootNode?.label || '',
        topics: topLevel.map(id => ({
          name: nodeMap[id]?.label || id,
          description: '',
          subtopics: buildSubtopics(id, 1),
        })),
      };
    }
    return {
      chapterTitle: rootNode?.label || '',
      topics: [{ name: rootNode?.label || 'Chapter', description: '', subtopics: [] }],
    };
  }

  // Multiple roots — each root is a top-level topic
  return {
    chapterTitle: '',
    topics: rootIds.map(id => ({
      name: nodeMap[id]?.label || id,
      description: '',
      subtopics: buildSubtopics(id, 1),
    })),
  };
};

/* ─── Admin / noise patterns ─────────────────────────────────────────────────
 * Lines matching any of these are never included as module or topic nodes.
 * ──────────────────────────────────────────────────────────────────────────── */
const ADMIN_RX = [
  /^course\s+outcome/i, /^learning\s+obj/i,
  /^assessment/i, /^examination/i, /^evaluation/i,
  /^references?\s*$/, /^bibliography/i, /^attendance/i,
  /^faculty/i, /^textbook/i, /^credit/i,
  /^written\s+exam/i, /^seminar/i, /^summary\s*$/i, /^glossary\s*$/i,
  /^total\s+(marks|hours?)/i, /^course\s+(code|title)/i,
  /^prerequisite/i, /^modes?\s+of\s+eval/i, /^further\s+reading/i,
  /^(t\s+p\s+c|theory|practical|credits?)\s*$/i,
  /^(ia|ee|ia\s*ee|ese)\s*$/i,
  /^(components?|weightage|marks)\s*$/i,
  /^(co-?requisites?|pre-?requisites?\/exposure)/i,
  /^catalog\s+description/i,
  /^(the\s+)?objective\s+of\s+this\s+course/i,
  /^on\s+completion\s+of/i, /^version\s*:/i,
  /^date\s+of\s+(approval|revision)/i, /^approved\s+by/i,
  /^\bco\s*-?\s*\d+\b/i,
];
const isAdminLine = l => ADMIN_RX.some(rx => rx.test((l || '').trim()));

/* ─── Stop-extraction triggers (reference / grading sections) ─────────────── */
const STOP_RX = [
  /^references?\s*$/i, /^bibliography\s*$/i,
  /^(text\s*)?books?\s*(reference|:)?\s*$/i,
  /^suggested\s+(reading|books?)/i, /^additional\s+reading/i,
  /^course\s+outcomes?/i, /^learning\s+objectives?/i,
  /^evaluation\s+(scheme|pattern)/i, /^examination\s+(scheme|pattern)/i,
  /^components?\s+[a-z]/i, /^weightage/i, /^attendance/i,
  /^overall\s+[\d.]/i, /^all:\s*attendance/i,
  /^modes?\s+of\s+eval/i,             // "Modes of Evaluation"
  /^bloom['s]*\s+taxonomy/i,           // Bloom's Taxonomy header
];
const isStop = l => STOP_RX.some(rx => rx.test((l || '').trim()));

/* ─── LLM meta-commentary patterns (preamble lines the model adds) ─────────── */
const LLM_META_RX = [
  /^here are/i, /^here is/i, /^below are/i, /^the following/i,
  /^these are/i, /^based on/i, /^sure[,!]?$/i, /^certainly/i,
  /^of course/i, /^note:/i, /^please note/i, /^the topics?/i,
  /^topic names?/i, /^list of topics?/i, /^topics? for/i,
  /^topics? in\b/i, /^topics? taught/i, /^i['\u2019]ll/i,
];
const isLLMMeta = l => LLM_META_RX.some(rx => rx.test((l || '').trim()));

/* ─── Bloom's taxonomy / course-outcome level markers ──────────────────────── */
// These appear in syllabuses as "L1", "L2", "L1 and L2", "CO1 L2" etc.
const isBloomLevel = l => /^(l\s*\d+)(\s+(and|&)\s+l\s*\d+)*\s*$/i.test((l || '').trim()) ||
                         /^(co\s*\d+\s*)+l\s*\d+/i.test((l || '').trim());

/* ─── JS-first course title extractor (no LLM needed for this) ─────────────── */
const extractSubjectNameJS = (rawText) => {
  const stripCode = s => (s || '')
    .replace(/^[A-Z]{2,6}[-\s]?\d{3,6}\s*/i, '')
    .replace(/^\d{3,6}[A-Z]{0,4}\s*/i, '')
    .replace(/[,;:]+$/, '').trim() || s;

  // Scan first 30 lines for a course-title candidate
  const lines = rawText.replace(/\r\n/g, '\n').split('\n')
    .slice(0, 30).map(l => l.trim()).filter(l => l.length >= 4);

  for (const line of lines) {
    if (isAdminLine(line) || isStop(line)) continue;
    if (/^module\s+\d/i.test(line)) break;  // reached syllabus body — stop
    if (/^(version|date|approved|catalog|co-?req)/i.test(line)) continue;
    if (/\d{4}/.test(line) && line.length < 20) continue;  // year-only lines
    // Accept ALL-CAPS or Title-Case line of reasonable length
    const candidate = stripCode(line);
    if (candidate.length >= 4 && candidate.length <= 80 &&
        !isAdminLine(candidate) && !isStop(candidate) &&
        /[a-zA-Z]{3}/.test(candidate)) {
      return candidate;
    }
  }
  return '';
};

/* ─── Split the full syllabus text into per-module sections ───────────────── */
const splitIntoModuleSections = text => {
  const EXPLICIT_RX = /^(module|unit|chapter|section|part)\s*[-\u2013]?\s*\d+/i;
  const ALLCAPS_RX  = /^[A-Z][A-Z\s\-\/&]{3,55}$/;
  const toTitle = s => s.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const allLines = text.replace(/\r\n/g, '\n').split('\n').map(l => l.trim());

  const starts = [];
  for (let i = 0; i < allLines.length; i++) {
    if (EXPLICIT_RX.test(allLines[i]) && !isAdminLine(allLines[i])) starts.push(i);
  }
  if (starts.length < 2) return null;

  return starts.map((s, mi) => {
    const e   = starts[mi + 1] || allLines.length;
    const hdr = allLines[s];
    const m   = hdr.match(/^(module|unit|chapter|section|part)\s*[-\u2013]?\s*(\d+)\s*[:\-\u2013]?\s*(.*)/i);
    let name;
    if (m) {
      const kw     = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      const inline = m[3] ? toTitle(m[3].trim()) : '';
      if (!inline) {
        // Scan ahead (up to 5 lines) for an ALL-CAPS subtitle, skipping blank lines
        let subtitle = '';
        for (let k = s + 1; k < Math.min(s + 6, e); k++) {
          const candidate = (allLines[k] || '').trim();
          if (!candidate) continue;                    // skip blank lines
          if (ALLCAPS_RX.test(candidate)) { subtitle = toTitle(candidate); break; }
          break; // non-blank, non-ALL-CAPS → stop looking
        }
        name = subtitle ? (kw + ' ' + m[2] + ': ' + subtitle) : (kw + ' ' + m[2]);
      } else {
        name = kw + ' ' + m[2] + ': ' + inline;
      }
    } else { name = hdr || 'Module'; }
    // Stop content at first reference/grading line
    const contentLines = allLines.slice(s + 1, e);
    let stopAt = contentLines.length;
    for (let ci = 0; ci < contentLines.length; ci++) {
      if (isStop(contentLines[ci])) { stopAt = ci; break; }
    }
    return { name, content: contentLines.slice(0, stopAt).join('\n') };
  });
};

/* ─── Clean a raw concept string before storing ───────────────────────────── */
const cleanConcept = s => (s || '').trim()
  .replace(/^[\-*•\d.)\s]+/, '')
  .replace(/[.,:;]+$/, '')
  .trim();

const isValidConcept = s => {
  if (!s || s.length < 3 || s.length > 100) return false;
  if (isAdminLine(s) || isStop(s) || isLLMMeta(s) || isBloomLevel(s)) return false;
  if (/\b(pearson|wiley|mcgraw|oxford|cambridge|prentice|tata|phi|tmh|springer)\b/i.test(s)) return false;
  if (/^['\u2018\u2019\u201c\u201d]/.test(s)) return false;
  if ((s.match(/\d/g)||[]).length / s.length > 0.35) return false;
  if (/^(module|unit|chapter|section|part)\s+\d+/i.test(s)) return false;
  return true;
};

/* ─── Ask Ollama to extract ALL concepts from ONE module ─────────────────────
 * Uses a hierarchical JSON prompt so the model is forced to enumerate EVERY
 * teachable concept: headings, subheadings, tools, methods, types, processes,
 * classifications, key terms — not just top-level section names.
 *
 * Falls back to plain-text line parsing if JSON is malformed.
 * ──────────────────────────────────────────────────────────────────────────── */
const extractModuleTopicsWithLLM = async (moduleName, moduleContent) => {
  const contentSlice = moduleContent.slice(0, 3000);

  const prompt =
`You are an expert at extracting teachable concepts from academic content.

Analyze the module below and extract EVERY teachable concept.

Include:
- Section headings and subheadings
- Named methods, tools, algorithms
- Types and classifications
- Processes and techniques
- Key terms and named concepts
- Anything a student would need to learn

Exclude:
- Reference books, authors, publishers
- Marks, hours, weightage, attendance
- Course outcomes (CO1, CO2) and Bloom levels (L1, L2)

CRITICAL: Do NOT summarize. Do NOT merge. Every concept gets its own entry.
Missing a concept is a failure.

Return ONLY valid JSON — no explanation, no markdown fences:
{
  "topics": [
    {
      "name": "Main Section or Topic Name",
      "subtopics": ["Subtopic A", "Method B", "Tool C", "Type D"]
    }
  ]
}

Module: ${moduleName}
Content:
${contentSlice}`;

  try {
    const raw = await generateText(prompt, { temperature: 0.1, numPredict: 1200 });

    // ── Try JSON parse ─────────────────────────────────────────────────────
    const parsed = extractJSON(raw);

    if (parsed && Array.isArray(parsed.topics) && parsed.topics.length > 0) {
      const seen = new Set();
      const result = [];

      for (const t of parsed.topics) {
        const topicName = cleanConcept(typeof t === 'string' ? t : (t.name || ''));
        if (!isValidConcept(topicName)) continue;
        const k = topicName.toLowerCase().replace(/\s+/g, ' ');
        if (seen.has(k)) continue;
        seen.add(k);

        const subtopics = Array.isArray(t.subtopics)
          ? t.subtopics
              .map(s => cleanConcept(typeof s === 'string' ? s : (s.name || s)))
              .filter(isValidConcept)
              .filter(s => {
                const sk = s.toLowerCase().replace(/\s+/g, ' ');
                if (seen.has(sk)) return false;
                seen.add(sk);
                return true;
              })
              .map(name => ({ name, subtopics: [] }))
          : [];

        result.push({ name: topicName, subtopics });
      }

      console.log(`  JSON OK: ${result.length} topics, ${result.reduce((a,t)=>a+t.subtopics.length,0)} subtopics`);
      return result;
    }

    // ── JSON failed → line-by-line fallback ────────────────────────────────
    console.warn('  JSON parse failed for', moduleName, '— using line fallback');
    const seen2 = new Set();
    return raw
      .split('\n')
      .map(l => cleanConcept(l))
      .filter(isValidConcept)
      .filter(l => {
        const k = l.toLowerCase().replace(/\s+/g, ' ');
        if (seen2.has(k)) return false;
        seen2.add(k);
        return true;
      })
      .map(name => ({ name, subtopics: [] }));

  } catch (err) {
    console.error('LLM extraction failed for', moduleName, ':', err.message);
    return [];
  }
};

/* ─── Fallback: heading outline parser (when no MODULE N markers found) ──── */
const parseOutlineIntoHierarchy = outline => {
  const raw = outline.split('\n').map(l => l.trim()).filter(l => l.length > 1);
  const EXPLICIT_RX = /^(module|unit|chapter|section|part)\s*[-\u2013]?\s*\d+/i;
  const NUMBERED_RX = /^\d+\.\s+[A-Za-z]/;
  const ALLCAPS_RX  = /^[A-Z][A-Z\s\-\/&]{3,55}$/;
  const toTitle = s => s.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  const strip = l => l
    .replace(/^(module|unit|chapter|section|part|topic|lesson)\s*[-\u2013]?\s*\d+\s*[:\-\u2013]?\s*/i,'')
    .replace(/^\d+(\.\d+)*\.?\s+/,'').replace(/^[IVXLC]+\.\s+/i,'')
    .replace(/^[a-zA-Z][.)\s]\s+/,'').replace(/^[\-\*\u2022]\s+/,'')
    .replace(/[,;:]+$/,'').trim();
  const isSub = l => {
    if (isAdminLine(l)) return false;
    return /^\d+\.\d+/.test(l) ||
           (/^[a-zA-Z][.)\s]\s+\w/.test(l) && l.length<=100) ||
           (/^[\-\*\u2022]\s+\w/.test(l) && l.length<=100);
  };
  const clean = raw.filter(l => !isAdminLine(l));
  const expCt = clean.filter(l => EXPLICIT_RX.test(l)).length;
  const numCt = clean.filter(l => NUMBERED_RX.test(l) && !/^\d+\.\d+/.test(l)).length;
  const capCt = clean.filter(l => ALLCAPS_RX.test(l)).length;
  const mode  = expCt>=2?'explicit': numCt>=2?'numbered': (capCt>=2&&capCt<=12)?'allcaps':'flat';
  console.log('Outline parser mode:', mode, '(exp='+expCt+',num='+numCt+',cap='+capCt+')');
  const buildName = line => {
    if (mode==='explicit') {
      const m = line.match(/^(module|unit|chapter|section|part)\s*[-\u2013]?\s*(\d+)\s*[:\-\u2013]?\s*(.*)/i);
      if (m) { const kw=m[1].charAt(0).toUpperCase()+m[1].slice(1).toLowerCase(); const inline=m[3]?toTitle(m[3].trim()):''; return inline?(kw+' '+m[2]+': '+inline):(kw+' '+m[2]); }
    }
    const s=strip(line)||line; return ALLCAPS_RX.test(s)?toTitle(s):s;
  };
  const isModLine = l => {
    if (isAdminLine(l)) return false;
    if (mode==='explicit') return EXPLICIT_RX.test(l);
    if (mode==='numbered') return NUMBERED_RX.test(l)&&!/^\d+\.\d+/.test(l);
    if (mode==='allcaps')  return ALLCAPS_RX.test(l);
    return false;
  };
  const modules=[]; let cur=null, waitSub=false;
  for (const line of clean) {
    if (mode==='flat') {
      if (!cur) { cur={name:'Topics',description:'',subtopics:[]}; modules.push(cur); }
      const n=strip(line)||line; if(n.length>=2) cur.subtopics.push({name:n,subtopics:[]}); continue;
    }
    if (isModLine(line)) {
      const name=buildName(line); if(!name||name.length<2) continue;
      cur={name,description:'',subtopics:[]}; modules.push(cur); waitSub=(mode==='explicit');
    } else if (waitSub&&ALLCAPS_RX.test(line)) {
      if(cur&&!cur.name.includes(':')) cur.name+=': '+toTitle(line); waitSub=false;
    } else if (ALLCAPS_RX.test(line)&&mode!=='allcaps') { waitSub=false; }
    else {
      waitSub=false; if(!cur) continue;
      if(isSub(line)) { const n=strip(line)||line; if(n.length>=2) cur.subtopics.push({name:n,subtopics:[]}); }
      else if(/^[A-Z]/.test(line)&&!line.endsWith('.')&&line.length>=3&&line.length<=120) { const n=strip(line)||line; if(n.length>=3) cur.subtopics.push({name:n,subtopics:[]}); }
    }
  }
  if (modules.length===0) {
    const fb={name:'Course Topics',description:'',subtopics:[]};
    clean.forEach(l=>{ const n=strip(l)||l; if(n.length>=3) fb.subtopics.push({name:n,subtopics:[]}); });
    if(fb.subtopics.length>0) modules.push(fb);
  }
  const seen=new Set();
  return modules.filter(m=>m.name&&m.name.length>0).map(m=>({
    ...m, subtopics: m.subtopics.filter(s=>{ const k=(s.name||'').toLowerCase().replace(/\s+/g,' ').trim(); if(!k||seen.has(k)) return false; seen.add(k); return true; })
  }));
};

/* ─── extractTopicsAdvanced ──────────────────────────────────────────────────
 * Pipeline:
 *   1. JS splits text on MODULE N boundaries (reliable, instant)
 *   2. Ollama extracts topics per module (small focused calls, accurate)
 *   3. JS fallback if no MODULE N markers
 *   4. Ollama gets course title (30-token call)
 * ──────────────────────────────────────────────────────────────────────────── */
const extractTopicsAdvanced = async text => {
  // Step 1: Split into module sections
  const sections = splitIntoModuleSections(text);

  let topics;
  if (sections && sections.length >= 2) {
    console.log('Found', sections.length, 'module sections — using LLM per module');
    // Step 2: Extract topics with LLM for each module (sequential, accurate)
    topics = [];
    for (const sec of sections) {
      console.log('Extracting topics for:', sec.name, '(' + sec.content.length + ' chars)');
      const subtopics = await extractModuleTopicsWithLLM(sec.name, sec.content);
      console.log(' →', subtopics.length, 'topics found');
      topics.push({ name: sec.name, description: '', subtopics });
    }
  } else {
    // Step 3: Fallback to heading-outline parser
    console.log('No explicit MODULE sections — using heading outline fallback');
    const outline = extractHeadingOutline(text);
    console.log('Outline:', outline.split('\n').length, 'lines');
    topics = parseOutlineIntoHierarchy(outline);
  }

  // Step 4: Get course subject name — JS-first, no LLM for this
  const rawText2000 = text.slice(0, 2000);
  let subject = extractSubjectNameJS(rawText2000);

  // If JS couldn't find it, try a tiny LLM call as last resort
  if (!subject || subject.length < 4) {
    try {
      const rawHead = text.replace(/\s+/g, ' ').trim().slice(0, 500);
      const pr = 'What is the official course/subject name? Reply ONLY with the name (2-5 words), nothing else.\n\n' +
                 rawHead + '\n\nCourse name:';
      const r = await generateText(pr, { temperature: 0.1, numPredict: 15 });
      const candidate = (r || '').trim().replace(/[\n"]+/g, '').slice(0, 80);
      // Reject if the LLM returned an admin phrase
      if (candidate && candidate.length >= 4 && !isAdminLine(candidate) && !isStop(candidate)) {
        subject = candidate;
      }
    } catch (_) {}
  }

  // Final fallback: use the first module's subtitle if available
  if ((!subject || subject.length < 4) && topics.length > 0) {
    // e.g. "Module 1: Cloud Computing Overview" → "Cloud Computing Overview"
    const m = (topics[0].name || '').match(/:\s*(.+)$/);
    if (m && m[1].length >= 4) subject = m[1].trim();
  }

  if (!subject || subject.length < 2) subject = 'Course';

  console.log('Done: subject="' + subject + '", ' + topics.length + ' modules,',
    topics.reduce((a,t)=>a+t.subtopics.length,0), 'total topics');
  return { subject, summary: '', topics, relationships: [], keyTerms: [] };
};





/* ═══════════════════════════════════════════════════════════════════════════
   2. QUESTION GENERATION
══════════════════════════════════════════════════════════════════════════════ */
const generateDocumentQuestions = async (topicObjects, docSnippet, questionsPerTopic = 3, seed = 0) => {
  const topicList = topicObjects.map(t => typeof t === 'string' ? { name: t } : t);
  const hasDoc = docSnippet && docSnippet.trim().length > 50;
  const docCtx = hasDoc ? docSnippet.slice(0, 2000) : '';
  const topics = topicList;
  const qPerTopic = Math.max(1, questionsPerTopic);

  const ANGLES = [
    'definition and explanation',
    'real-world application',
    'analysis and comparison',
    'problem-solving and design',
    'evaluation and critique',
  ];
  // Instead of picking one angle, we ask for a mix if generating multiple questions.
  const angleHint = qPerTopic === 1 
    ? `Question style: ${ANGLES[Math.floor(seed / 1000) % ANGLES.length]}.`
    : `Question styles: Mix different angles such as definition, application, analysis, and evaluation.`;

  console.log(`✨ Ollama: generating ${qPerTopic} questions per topic for ${topics.length} topics...`);

  // ★ Process in small batches instead of Promise.all to cap peak memory.
  //   Promise.all fires ALL topics at once — each Ollama response stays in memory
  //   until ALL others finish, so 20 topics = 20 responses in memory simultaneously.
  //   Batching 3 at a time keeps peak at 3 responses (~30 KB) instead of 20+ (~200 KB+).
  const BATCH_SIZE = 3;
  const allQuestions = [];

  for (let i = 0; i < topics.length; i += BATCH_SIZE) {
    const batch = topics.slice(i, i + BATCH_SIZE);

    const batchPromises = batch.map(async (topicObj) => {
      const topicName = topicObj.name;
      const parentTopic = topicObj.parentTopic || null;
      const subject = topicObj.subject || null;

      // Build a precise syllabus scope line so the LLM never goes out of context
      const scopeLine = [
        subject    && `Course/Subject: "${subject}"`,
        parentTopic && `Module/Topic: "${parentTopic}"`,
        `Subtopic: "${topicName}"`,
      ].filter(Boolean).join(' → ');

      const prompt = `You are a university professor writing exam questions strictly within the course syllabus.
${docCtx ? `Syllabus / Course material:\n"""\n${docCtx}\n"""\n` : ''}
Syllabus scope: ${scopeLine}

${angleHint}

CRITICAL RULES — follow strictly:
- Write exactly ${qPerTopic} exam question${qPerTopic > 1 ? 's' : ''} ONLY about "${topicName}"${parentTopic ? ` as taught under "${parentTopic}"` : ''}${subject ? ` in the course "${subject}"` : ''}.
- Questions MUST be within the scope of the syllabus above. Do NOT introduce concepts from outside this course.
- Do NOT ask about any other topic, subject, or unrelated concept.
- EVERY question MUST explicitly mention or clearly relate to "${topicName}".
- EVERY question MUST end with a question mark.
- Output ONLY a numbered list — no introduction, no explanation, no other text.
${qPerTopic > 1 ? '- HIGH VARIANCE REQUIRED: Each question MUST have a distinct meaning and test a completely different aspect of the topic. Avoid generating questions that are rephrasings of each other.\n- Vary depth: beginner, intermediate, advanced.' : ''}

Format:
${Array.from({ length: qPerTopic }, (_, i) => `${i + 1}. [Question about "${topicName}" as covered in this course]?`).join('\n')}

Now write the ${qPerTopic} question${qPerTopic > 1 ? 's' : ''} about "${topicName}" within the syllabus scope above:`;

      try {
        const raw = await generateText(prompt, { temperature: 0.75, numPredict: 150 * qPerTopic });
        const qs = parseQuestions(raw, topicName, qPerTopic, parentTopic);
        console.log(`  ${qs.length > 0 ? '✅' : '⚠️ '} ${topicName}: ${qs.length} questions`);
        return qs;
      } catch (err) {
        console.warn(`  ⚠️  ${topicName} failed:`, err.message);
        return [];
      }
    });

    const batchResults = await Promise.all(batchPromises);
    for (const qs of batchResults) allQuestions.push(...qs);
    // Allow GC to collect this batch before the next
    batchResults.length = 0;
  }

  console.log(`✅ Total: ${allQuestions.length} questions`);
  return allQuestions;
};


const parseQuestions = (raw, topicName, limit = 3, parentTopic = null) => {
  const TYPE_MAP = ['comparison', 'application', 'analysis', 'evaluation', 'synthesis'];
  const questions = [];
  const seen = new Set();

  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*(\d{1,2})[.)\s]\s*(.+)/);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    const q = m[2].trim().replace(/\*\*/g, '').replace(/^[\*_]+|[\*_]+$/g, '').trim();
    if (q.length < 25 || !q.includes('?')) continue;
    const key = q.slice(0, 60).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    questions.push({
      id: `ollama-${topicName}-${questions.length}`,
      question: q,
      type: TYPE_MAP[idx % TYPE_MAP.length] ?? 'analysis',
      topic: topicName,
      parentTopic: parentTopic || undefined,
      difficulty: idx < 1 ? 'beginner' : idx < 2 ? 'intermediate' : 'advanced',
      source: 'ollama',
    });

    if (questions.length >= limit) break;
  }
  return questions;
};

/* ═══════════════════════════════════════════════════════════════════════════
   3. ANSWER EVALUATION
══════════════════════════════════════════════════════════════════════════════ */
const evaluateAnswer = async (question, studentAnswer, keyConceptsHint = []) => {
  const conceptsNote = keyConceptsHint.length
    ? `Key concepts expected: ${keyConceptsHint.join(', ')}`
    : '';

  const prompt = `You are a professor evaluating a student's exam answer.

QUESTION:
${question}

STUDENT'S ANSWER:
${studentAnswer}

${conceptsNote}

Evaluate on 4 dimensions (each 0-100):
1. Conceptual accuracy
2. Depth of explanation
3. Use of examples
4. Clarity and structure

Overall score = weighted average (accuracy 35%, depth 30%, examples 20%, clarity 15%).

Respond ONLY with valid JSON (no markdown):
{
  "scores": { "accuracy": 0-100, "depth": 0-100, "examples": 0-100, "clarity": 0-100 },
  "score": 0-100,
  "rating": "strong" or "partial" or "weak",
  "feedback": "2-3 sentence targeted feedback",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"],
  "missingConcepts": ["concept A", "concept B"]
}`;

  try {
    const raw = await generateText(prompt, { temperature: 0.3, numPredict: 800 });
    const parsed = extractJSON(raw);
    if (!parsed || typeof parsed.score !== 'number')
      throw new Error('Invalid evaluation JSON from Ollama');

    const score = Math.max(0, Math.min(100, Math.round(parsed.score)));
    const rating = score >= 75 ? 'strong' : score >= 45 ? 'partial' : 'weak';

    return {
      score, rating,
      scores: {
        accuracy: parsed.scores?.accuracy ?? score,
        depth: parsed.scores?.depth ?? score,
        examples: parsed.scores?.examples ?? score,
        clarity: parsed.scores?.clarity ?? score,
        keyword: parsed.scores?.accuracy ?? score,
        length: parsed.scores?.depth ?? score,
        understanding: parsed.scores?.examples ?? score,
      },
      feedback: parsed.feedback || 'Evaluated by Ollama',
      strengths: parsed.strengths || [],
      improvements: parsed.improvements || [],
      missingConcepts: parsed.missingConcepts || [],
      source: 'ollama',
    };
  } catch (err) {
    console.error('evaluateAnswer error:', err.message);
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   4. WEAKNESS EXPLANATION  (NOT graph generation)
   Ollama receives REAL quiz scores computed by depGraphService.
   It ONLY explains WHY — never invents graph structure.
══════════════════════════════════════════════════════════════════════════════ */
/**
 * @param {string} weakTopic   - Topic the student is struggling with
 * @param {Array}  weakNodes   - [{ name, status, score }] — already computed by depGraphService
 * @param {object} scores      - { topicName: score } — real quiz scores
 */
const analyzeWeakness = async (weakTopic, weakNodes = [], scores = {}) => {
  const scoreLines = Object.entries(scores)
    .map(([name, s]) => `  ${name}: ${s}%`)
    .join('\n') || '  No scores available yet';

  const weakList = weakNodes
    .filter(n => n.status === 'weak')
    .map(n => n.name)
    .join(', ') || 'none identified';

  const prompt = `You are a concise educational tutor.

A student scored poorly on "${weakTopic}".

Actual quiz scores:
${scoreLines}

Weakest prerequisite concepts: ${weakList}

Based ONLY on the scores above, explain why the student struggles with "${weakTopic}" and provide a study plan.

Return ONLY valid JSON (no markdown, no explanation outside JSON):
{
  "rootCause": "one sentence — the single most critical gap shown by the scores",
  "studyPlan": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "explanation": "2-3 sentences connecting the weak prerequisite scores to difficulty with the main topic",
  "estimatedRevisionTime": "X-Y hours"
}`;

  try {
    const raw = await generateText(prompt, { temperature: 0.25, numPredict: 600 });
    const parsed = extractJSON(raw);
    if (!parsed) throw new Error('Invalid weakness JSON');
    return parsed;
  } catch (err) {
    console.error('analyzeWeakness error:', err.message);
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   5. DEPENDENCY ANALYSIS
══════════════════════════════════════════════════════════════════════════════ */
/**
 * Returns { nodes, edges, recommendedPath } — NO coordinates.
 * React Flow + Dagre handle all layout automatically.
 *
 * Node types:  root | category | concept
 * Edge types:  hierarchy | prerequisite
 */
const analyzeDependencies = async (topics, docSnippet = '', subject = '') => {
  const topicNames = topics.map(t => (typeof t === 'string' ? t : t.name)).filter(Boolean);
  const subjectName = subject || topicNames[0] || 'Course';
  // Use singleMode if there are only 1 or 2 topics, implying the user wants a focused graph for specific concepts
  const singleMode = topicNames.length <= 2;

  // ── IMPORTANT: Ollama must NOT return x/y coordinates.
  // React Flow + Dagre compute layout automatically from the graph topology.

  const singleTopicPrompt = `You are an expert curriculum designer and educational diagnostician.

A student is preparing to learn or struggling with the following topic(s): ${topicNames.join(', ')}
(Context/Course: "${subjectName}")

Step 1: Analyze the core topic(s) and determine the exact FOUNDATIONAL prerequisite concepts, prior knowledge, and skills required to understand them.
Step 2: Generate a hierarchical dependency graph showing these foundational topics that the student is likely lacking and MUST work upon BEFORE tackling the core topic(s).

Rules:
1. Create exactly ONE root node (type "root") for "${topicNames[0]}".
2. Create 2-4 category nodes (type "category") representing broad prerequisite areas needed for this topic.
3. Create 2-4 concept nodes (type "concept") under each category representing the SPECIFIC foundational skills the student needs to learn first. DO NOT just repeat the target topic.
4. Each node MUST have:
   - id: unique string, no spaces (use hyphens)
   - name: clear human-readable name of the prerequisite concept
   - type: "root" | "category" | "concept"
   - status: "weak" if score<45, "partial" if 45-74, "strong" if >=75, "not_started" if no score
   - score: integer 0-100 (estimated student mastery) or null for root
   - description: one concise sentence explaining why this prerequisite is important
5. Edges:
   - type "hierarchy" for parent → child (structural)
   - type "prerequisite" for cross-dependencies (concept B truly requires concept A first)
6. recommendedPath: ordered list of concept names, foundational first, ending with the root topic
7. DO NOT include x, y, position, or coordinate fields
8. Return ONLY valid JSON — no markdown, no explanation

{
  "nodes": [
    { "id": "root", "name": "${topicNames[0]}", "type": "root", "status": "not_started", "score": null, "description": "The main topic to master." }
  ],
  "edges": [],
  "recommendedPath": []
}`;

  const fullCoursePrompt = `You are an expert curriculum designer and educational diagnostician.

Course: "${subjectName}"
Topics covered: ${topicNames.join(', ')}

Step 1: Analyze the provided topics and identify the underlying logical progression.
Step 2: Identify any unlisted FOUNDATIONAL prerequisite concepts that a student might be lacking and MUST understand before learning these topics.
Step 3: Generate a hierarchical educational dependency graph incorporating both the provided topics and the necessary foundational prerequisites.

Rules:
1. Create exactly ONE root node (type "root") for "${subjectName}"
2. Create 3-5 category nodes (type "category") representing major phases of learning
3. Create concept nodes (type "concept") under each category. 
   - You MUST include the main provided topics.
   - You MUST ALSO invent and include prerequisite nodes that represent foundational skills the student needs to learn first. DO NOT just copy-paste the provided topics.
4. Each node MUST have:
   - id: unique string, no spaces (use hyphens)
   - name: clear human-readable name
   - type: "root" | "category" | "concept"
   - status: "weak" | "partial" | "strong" | "not_started"
   - score: integer 0-100 or null for root
   - description: one concise sentence
5. Edges:
   - type "hierarchy" for parent → child
   - type "prerequisite" for genuine cross-topic dependencies
6. recommendedPath: ordered topic names, foundational first
7. DO NOT include x, y, position, or coordinate fields
8. Return ONLY valid JSON

{
  "nodes": [],
  "edges": [],
  "recommendedPath": []
}`;

  const prompt = singleMode ? singleTopicPrompt : fullCoursePrompt;

  try {
    const raw = await generateText(prompt, { temperature: 0.25, numPredict: 3500 });
    const parsed = extractJSON(raw);
    if (!parsed) throw new Error('Invalid dependency JSON');
    if (!Array.isArray(parsed.nodes) || parsed.nodes.length < 2)
      throw new Error('nodes array missing or too short');
    // Strip any coordinates Ollama may have hallucinated
    parsed.nodes = parsed.nodes.map(({ x, y, position, ...rest }) => rest);
    console.log(`✅ Dependency graph: ${parsed.nodes.length} nodes, ${(parsed.edges || []).length} edges`);
    return parsed;
  } catch (err) {
    console.error('analyzeDependencies error:', err.message);
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   6. LEARNING PATH GENERATION
══════════════════════════════════════════════════════════════════════════════ */
const generateLearningPath = async (weakTopics, allTopics, dependencyRelationships = [], docSnippet = '') => {
  if (!weakTopics?.length) return [];

  const topicList = allTopics.join(', ');
  const depsText = dependencyRelationships.length
    ? dependencyRelationships
      .map(r => `"${r.source}" before "${r.target}" (${r.type || 'prerequisite'})`)
      .join('\n')
    : 'No dependency data.';

  const prompt = `You are an expert learning advisor.

All topics: ${topicList}
Prerequisites:
${depsText}

Student is WEAK in: ${weakTopics.join(', ')}

For each weak topic, generate a step-by-step recovery learning path.

Respond ONLY with valid JSON:
{
  "paths": [
    {
      "weakTopic": "TopicName",
      "summary": "Recovery strategy summary",
      "estimatedTime": "X hours",
      "steps": [
        { "order": 1, "topic": "PrerequisiteTopic", "action": "Revise", "reason": "Why first" },
        { "order": 2, "topic": "WeakTopicName", "action": "Practice", "reason": "Apply knowledge" }
      ]
    }
  ]
}`;

  try {
    const raw = await generateText(prompt, { temperature: 0.3, numPredict: 1500 });
    const parsed = extractJSON(raw);
    if (!parsed?.paths) throw new Error('No paths in response');
    console.log(`✅ Learning paths generated for: ${weakTopics.join(', ')}`);
    return parsed.paths;
  } catch (err) {
    console.error('generateLearningPath error:', err.message);
    return weakTopics.map(weakTopic => {
      const prereqs = dependencyRelationships
        .filter(r => r.target === weakTopic)
        .map(r => r.source);
      return {
        weakTopic,
        summary: `Revise prerequisites then tackle ${weakTopic}.`,
        estimatedTime: `${prereqs.length + 1} hours`,
        steps: [
          ...prereqs.map((p, i) => ({ order: i + 1, topic: p, action: 'Revise', reason: `Required for ${weakTopic}` })),
          { order: prereqs.length + 1, topic: weakTopic, action: 'Practice', reason: 'Apply revised knowledge' },
        ],
      };
    });
  }
};

/* ─── legacy wrapper ────────────────────────────────────────────────────── */
const generateAdvancedQuestions = async (topics, context = '') => {
  const topicObjects = Array.isArray(topics)
    ? topics.map(t => (typeof t === 'string' ? { name: t } : t))
    : [{ name: topics }];
  return generateDocumentQuestions(topicObjects, context)
    .then(qs => qs.map(q => q.question));
};

/* ─── explainWeakNode ─────────────────────────────────────────────────────
   Generates a rich, node-specific explanation for a weak/partial dep-graph node.
   Returns: { what, explanation, whyWeak, gaps: string[], studySteps: string[] }
─────────────────────────────────────────────────────────────────────────── */
const explainWeakNode = async (topicName, parentTopic, status, score, siblingContext = []) => {
  const scoreStr = score != null ? `${score}%` : 'not yet quizzed';
  const statusStr = status === 'weak' ? 'weak (needs significant revision)' : 'partially understood';
  const siblings = siblingContext.length
    ? siblingContext.map(s => `"${s.name}" (${s.status}${s.score != null ? ', ' + s.score + '%' : ''})`).join(', ')
    : 'none listed';

  const prompt = `You are an expert tutor. A student is weak on the topic "${topicName}" (part of "${parentTopic}").

Student status: ${statusStr}  |  Score: ${scoreStr}
Related topics: ${siblings}

Respond ONLY with this JSON (no extra text):
{
  "what": "1-2 sentences: what '${topicName}' is and why it matters in '${parentTopic}'",
  "explanation": "3-5 sentences: a clear, educational explanation of '${topicName}' itself — explain the actual concept, process or method in simple language as if teaching it from scratch. Include a concrete example or step-by-step process if relevant.",
  "whyWeak": "2-3 sentences: specific conceptual reasons why THIS student is struggling — be diagnostic and concrete, not generic",
  "gaps": [
    "Specific missing concept or skill 1",
    "Specific missing concept or skill 2",
    "Specific missing concept or skill 3"
  ],
  "studySteps": [
    "Concrete study action 1 (e.g. 'Re-read section X and make notes on Y')",
    "Concrete study action 2",
    "Concrete study action 3"
  ]
}`;

  try {
    const raw = await generateText(prompt, { temperature: 0.3, numPredict: 900 });
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON in response');
    const parsed = JSON.parse(m[0]);
    return {
      what: parsed.what || '',
      explanation: parsed.explanation || '',
      whyWeak: parsed.whyWeak || '',
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 3) : [],
      studySteps: Array.isArray(parsed.studySteps) ? parsed.studySteps.slice(0, 3) : [],
    };
  } catch (e) {
    return {
      what: `"${topicName}" is a subtopic of "${parentTopic}" that requires focused study.`,
      explanation: `${topicName} refers to the methods and processes involved in this area of ${parentTopic}. Understanding this topic requires knowing the key concepts, tools, and procedures that are applied in practice. Review your course material for detailed explanations and worked examples.`,
      whyWeak: status === 'weak'
        ? `Your quiz performance reveals significant gaps in understanding "${topicName}". The foundational concepts of this topic are not yet solid enough to support higher-level questions.`
        : `You have a partial understanding of "${topicName}". Some key concepts are clear but gaps remain that are affecting your overall mastery of "${parentTopic}".`,
      gaps: [
        `Core definitions and terminology of "${topicName}"`,
        `How "${topicName}" connects to other concepts in "${parentTopic}"`,
        `Practical application of "${topicName}" principles`,
      ],
      studySteps: [
        `Review the fundamental concepts of "${topicName}" from your course material`,
        `Practice solved examples specifically involving "${topicName}"`,
        `Use the Quiz feature to test your understanding after reviewing`,
      ],
    };
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW PIPELINE — Phase A: Extract atomic concepts from chapter text
═══════════════════════════════════════════════════════════════════════════ */

/**
 * extractConcepts(text)
 *
 * Replaces the old heading-based extraction for new sessions.
 * Returns { chapterTitle, subject, concepts[] } where every concept is
 * an atomic learning unit ("Tilling", "Seed Drill") — NOT a section heading.
 *
 * Capped at 30 concepts to keep Ollama prerequisite pass tractable.
 */
const extractConcepts = async (text) => {
  // Pre-extract heading outline first (free, fast), then fall back to raw
  // text for the first 6 000 chars so concept names inside paragraphs aren't lost.
  const outline = extractHeadingOutline(text);
  const rawSnippet = text.replace(/\s+/g, ' ').trim().slice(0, 6000);
  // Combine: headings give structure, snippet gives body concept names
  const doc = (outline + '\n\n--- DOCUMENT EXCERPT ---\n' + rawSnippet).slice(0, 10000);

  const prompt = `You are an expert educational content analyst.

Your task: Extract the atomic LEARNING CONCEPTS from this chapter text.

STRICT RULES:
1. Extract ONLY real learning concepts — things a student must genuinely understand.
   Examples of GOOD concepts: "Photosynthesis", "Tilling", "Seed Drill", "Drip Irrigation", "Manure"
   Examples of BAD extractions: "Introduction", "Summary", "Activity 1.1", "Let's Do", "Questions"

2. Do NOT extract:
   - Chapter titles or section numbers (e.g. "1.3 Preparation of Soil")
   - Activity names, exercise headings, examples
   - Generic words: "overview", "review", "practice"

3. Each concept label must be:
   - 1–4 words only
   - Title Case ("Seed Drill" not "seed drill")
   - Specific enough to be quizzed ("Drip Irrigation" not just "Irrigation Methods")

4. Return 10–30 concepts only. Quality over quantity.

5. For each concept:
   - id: snake_case of the name ("seed_drill")
   - name: Title Case display name ("Seed Drill")
   - type: one of "Concept" | "Process" | "Tool" | "Method" | "Principle"
   - difficulty: 1–5 (1 = basic recall, 5 = expert application)
   - importance: 1–5 (how central is this to the chapter?)

Return ONLY valid JSON, no markdown, no explanation:
{
  "chapterTitle": "...",
  "subject": "...",
  "concepts": [
    { "id": "soil", "name": "Soil", "type": "Concept", "difficulty": 1, "importance": 5 },
    { "id": "tilling", "name": "Tilling", "type": "Process", "difficulty": 2, "importance": 4 }
  ]
}

CHAPTER TEXT:
${doc}

JSON:`.trim();

  try {
    const raw = await generateText(prompt, { temperature: 0.15, numPredict: 3000 });
    const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON object found in extractConcepts output');
    const parsed = JSON.parse(m[0]);

    const concepts = (parsed.concepts || [])
      .filter(c => c?.id && c?.name)
      .slice(0, 30) // hard cap
      .map(c => ({
        id: String(c.id).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
        name: String(c.name).trim(),
        type: ['Concept', 'Process', 'Tool', 'Method', 'Principle'].includes(c.type) ? c.type : 'Concept',
        difficulty: Math.min(5, Math.max(1, Number(c.difficulty) || 2)),
        importance: Math.min(5, Math.max(1, Number(c.importance) || 3)),
      }));

    console.log(`✅ extractConcepts: ${concepts.length} concepts from "${parsed.chapterTitle || 'unknown'}"`);
    return {
      chapterTitle: parsed.chapterTitle || '',
      subject: parsed.subject || '',
      concepts,
    };
  } catch (err) {
    console.error('extractConcepts error:', err.message);
    return { chapterTitle: '', subject: '', concepts: [] };
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW PIPELINE — Phase B: Generate prerequisite edges between concepts
═══════════════════════════════════════════════════════════════════════════ */

/**
 * generatePrerequisiteEdges(concepts)
 *
 * Given the concept list from extractConcepts(), asks Ollama to determine
 * real educational prerequisites.
 * A → B means: student must understand A before B can be fully understood.
 *
 * Stores confidence (0.7–1.0) per edge so noisy edges can be filtered later.
 *
 * @param {Array<{id, name}>} concepts
 * @returns {{ edges: Array<{source, target, confidence}> }}
 */
const generatePrerequisiteEdges = async (concepts) => {
  if (!concepts || concepts.length < 2) return { edges: [] };

  const conceptList = concepts.map(c => `- ${c.name} (id: ${c.id})`).join('\n');

  const prompt = `You are an expert educational curriculum designer.

Given these learning CONCEPTS from a chapter, determine which concepts are TRUE PREREQUISITES for others.

DEFINITION of a PREREQUISITE:
  A → B  means: a student CANNOT fully understand B without first understanding A.
  This must be a REAL conceptual dependency, not just sequential order in the textbook.

EXAMPLES OF REAL PREREQUISITES:
  ✅ Soil → Tilling (you must know what soil IS before understanding how to till it)
  ✅ Seed Selection → Seed Drill (you must choose seeds before using a seed drill)
  ✅ Sowing → Irrigation (you sow first, then water)

EXAMPLES OF FALSE PREREQUISITES (do NOT add these):
  ❌ Harvesting → Threshing just because they appear in the same chapter sequentially
  ❌ Manure → Irrigation because they're both farm inputs
  ❌ Any edge where the connection is only "they're related" not "A is needed to understand B"

RULES:
1. Only add edges for REAL, DIRECT conceptual dependencies.
2. Maximum 2 prerequisites per concept (don't over-connect).
3. No cycles (A → B → A is invalid).
4. Confidence 0.70–1.00 (how certain you are this is a true prerequisite).
5. Only use concept IDs from the list below.
6. If there are no real prerequisites, return empty edges array.

CONCEPTS:
${conceptList}

Return ONLY valid JSON:
{
  "edges": [
    { "source": "soil", "target": "tilling", "confidence": 0.95 },
    { "source": "seed_selection", "target": "seed_drill", "confidence": 0.88 }
  ]
}

JSON:`.trim();

  try {
    const raw = await generateText(prompt, { temperature: 0.15, numPredict: 2000 });
    const cleaned = raw.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON in generatePrerequisiteEdges output');
    const parsed = JSON.parse(m[0]);

    const validIds = new Set(concepts.map(c => c.id));

    // Validate: both source and target must exist in the concept list
    const edges = (parsed.edges || [])
      .filter(e => e?.source && e?.target && e.source !== e.target)
      .filter(e => validIds.has(e.source) && validIds.has(e.target))
      .map(e => ({
        source: e.source,
        target: e.target,
        confidence: Math.min(1, Math.max(0.5, Number(e.confidence) || 0.8)),
      }));

    // Cycle detection: remove any edge that would create a cycle
    const safEdges = _removeCycles(edges);

    console.log(`✅ generatePrerequisiteEdges: ${safEdges.length} edges (${edges.length - safEdges.length} cycles removed)`);
    return { edges: safEdges };
  } catch (err) {
    console.error('generatePrerequisiteEdges error:', err.message);
    return { edges: [] };
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   NEW PIPELINE — Mind Map: Hierarchical Chapter Structure Extraction
   Specifically tuned for NCERT-style chapters. Targets ONLY chapter headings,
   subheadings, and categorized lists — ignores paragraphs, activities,
   exercises, examples, dialogues, and stories.
═══════════════════════════════════════════════════════════════════════════ */

/**
 * extractMindMapStructure(text)
 *
 * Produces a clean 4-level hierarchy for mind map / concept graph rendering.
 * Returns nodes[] + edges[] in React Flow-compatible flat format.
 *
 * Level 0 = Chapter root
 * Level 1 = Major section headings
 * Level 2 = Subsection headings / categorized lists
 * Level 3 = Specific items (types, methods, crops, tools...)
 *
 * Filters out: explanations, definitions, examples, activities, exercises,
 *              questions, dialogues, stories, notes, images, tables.
 *
 * @param {string} text — raw chapter text
 * @returns {{
 *   nodes: Array<{id, label, level}>,
 *   edges: Array<{source, target}>,
 *   chapterTitle: string,
 *   subject: string
 * }}
 */
const extractMindMapStructure = async (text) => {
  // Pre-extract a heading outline from the FULL document (zero LLM cost).
  // This compresses 20–30 KB of raw text into ~1–3 KB of structured headings
  // so Ollama processes far fewer tokens while seeing 100% of the structure.
  const doc = extractHeadingOutline(text);

  // ── SYSTEM-LEVEL context baked into the user prompt ──────────────────────
  const SYSTEM_CONTEXT = `You are an expert educational content analyzer.
Your task is to convert a textbook chapter into a hierarchical concept map structure.

CRITICAL — Extract ONLY:
  - Main Chapter Topic (Level 0, root)
  - Major Section Headings (Level 1)
  - Subsection Headings (Level 2)
  - Categorized List Items — methods, tools, types, crops, etc. (Level 3)

CRITICAL — DO NOT extract:
  - Explanations or definitions
  - Examples or worked solutions
  - Activities, exercises, or questions
  - Dialogues, stories, or narratives
  - Notes, captions, images, or tables
  - Introductory or transitional text

IMPORTANT for NCERT chapters:
  NCERT chapters typically contain Stories, Activities, Dialogues, and Questions.
  These are NOT concepts. Extract concepts ONLY from:
    - Chapter Title
    - Section Headings
    - Subsection Headings
    - Categorized Lists
    - Keywords / Key Terms section

Additional rules:
  - Merge duplicate concepts — each concept appears ONCE.
  - Maximum 4 levels deep (0 = root, 1, 2, 3).
  - Maximum 8 children per node.
  - Keep labels short: max 4 words, Title Case.
  - Use chapter headings FIRST, subheadings SECOND, categorized lists THIRD.
  - Every node needs a unique id (e.g. "1", "1_1", "1_1_1").
  - Edges connect parent → child.
  - Return ONLY valid JSON — no markdown, no explanation.`;

  const prompt = `${SYSTEM_CONTEXT}

Analyze the following chapter text.
Create a hierarchical topic tree.

Ignore:
- paragraphs
- explanations
- activities
- examples
- exercises
- dialogues
- stories

Extract only:
- chapter title
- headings
- subheadings
- important categorized lists

Return JSON in this format:
{
  "chapterTitle": "Crop Production and Management",
  "subject": "Science",
  "nodes": [
    { "id": "1", "label": "Crop Production and Management", "level": 0 },
    { "id": "1_1", "label": "Agricultural Practices", "level": 1 },
    { "id": "1_1_1", "label": "Soil Preparation", "level": 2 },
    { "id": "1_1_1_1", "label": "Tilling", "level": 3 }
  ],
  "edges": [
    { "source": "1", "target": "1_1" },
    { "source": "1_1", "target": "1_1_1" },
    { "source": "1_1_1", "target": "1_1_1_1" }
  ]
}

CHAPTER TEXT:
---
${doc}
---

Return ONLY the JSON object. No other text.`;

  // ── Noise-label filter (same patterns used in extractTopicsAdvanced) ───────
  const NOISE_PATTERNS = [
    /^let'?s\s+(do|think|discuss|recall|explore)/i,
    /^do\s+this/i,
    /^activity/i,
    /^exercise/i,
    /^questions?$/i,
    /^textual\s+question/i,
    /^additional\s+question/i,
    /^summary$/i,
    /^glossary$/i,
    /^further\s+reading/i,
    /^in\s+text\s+question/i,
    /^box\s+item/i,
    /^note\s*:/i,
    /^figure/i,
    /^table/i,
    /^example/i,
    /^illustration/i,
    /^story/i,
    /^dialogue/i,
    /^introduction$/i,
    /^conclusion$/i,
    /^references?$/i,
    /^bibliography/i,
  ];
  const isNoise = (label) => NOISE_PATTERNS.some(rx => rx.test((label || '').trim()));

  // Enforce max 4 words per label, strip leading numbering ("1.2 Soil") → "Soil"
  const cleanMindMapLabel = (label) =>
    (label || '')
      .replace(/^[\d]+([.][\d]*)?\.?\s*/, '') // strip "1." "1.2" "1.2." etc.
      .replace(/^[•\-*]\s*/, '')               // strip bullets
      .replace(/[,;:]+$/, '')                  // strip trailing punctuation
      .split(/\s+/).slice(0, 5).join(' ')       // max 5 words
      .trim();

  try {
    // 4000 tokens — enough for a complete mind map with 60+ nodes.
    const raw = await generateText(prompt, { temperature: 0.1, numPredict: 4000 });
    const parsed = extractJSON(raw);

    if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      throw new Error('extractMindMapStructure: no nodes in response');
    }

    // ── Post-process nodes ─────────────────────────────────────────────────
    // 1. Clean labels
    let nodes = parsed.nodes
      .filter(n => n?.id && n?.label)
      .map(n => ({
        id: String(n.id),
        label: cleanMindMapLabel(n.label),
        level: typeof n.level === 'number' ? Math.min(3, Math.max(0, n.level)) : 1,
      }))
      .filter(n => n.label.length > 0 && !isNoise(n.label));

    // 2. Deduplicate by normalized label
    const seenLabels = new Set();
    nodes = nodes.filter(n => {
      const key = n.label.toLowerCase().replace(/\s+/g, ' ');
      if (seenLabels.has(key)) return false;
      seenLabels.add(key);
      return true;
    });

    // 3. Build valid ID set for edge filtering
    const validIds = new Set(nodes.map(n => n.id));

    // 4. Filter edges to only valid node references
    const edges = (parsed.edges || [])
      .filter(e => e?.source && e?.target && e.source !== e.target)
      .filter(e => validIds.has(e.source) && validIds.has(e.target))
      .map(e => ({ source: String(e.source), target: String(e.target) }));

    // 5. Enforce max 8 children per parent
    const childCount = {};
    const filteredEdges = edges.filter(e => {
      childCount[e.source] = (childCount[e.source] || 0) + 1;
      return childCount[e.source] <= 8;
    });

    const chapterTitle = cleanMindMapLabel(parsed.chapterTitle || nodes.find(n => n.level === 0)?.label || '');
    const subject = (parsed.subject || '').trim();

    console.log(
      `✅ extractMindMapStructure: ${nodes.length} nodes, ${filteredEdges.length} edges` +
      ` — "${chapterTitle}"`
    );

    return {
      nodes,
      edges: filteredEdges,
      chapterTitle,
      subject,
    };
  } catch (err) {
    console.error('extractMindMapStructure error:', err.message);
    return { nodes: [], edges: [], chapterTitle: '', subject: '' };
  }
};

/** Remove edges that create cycles using DFS */
const _removeCycles = (edges) => {
  const adj = {}; // source → [targets]
  const safe = [];
  for (const e of edges) {
    // Check if adding this edge would create a cycle
    if (_hasCycle(adj, e.source, e.target)) continue;
    // Safe — add it
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push(e.target);
    safe.push(e);
  }
  return safe;
};

const _hasCycle = (adj, from, to) => {
  // DFS from `to` — if we can reach `from`, adding from→to would create a cycle
  const visited = new Set();
  const stack = [to];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === from) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of (adj[cur] || [])) stack.push(next);
  }
  return false;
};

module.exports = {
  testOllamaConnection,
  generateText,
  extractTopicsAdvanced,
  extractMindMapStructure,   // ← new: NCERT/chapter heading-based mind map
  extractConcepts,
  generatePrerequisiteEdges,
  flatNodesToTopicsData,
  deduplicateTopics,
  normalizeName,
  generateDocumentQuestions,
  generateAdvancedQuestions,
  evaluateAnswer,
  analyzeWeakness,
  explainWeakNode,
  analyzeDependencies,
  generateLearningPath,
};

