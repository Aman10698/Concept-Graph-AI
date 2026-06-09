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
 * Converts raw chapter text into a compact heading-only outline (~1–3 KB).
 * Used by extractMindMapStructure and extractConcepts to reduce the number
 * of tokens sent to Ollama by 90 % without losing any structural information.
 * Body paragraphs are discarded — the LLM ignores them for graph building.
 ────────────────────────────────────────────────────────────── */
const extractHeadingOutline = (text) => {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length >= 2);

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
    /^introduction$/i,
    /^conclusion$/i,
    /^references?$/i,
  ];
  const isNoiseLine = (l) => NOISE.some(rx => rx.test(l));

  const isHeading = (l) => {
    if (l.length > 80) return false;          // too long — likely a sentence
    if (isNoiseLine(l)) return false;
    if (/^\d+(\.\d+)*\.?\s+\S/.test(l)) return true;  // numbered: "1.", "1.1", "2.3.4"
    if (/^[A-Z][A-Z\s]{3,}$/.test(l)) return true;    // ALL CAPS heading
    if (/^[A-Z][a-z].*[a-z]$/.test(l) && l.length <= 60) return true; // Title case, short
    if (/^[\u2022\-*]\s+\S/.test(l) && l.length <= 60) return true;    // short bullet/list item
    return false;
  };

  const outline = [];
  let charCount = 0;
  const MAX_OUTLINE_CHARS = 3000;

  for (const line of lines) {
    if (charCount >= MAX_OUTLINE_CHARS) break;
    if (!isHeading(line)) continue;
    outline.push(line);
    charCount += line.length + 1;
  }

  // Always prepend the very first line (document title)
  if (outline.length === 0 || outline[0] !== lines[0]) {
    outline.unshift(lines[0] || '');
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

const extractTopicsAdvanced = async (text) => {
  // 40 000 chars ≈ 12–15 PDF pages — enough for a full 5-module syllabus
  const doc = text.replace(/\s+/g, ' ').trim().slice(0, 40000);

  // ── Syllabus-aware prompt ─────────────────────────────────────────────────
  // This prompt is specifically designed for university syllabi that have
  // multiple modules/units, each containing several topics and subtopics.
  const prompt = `You are an expert academic syllabus analyzer.
Your ONLY job is to extract the complete topic hierarchy from the given syllabus text.

CRITICAL INSTRUCTIONS:
1. Find EVERY module/unit in the syllabus (there are usually 3–6 modules).
2. Under each module, list EVERY topic and subtopic mentioned.
3. DO NOT skip any module. DO NOT skip any topic.
4. The root node = the course/subject name.
5. Level 1 = Module names (e.g. "Module 1: Cloud Computing", "Unit 2: Virtualization").
6. Level 2 = Topics inside each module.
7. Level 3 = Sub-topics or specific items listed under a topic.
8. Keep labels concise (≤ 6 words). Use Title Case.
9. Return ONLY valid JSON — no markdown, no explanation.

Output format (follow EXACTLY):
{
  "subject": "Full Course Name",
  "summary": "One sentence course overview.",
  "nodes": [
    { "id": "root", "label": "Course Name", "level": 0 },
    { "id": "m1", "label": "Module 1: Name", "level": 1 },
    { "id": "m1t1", "label": "Topic Name", "level": 2 },
    { "id": "m1t1s1", "label": "Sub-topic", "level": 3 }
  ],
  "edges": [
    { "source": "root", "target": "m1" },
    { "source": "m1", "target": "m1t1" },
    { "source": "m1t1", "target": "m1t1s1" }
  ],
  "keyTerms": []
}

Rules:
- Every module MUST appear as a level-1 node connected to root.
- Every topic under a module MUST appear as a level-2 node connected to its module.
- Use unique ids (e.g. m1, m1t1, m1t2, m2, m2t1...).
- Do NOT include: course outcomes, assessment schemes, references, exam patterns, faculty info.
- Do NOT limit yourself to 8 children — include ALL topics for each module.

SYLLABUS TEXT:
---
${doc}
---

Return ONLY the JSON object. No other text. Include ALL modules and ALL their topics.`;

  // ── Admin-section filter ─────────────────────────────────────────────────
  const ADMIN_PATTERNS = [
    /^course\s+outcome/i, /^learning\s+objective/i, /\bco\d+\b/i,
    /^modes?\s+of\s+eval/i, /^assessment\s+scheme/i,
    /^examination\s+(scheme|pattern)/i, /^evaluation\s+scheme/i,
    /^activities?\s*(&|and)?\s*exercises?/i, /^references?$/i,
    /^bibliography/i, /^attendance/i, /^credits?\s*(hours?)?$/i,
    /^faculty\s+info/i, /^components?$/i, /^quiz\s*\/?s*assignment/i,
    /^seminar/i, /^written\s+exam/i,
    /^let'?s\s+(do|think|discuss)/i, /^do\s+this/i, /^activity/i,
    /^exercise/i, /^questions?$/i, /^textual\s+question/i,
    /^additional\s+question/i, /^summary$/i, /^glossary$/i,
    /^further\s+reading/i,
  ];

  const isAdminSection = (label) =>
    ADMIN_PATTERNS.some(rx => rx.test((label || '').trim()));

  // Strip course codes like "IFT4528", "CS-101", "ECE 302" from subject names and root labels
  const stripCourseCode = (str) =>
    (str || '')
      .replace(/^[A-Z]{2,6}[-\s]?\d{3,6}\s*/i, '')  // e.g. IFT4528, CS101, ECE-302
      .replace(/^\d{3,6}[A-Z]{0,4}\s*/i, '')          // e.g. 101CS at start
      .trim() || str;

  // Clean up trailing punctuation from node labels (commas, colons leftover from PDF parsing)
  const cleanLabel = (label) =>
    (label || '').replace(/[,;:]+$/, '').trim();

  try {
    // 16 000 tokens — enough for full syllabus output with all modules
    const raw = await generateText(prompt, { temperature: 0.1, numPredict: 16000 });
    const parsed = extractJSON(raw);

    // ── Handle nodes/edges format ──────────────────────────────────────────
    if (parsed && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
      // Filter out admin/noise nodes
      parsed.nodes = parsed.nodes.filter(n => !isAdminSection(n.label));

      // Enforce label length (≤ 8 words), strip course codes and trailing punctuation
      parsed.nodes = parsed.nodes.map(n => ({
        ...n,
        label: cleanLabel(
          n.level === 0
            ? stripCourseCode((n.label || '').split(/\s+/).slice(0, 8).join(' '))
            : (n.label || '').split(/\s+/).slice(0, 8).join(' ')
        ),
      }));

      // Remove edges whose source or target no longer exists
      const validIds = new Set(parsed.nodes.map(n => n.id));
      parsed.edges = (parsed.edges || []).filter(
        e => validIds.has(e.source) && validIds.has(e.target)
      );

      // Convert flat nodes/edges → nested topics[]
      const { chapterTitle, topics } = flatNodesToTopicsData(parsed.nodes, parsed.edges);

      // Deduplicate topics by name (keep first occurrence)
      const dedupedTopics = topics
        .filter((t, i, arr) => arr.findIndex(x => x.name?.toLowerCase() === t.name?.toLowerCase()) === i)
        .filter(t => !isAdminSection(t.name));

      console.log(`✅ Ollama extracted ${dedupedTopics.length} modules/topics from ${parsed.nodes.length} nodes`);

      // Guard: if all filtered out, use raw level-1 nodes
      const finalTopics = dedupedTopics.length > 0
        ? dedupedTopics
        : parsed.nodes
          .filter(n => n.level > 0 && !isAdminSection(n.label))
          .map(n => ({ name: n.label, description: '', subtopics: [] }));

      return {
        subject: stripCourseCode(parsed.subject || chapterTitle || ''),
        summary: parsed.summary || '',
        topics: finalTopics,
        relationships: [],
        keyTerms: parsed.keyTerms || [],
        // Also expose the raw graph for any callers that want React Flow data directly
        graphNodes: parsed.nodes,
        graphEdges: parsed.edges,
      };
    }

    // ── Fallback: old nested topics[] format (model didn't follow new schema) ─
    if (parsed && Array.isArray(parsed.topics) && parsed.topics.length > 0) {
      const normaliseSubtopics = (subs) => {
        if (!Array.isArray(subs)) return [];
        return subs.map(s => {
          if (typeof s === 'string') return { name: s, subtopics: [] };
          if (typeof s === 'object' && s.name) {
            return { ...s, subtopics: normaliseSubtopics(s.subtopics || []) };
          }
          return null;
        }).filter(Boolean);
      };

      parsed.topics = parsed.topics
        .map(t => ({ ...t, subtopics: normaliseSubtopics(t.subtopics || []) }))
        .filter((t, i, arr) => arr.findIndex(x => x.name?.toLowerCase() === t.name?.toLowerCase()) === i)
        .filter(t => !isAdminSection(t.name));

      console.log(`✅ Ollama extracted ${parsed.topics.length} topics (legacy nested format)`);
      return parsed;
    }

    throw new Error('Ollama returned neither nodes[] nor topics[] — invalid structure');

  } catch (err) {
    // Re-throw so topicController can catch it and properly log/fallback
    console.error('extractTopicsAdvanced error:', err.message);
    throw err;
  }
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
  const questionAngle = ANGLES[Math.floor(seed / 1000) % ANGLES.length];

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

      const contextLine = [
        subject && `Subject: "${subject}"`,
        parentTopic && `Parent topic: "${parentTopic}"`,
        `Topic: "${topicName}"`,
      ].filter(Boolean).join(' | ');

      const prompt = `You are a university professor writing exam questions.
${docCtx ? `Course material:\n"""\n${docCtx}\n"""\n` : ''}
${contextLine}

Question style: ${questionAngle}.

CRITICAL RULES — follow strictly:
- Write exactly ${qPerTopic} exam question${qPerTopic > 1 ? 's' : ''} ONLY about "${topicName}"${parentTopic ? ` (part of "${parentTopic}")` : ''}.
- Do NOT ask about any other topic, subject, or concept.
- EVERY question MUST explicitly mention or clearly relate to "${topicName}".
- EVERY question MUST end with a question mark.
- Output ONLY a numbered list — no introduction, no explanation, no other text.
${qPerTopic > 1 ? '- Vary depth: beginner, intermediate, advanced.' : ''}

Format:
${Array.from({ length: qPerTopic }, (_, i) => `${i + 1}. [Question about "${topicName}"]?`).join('\n')}

Now write the ${qPerTopic} question${qPerTopic > 1 ? 's' : ''} about "${topicName}":`;

      try {
        const raw = await generateText(prompt, { temperature: 0.65, numPredict: 150 * qPerTopic });
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
  const singleMode = topicNames.length === 1 && topicNames[0] === subjectName;

  // ── IMPORTANT: Ollama must NOT return x/y coordinates.
  // React Flow + Dagre compute layout automatically from the graph topology.

  const singleTopicPrompt = `You are an expert curriculum designer.

A student is struggling with: "${subjectName}"

Generate a hierarchical prerequisite dependency graph showing what they need to learn BEFORE mastering this topic.

Rules:
1. Create exactly ONE root node (type "root") for "${subjectName}"
2. Create 3-5 category nodes (type "category") as prerequisite topic areas
3. Create 2-4 concept nodes (type "concept") under each category
4. Each node MUST have:
   - id: unique string, no spaces (use hyphens)
   - name: clear human-readable name
   - type: "root" | "category" | "concept"
   - status: "weak" if score<45, "partial" if 45-74, "strong" if >=75, "not_started" if no score
   - score: integer 0-100 (estimated student mastery) or null for root
   - description: one concise sentence explaining this concept or gap
5. Edges:
   - type "hierarchy" for parent → child (structural)
   - type "prerequisite" for cross-dependencies (concept B truly requires concept A first)
6. recommendedPath: ordered list of concept names, foundational first
7. DO NOT include x, y, position, or coordinate fields
8. Return ONLY valid JSON — no markdown, no explanation

{
  "nodes": [
    { "id": "root", "name": "${subjectName}", "type": "root", "status": "not_started", "score": null, "description": "The main topic to master." },
    { "id": "cat-foundations", "name": "Foundations", "type": "category", "status": "weak", "score": 35, "description": "Core prerequisite concepts." },
    { "id": "concept-basics", "name": "Basic Concept A", "type": "concept", "status": "weak", "score": 30, "description": "Must understand before advancing." }
  ],
  "edges": [
    { "source": "root", "target": "cat-foundations", "type": "hierarchy" },
    { "source": "cat-foundations", "target": "concept-basics", "type": "hierarchy" }
  ],
  "recommendedPath": ["Basic Concept A", "Foundations", "${subjectName}"]
}`;

  const fullCoursePrompt = `You are an expert curriculum designer.

Course: "${subjectName}"
Topics covered: ${topicNames.join(', ')}

Generate a hierarchical educational dependency graph for this course.

Rules:
1. Create exactly ONE root node (type "root") for "${subjectName}"
2. Create 3-5 category nodes (type "category") as major topic areas from the list above
3. Create 2-4 concept nodes (type "concept") under each category — use the actual topic names
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

