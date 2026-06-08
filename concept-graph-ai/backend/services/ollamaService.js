/**
 * AI Service — Powered by Ollama (local LLM)
 * Calls http://localhost:11434 using the Ollama REST API.
 * All exported function signatures are identical to the old Gemini version
 * so no other file needs to change.
 */

const OLLAMA_BASE = process.env.OLLAMA_URL  || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

/* ─── low-level generate call ───────────────────────────────────────────── */
const generateText = async (prompt, options = {}) => {
  const body = {
    model:  options.model || OLLAMA_MODEL,
    prompt,
    stream: false,
    // ⚠️  context: null suppresses Ollama's token-context array in the response.
    // Without this, Ollama sends back a `context` field with thousands of integers
    // (one per token in the context window) — this can be 200 KB+ per call and
    // accumulates rapidly in the worker heap when making many sequential calls.
    context: null,
    options: {
      temperature:  options.temperature ?? 0.6,
      num_predict:  options.numPredict  ?? 800,  // cap default; callers set higher if needed
      top_p:        options.topP        ?? 0.9,
    },
  };

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
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

  // Step 4: Remove topic nodes that ended up with no subtopics
  return result.filter(t => (t.subtopics || []).length > 0);
};

const extractTopicsAdvanced = async (text) => {
  // 24 000 chars ≈ 7-8 PDF pages — captures rich chapters fully
  const doc = text.replace(/\s+/g, ' ').trim().slice(0, 24000);

  const prompt = `You are extracting a knowledge tree from an educational document (textbook chapter, lecture notes, or syllabus).

DOCUMENT:
---
${doc}
---

════════════════════════════════════════════════
RULE 1 — IDENTIFY TOP-LEVEL TOPICS
════════════════════════════════════════════════
Scan the document for EVERY numbered section, heading, or major topic.

• If the document is a CHAPTER (e.g. "Crop Production and Management"):
  Each numbered section inside the chapter (1. Agricultural Practices, 2. Preparation of Soil, 3. Sowing ...) is its OWN separate top-level topic.

• If the document is a SYLLABUS (e.g. "B.Tech Cloud Computing Syllabus"):
  Each Module / Unit (Module 1, Module 2 ...) is a top-level topic.

CRITICAL: Do NOT group multiple numbered sections under an artificial parent.
  ❌ WRONG: { name: "Crop Production", subtopics: ["Irrigation", "Harvesting", "Sowing"] }
  ✓ RIGHT:  Separate top-level topics: "Irrigation", "Harvesting", "Sowing"

════════════════════════════════════════════════
RULE 2 — EXTRACT SUBTOPICS AT EVERY DEPTH
════════════════════════════════════════════════
For EACH top-level topic, extract its internal structure:

  Depth 1 (top-level): "5. Irrigation"
  Depth 2 (sub-section): "5.1 Sources", "5.2 Traditional Methods", "5.3 Modern Methods"
  Depth 3 (leaf items): under "5.2 Traditional Methods" → "Moat", "Chain Pump", "Dhekli", "Rahat"
  Depth 4 (if present): any further breakdown under depth-3 items

Rules:
• Capture EVERY named item: crop names, tool names, chemical names, technique names, species.
• Do NOT flatten — preserve the nesting depth shown in the document.
• Do NOT invent content — only use what the document explicitly states.
• Keep names concise (≤ 60 chars).

════════════════════════════════════════════════
RULE 3 — COUNT CHECK
════════════════════════════════════════════════
Before outputting, count how many numbered sections you found.
If the document has sections "1." through "8.", your topics array MUST have 8 entries — one per section.

════════════════════════════════════════════════
FULL EXAMPLE (Crop Production chapter → 8 topics)
════════════════════════════════════════════════
{
  "topics": [
    {
      "name": "Agricultural Practices",
      "subtopics": [
        { "name": "Agriculture", "subtopics": [] },
        { "name": "Crop", "subtopics": [] },
        { "name": "Types of Crops", "subtopics": [
          { "name": "Kharif Crops", "subtopics": [] },
          { "name": "Rabi Crops", "subtopics": [] }
        ]}
      ]
    },
    {
      "name": "Preparation of Soil",
      "subtopics": [
        { "name": "Tilling / Ploughing", "subtopics": [] },
        { "name": "Loosening of Soil", "subtopics": [] },
        { "name": "Levelling", "subtopics": [] },
        { "name": "Agricultural Implements", "subtopics": [
          { "name": "Plough", "subtopics": [] },
          { "name": "Hoe", "subtopics": [] },
          { "name": "Cultivator", "subtopics": [] }
        ]}
      ]
    },
    {
      "name": "Sowing",
      "subtopics": [
        { "name": "Selection of Seeds", "subtopics": [] },
        { "name": "Traditional Sowing Tool", "subtopics": [] },
        { "name": "Seed Drill", "subtopics": [] },
        { "name": "Nursery and Transplantation", "subtopics": [] }
      ]
    },
    {
      "name": "Adding Manure and Fertilisers",
      "subtopics": [
        { "name": "Manure", "subtopics": [] },
        { "name": "Fertilisers", "subtopics": [] },
        { "name": "Crop Rotation", "subtopics": [] },
        { "name": "Nitrogen Fixation (Rhizobium)", "subtopics": [] }
      ]
    },
    {
      "name": "Irrigation",
      "subtopics": [
        { "name": "Sources of Irrigation", "subtopics": [] },
        { "name": "Traditional Methods", "subtopics": [
          { "name": "Moat", "subtopics": [] },
          { "name": "Chain Pump", "subtopics": [] },
          { "name": "Dhekli", "subtopics": [] },
          { "name": "Rahat", "subtopics": [] }
        ]},
        { "name": "Modern Methods", "subtopics": [
          { "name": "Sprinkler System", "subtopics": [] },
          { "name": "Drip System", "subtopics": [] }
        ]}
      ]
    },
    {
      "name": "Protection from Weeds",
      "subtopics": [
        { "name": "Weeds", "subtopics": [] },
        { "name": "Weeding", "subtopics": [] },
        { "name": "Weedicides (e.g. 2,4-D)", "subtopics": [] }
      ]
    },
    {
      "name": "Harvesting",
      "subtopics": [
        { "name": "Harvesting", "subtopics": [] },
        { "name": "Threshing", "subtopics": [] },
        { "name": "Harvest Festivals", "subtopics": [] }
      ]
    },
    {
      "name": "Storage",
      "subtopics": [
        { "name": "Drying of Grains", "subtopics": [] },
        { "name": "Winnowing", "subtopics": [] },
        { "name": "Storage Methods", "subtopics": [
          { "name": "Jute Bags", "subtopics": [] },
          { "name": "Metallic Bins", "subtopics": [] },
          { "name": "Silos", "subtopics": [] },
          { "name": "Granaries", "subtopics": [] }
        ]}
      ]
    }
  ]
}

════════════════════════════════════════════════
NOW EXTRACT FROM THE ACTUAL DOCUMENT ABOVE
════════════════════════════════════════════════
Follow the SAME pattern as the example, but use the content from the document.
Respond ONLY with valid JSON — no markdown fences, no explanation, nothing else.

{
  "subject": "Name of the subject or chapter",
  "summary": "2-3 sentence overview of what the document covers",
  "topics": [
    {
      "name": "Section name exactly as in the document",
      "description": "One sentence about this section",
      "subtopics": []
    }
  ],
  "relationships": [],
  "keyTerms": []
}`;

  // ── Admin-section filter ────────────────────────────────────────────────
  // These patterns match section names that are purely syllabus metadata and
  // contain no actual learning content.  Applied AFTER the LLM extracts so we
  // don't accidentally over-restrict the model's extraction.
  const ADMIN_PATTERNS = [
    /^course\s+outcome/i,
    /^learning\s+objective/i,
    /\bco\d+\b/i,                          // "CO1", "CO2", …
    /^modes?\s+of\s+eval/i,
    /^assessment\s+scheme/i,
    /^examination\s+(scheme|pattern)/i,
    /^evaluation\s+scheme/i,
    /^activities?\s*(&|and)?\s*exercises?/i,
    /^references?$/i,
    /^bibliography/i,
    /^attendance/i,
    /^credits?\s*(hours?)?$/i,
    /^faculty\s+info/i,
    /^components?$/i,                      // bare "Components" from eval schemes
    /^quiz\s*\/?\s*assignment/i,
    /^seminar/i,
    /^written\s+exam/i,
  ];

  const isAdminSection = (name) =>
    ADMIN_PATTERNS.some(rx => rx.test((name || '').trim()));

  try {
    // 12 000 tokens — large prompt (with example) + deep nested JSON output for 8+ topics
    const raw    = await generateText(prompt, { temperature: 0.1, numPredict: 12000 });
    const parsed = extractJSON(raw);
    if (!parsed || !Array.isArray(parsed.topics) || parsed.topics.length === 0)
      throw new Error('Invalid topic structure from Ollama');

    // Normalise subtopics at all levels: strings → { name, subtopics: [] }
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
      .map(t => ({
        ...t,
        subtopics: normaliseSubtopics(t.subtopics || []),
      }))
      // deduplicate by name
      .filter((t, i, arr) => arr.findIndex(x => x.name?.toLowerCase() === t.name?.toLowerCase()) === i)
      // remove purely administrative sections (e.g. Course Outcomes, Modes of Evaluation)
      .filter(t => !isAdminSection(t.name));

    console.log(`✅ Ollama extracted ${parsed.topics.length} topics (nested, after dedup + admin filter)`);
    return parsed;
  } catch (err) {
    console.error('extractTopicsAdvanced error:', err.message);
    return { topics: [], relationships: [], summary: '', keyTerms: [] };
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. QUESTION GENERATION
══════════════════════════════════════════════════════════════════════════════ */
const generateDocumentQuestions = async (topicObjects, docSnippet, questionsPerTopic = 3, seed = 0) => {
  const topicList = topicObjects.map(t => typeof t === 'string' ? { name: t } : t);
  const hasDoc    = docSnippet && docSnippet.trim().length > 50;
  const docCtx    = hasDoc ? docSnippet.slice(0, 2000) : '';
  const topics    = topicList;
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
      const topicName   = topicObj.name;
      const parentTopic = topicObj.parentTopic || null;
      const subject     = topicObj.subject     || null;

      const contextLine = [
        subject     && `Subject: "${subject}"`,
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
        const qs  = parseQuestions(raw, topicName, qPerTopic, parentTopic);
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
  const TYPE_MAP  = ['comparison', 'application', 'analysis', 'evaluation', 'synthesis'];
  const questions = [];
  const seen      = new Set();

  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*(\d{1,2})[.)\s]\s*(.+)/);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    const q   = m[2].trim().replace(/\*\*/g, '').replace(/^[\*_]+|[\*_]+$/g, '').trim();
    if (q.length < 25 || !q.includes('?')) continue;
    const key = q.slice(0, 60).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    questions.push({
      id:          `ollama-${topicName}-${questions.length}`,
      question:    q,
      type:        TYPE_MAP[idx % TYPE_MAP.length] ?? 'analysis',
      topic:       topicName,
      parentTopic: parentTopic || undefined,
      difficulty:  idx < 1 ? 'beginner' : idx < 2 ? 'intermediate' : 'advanced',
      source:      'ollama',
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
    const raw    = await generateText(prompt, { temperature: 0.3, numPredict: 800 });
    const parsed = extractJSON(raw);
    if (!parsed || typeof parsed.score !== 'number')
      throw new Error('Invalid evaluation JSON from Ollama');

    const score  = Math.max(0, Math.min(100, Math.round(parsed.score)));
    const rating = score >= 75 ? 'strong' : score >= 45 ? 'partial' : 'weak';

    return {
      score, rating,
      scores: {
        accuracy:      parsed.scores?.accuracy  ?? score,
        depth:         parsed.scores?.depth     ?? score,
        examples:      parsed.scores?.examples  ?? score,
        clarity:       parsed.scores?.clarity   ?? score,
        keyword:       parsed.scores?.accuracy  ?? score,
        length:        parsed.scores?.depth     ?? score,
        understanding: parsed.scores?.examples  ?? score,
      },
      feedback:        parsed.feedback        || 'Evaluated by Ollama',
      strengths:       parsed.strengths       || [],
      improvements:    parsed.improvements    || [],
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
    const raw    = await generateText(prompt, { temperature: 0.25, numPredict: 600 });
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
  const topicNames  = topics.map(t => (typeof t === 'string' ? t : t.name)).filter(Boolean);
  const subjectName = subject || topicNames[0] || 'Course';
  const singleMode  = topicNames.length === 1 && topicNames[0] === subjectName;

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
    const raw    = await generateText(prompt, { temperature: 0.25, numPredict: 3500 });
    const parsed = extractJSON(raw);
    if (!parsed) throw new Error('Invalid dependency JSON');
    if (!Array.isArray(parsed.nodes) || parsed.nodes.length < 2)
      throw new Error('nodes array missing or too short');
    // Strip any coordinates Ollama may have hallucinated
    parsed.nodes = parsed.nodes.map(({ x, y, position, ...rest }) => rest);
    console.log(`✅ Dependency graph: ${parsed.nodes.length} nodes, ${(parsed.edges||[]).length} edges`);
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
  const depsText  = dependencyRelationships.length
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
    const raw    = await generateText(prompt, { temperature: 0.3, numPredict: 1500 });
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
  const scoreStr  = score != null ? `${score}%` : 'not yet quizzed';
  const statusStr = status === 'weak' ? 'weak (needs significant revision)' : 'partially understood';
  const siblings  = siblingContext.length
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
      what:        parsed.what        || '',
      explanation: parsed.explanation || '',
      whyWeak:     parsed.whyWeak     || '',
      gaps:        Array.isArray(parsed.gaps)       ? parsed.gaps.slice(0, 3)       : [],
      studySteps:  Array.isArray(parsed.studySteps) ? parsed.studySteps.slice(0, 3) : [],
    };
  } catch (e) {
    return {
      what:        `"${topicName}" is a subtopic of "${parentTopic}" that requires focused study.`,
      explanation: `${topicName} refers to the methods and processes involved in this area of ${parentTopic}. Understanding this topic requires knowing the key concepts, tools, and procedures that are applied in practice. Review your course material for detailed explanations and worked examples.`,
      whyWeak:     status === 'weak'
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

module.exports = {
  testOllamaConnection,
  generateText,
  extractTopicsAdvanced,
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

