/**
 * Ollama Service — Full AI Pipeline
 * Every function uses Ollama (llama3.1) to its maximum capability.
 * Structured prompts, strict JSON output, multi-pass parsing, rich context.
 */

const axios = require('axios');

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL    = process.env.OLLAMA_MODEL || 'llama3.1';

/* ─── raw generation ──────────────────────────────────────────────────────── */
const generateText = async (prompt, options = {}) => {
  const response = await axios.post(
    `${OLLAMA_BASE_URL}/api/generate`,
    {
      model: options.model || OLLAMA_MODEL,
      prompt,
      stream: false,
      options: {
        temperature:    options.temperature  ?? 0.6,
        top_p:          options.topP         ?? 0.9,
        num_predict:    options.numPredict   ?? 1200,
        num_ctx:        8192,   // allow full 8 k-token context window for long documents
        repeat_penalty: options.repeatPenalty ?? 1.2,
      },
    },
    { timeout: 300_000 }   // 5 minutes — large document prompts can be slow
  );
  return response.data.response.trim();
};

/* helper: extract first JSON object from a possibly noisy response */
const extractJSON = (text) => {
  // 1. try direct parse
  try { return JSON.parse(text); } catch (_) { /* fall through */ }
  // 2. strip markdown code fences
  const stripped = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch (_) { /* fall through */ }
  // 3. grab first {...} block
  const match = stripped.match(/\{[\s\S]*\}/);
  if (match) { try { return JSON.parse(match[0]); } catch (_) { /* fall through */ } }
  return null;
};

/* ─── connection test ──────────────────────────────────────────────────────── */
const testOllamaConnection = async () => {
  try {
    const res = await axios.get(`${OLLAMA_BASE_URL}/api/tags`, { timeout: 5000 });
    return res.status === 200;
  } catch {
    return false;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   1. TOPIC EXTRACTION
   Reads the full document and returns a rich hierarchical topic structure.
══════════════════════════════════════════════════════════════════════════════ */
const extractTopicsAdvanced = async (text) => {
  const doc = text.replace(/\s+/g, ' ').trim().slice(0, 12000);

  const prompt = `You are an expert academic curriculum analyst.

Read the following document and extract a comprehensive, hierarchical knowledge structure.

DOCUMENT:
---
${doc}
---

Your task: Identify the main subject, its core topics, and detailed subtopics.

RULES:
- Extract 5 to 10 main TOPICS (not single words — meaningful concept phrases)
- Each topic must have 3 to 6 SUBTOPICS that are specific concepts from the document
- Subtopics must be distinct from each other and from the topic name
- The subject name should reflect the overall subject of the document
- Base everything strictly on the document content — do not invent topics

Respond ONLY with valid JSON, no explanation, no markdown:
{
  "subject": "Overall subject name",
  "summary": "2-3 sentence summary of what this document covers",
  "topics": [
    {
      "name": "Topic Name",
      "description": "One sentence describing this topic",
      "subtopics": ["Subtopic 1", "Subtopic 2", "Subtopic 3", "Subtopic 4"]
    }
  ],
  "relationships": [
    { "from": "Topic A", "to": "Topic B", "type": "prerequisite" }
  ],
  "keyTerms": ["term1", "term2", "term3"]
}`;

  try {
    const raw = await generateText(prompt, { temperature: 0.2, numPredict: 3000 });
    const parsed = extractJSON(raw);

    if (!parsed || !Array.isArray(parsed.topics) || parsed.topics.length === 0) {
      throw new Error('Invalid topic structure from Ollama');
    }

    console.log(`✅ Ollama extracted ${parsed.topics.length} topics with subtopics`);
    return parsed;
  } catch (err) {
    console.error('extractTopicsAdvanced error:', err.message);
    return { topics: [], relationships: [], summary: '', keyTerms: [] };
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   2. QUESTION GENERATION
   Generates 3 questions per topic — explicitly tagged and context-aware.
   topicObjects: Array of { name, parentTopic?, subject?, subtopics? }
══════════════════════════════════════════════════════════════════════════════ */
const generateDocumentQuestions = async (topicObjects, docSnippet, questionsPerTopic = 3, seed = 0) => {
  // Accept plain string array for backwards compat
  const topicList = topicObjects.map(t =>
    typeof t === 'string' ? { name: t } : t
  );

  const hasDoc   = docSnippet && docSnippet.trim().length > 50;
  const docCtx   = hasDoc ? docSnippet.slice(0, 3000) : '';
  const topics   = topicList.slice(0, 8);
  const qPerTopic = Math.max(1, questionsPerTopic);

  // Rotate question angle/style based on seed so repeated calls differ
  const ANGLES = [
    'definition and explanation (focus on what it is, why it matters, key properties)',
    'real-world application (focus on how and where it is used in practice)',
    'analysis and comparison (focus on pros/cons, trade-offs, or comparing with alternatives)',
    'problem-solving and design (focus on how to use or implement it in a scenario)',
    'evaluation and critique (focus on limitations, edge cases, and when NOT to use it)',
  ];
  const angleIndex = Math.floor(seed / 1000) % ANGLES.length;
  const questionAngle = ANGLES[angleIndex];

  console.log(`🦙 Generating ${qPerTopic} questions per topic for ${topics.length} topics in parallel (angle: ${questionAngle})...`);

  const perTopicPromises = topics.map(async (topicObj) => {
    const topicName   = topicObj.name;
    const parentTopic = topicObj.parentTopic || null;
    const subject     = topicObj.subject     || null;

    // Build a precise context line so the AI knows the FULL hierarchy
    const contextLine = [
      subject     && `Subject: "${subject}"`,
      parentTopic && `Parent topic: "${parentTopic}"`,
      `Topic: "${topicName}"`,
    ].filter(Boolean).join(' | ');

    // Tell the AI explicitly how narrow to focus
    const focusInstruction = parentTopic
      ? `Write questions about "${topicName}" SPECIFICALLY as it applies within "${parentTopic}".${
          subject ? ` This is part of the "${subject}" subject.` : ''
        } Do NOT ask about ${parentTopic}-unrelated uses of "${topicName}".`
      : `Write questions SPECIFICALLY about "${topicName}"${subject ? ` in the context of "${subject}"` : ''}.`;

    const prompt = `You are a university professor writing exam questions.
${docCtx ? `Course material:\n"""\n${docCtx}\n"""\n` : ''}
${contextLine}

${focusInstruction}

Question style for this set: ${questionAngle}.

Write exactly ${qPerTopic} exam question${qPerTopic > 1 ? 's' : ''} in that style.

RULES:
- Every question MUST be directly about "${topicName}" in the context of "${parentTopic || subject || topicName}".
- Name SPECIFIC concepts, techniques, or examples from this domain.
- Every question MUST end with a question mark.
- No generic or off-topic questions. Do not ask about other subjects.
- No markdown bold or formatting.
${qPerTopic > 1 ? '- Vary depth: beginner, intermediate, advanced.' : ''}

Output ONLY the numbered list:
${Array.from({ length: qPerTopic }, (_, i) => `${i + 1}.`).join('\n')}`;

    try {
      const raw = await generateText(prompt, { temperature: 0.65, numPredict: 200 * qPerTopic });
      const qs  = parseQuestions(raw, topicName, qPerTopic, parentTopic);
      console.log(`  ${qs.length > 0 ? '✅' : '⚠️ '} ${topicName}${parentTopic ? ` (${parentTopic})` : ''}: ${qs.length} questions`);
      return qs;
    } catch (err) {
      console.warn(`  ⚠️  ${topicName} failed:`, err.message);
      return [];
    }
  });

  try {
    const results      = await Promise.all(perTopicPromises);
    const allQuestions = results.flat();
    console.log(`✅ Total: ${allQuestions.length} questions across ${topics.length} topics`);
    return allQuestions;
  } catch (err) {
    console.error('generateDocumentQuestions error:', err.message);
    return [];
  }
};

// Internal helper — parse numbered lines into question objects
const parseQuestions = (raw, topicName, limit = 3, parentTopic = null) => {

  const TYPE_MAP = ['comparison', 'application', 'analysis', 'evaluation', 'synthesis'];
  const lines = raw.split('\n');
  const questions = [];
  const seen = new Set();

  for (const line of lines) {
    const m = line.match(/^\s*(\d{1,2})[.)\s]\s*(.+)/);
    if (!m) continue;
    const idx = parseInt(m[1], 10) - 1;
    const q = m[2].trim().replace(/\*\*/g, '').replace(/^[\*_]+|[\*_]+$/g, '').trim();

    if (q.length < 25)    continue;
    if (!q.includes('?')) continue;

    const TEMPLATE_PHRASES = [
      'compare and contrast two concepts', 'explain the process or mechanism',
      'analyse a real-world application',  'analyze a real-world application',
      'evaluate the advantages and limitations', 'explain the relationship between two ideas',
    ];
    if (TEMPLATE_PHRASES.some(p => q.toLowerCase().startsWith(p))) continue;

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
   Deep AI evaluation — scores, specific feedback, missing concepts, strengths.
══════════════════════════════════════════════════════════════════════════════ */
const evaluateAnswer = async (question, studentAnswer, keyConceptsHint = []) => {
  const conceptsNote = keyConceptsHint.length
    ? `Key concepts expected: ${keyConceptsHint.join(', ')}`
    : '';

  const prompt = `You are an experienced professor evaluating a student's exam answer.

QUESTION:
${question}

STUDENT'S ANSWER:
${studentAnswer}

${conceptsNote}

Evaluate the answer on these 4 dimensions (each scored 0–100):
1. Conceptual accuracy — are the facts and concepts correct?
2. Depth of explanation — does the student go beyond surface-level?
3. Use of examples — are relevant examples or real-world cases provided?
4. Clarity and structure — is the answer well-organised and clear?

Then compute an overall score (weighted average: accuracy 35%, depth 30%, examples 20%, clarity 15%).

RULES:
- Be honest and critical — do not inflate scores
- Strengths and improvements must be SPECIFIC to this answer, not generic advice
- Missing concepts must be actual concepts the student omitted
- Feedback must be 2–3 sentences of targeted, actionable advice

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "scores": {
    "accuracy": 0-100,
    "depth": 0-100,
    "examples": 0-100,
    "clarity": 0-100
  },
  "score": 0-100,
  "rating": "strong" | "partial" | "weak",
  "feedback": "Targeted 2-3 sentence feedback",
  "strengths": ["specific strength 1", "specific strength 2"],
  "improvements": ["specific improvement 1", "specific improvement 2"],
  "missingConcepts": ["concept A", "concept B"]
}`;

  try {
    const raw    = await generateText(prompt, { temperature: 0.3, numPredict: 1000 });
    const parsed = extractJSON(raw);

    if (!parsed || typeof parsed.score !== 'number') {
      throw new Error('Invalid evaluation JSON from Ollama');
    }

    const score  = Math.max(0, Math.min(100, Math.round(parsed.score)));
    const rating = score >= 75 ? 'strong' : score >= 45 ? 'partial' : 'weak';

    return {
      score,
      rating,
      scores: {
        accuracy:  parsed.scores?.accuracy  ?? score,
        depth:     parsed.scores?.depth     ?? score,
        examples:  parsed.scores?.examples  ?? score,
        clarity:   parsed.scores?.clarity   ?? score,
        // keep legacy keys for backwards compat
        keyword:   parsed.scores?.accuracy  ?? score,
        length:    parsed.scores?.depth     ?? score,
        understanding: parsed.scores?.examples ?? score,
      },
      feedback:        parsed.feedback        || 'Evaluated by AI',
      strengths:       parsed.strengths       || [],
      improvements:    parsed.improvements    || [],
      missingConcepts: parsed.missingConcepts || [],
      source: 'ollama',
    };
  } catch (err) {
    console.error('evaluateAnswer error:', err.message);
    // graceful degradation
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════════════════
   4. WEAKNESS / ROOT-CAUSE ANALYSIS
   Given a weak topic, traces which prerequisite concepts are the root cause.
══════════════════════════════════════════════════════════════════════════════ */
const analyzeWeakness = async (weakTopic, allTopics, evaluationData) => {
  const topicList = allTopics
    .map(t => (typeof t === 'string' ? t : t.name))
    .filter(Boolean)
    .join(', ');

  const scores = Object.entries(evaluationData)
    .map(([t, e]) => `  ${t}: ${e?.rating ?? 'unknown'} (score: ${e?.score ?? '?'})`)
    .join('\n') || '  No evaluation data';

  const prompt = `You are an expert learning diagnostician.

A student is struggling with: "${weakTopic}"

All topics in their curriculum: ${topicList}

Their performance across topics:
${scores}

Your task: Perform a deep root-cause analysis.

RULES:
- Identify 3–5 PREREQUISITE concepts the student must master before they can understand "${weakTopic}"
- Explain WHY each prerequisite matters — be specific
- Identify the ROOT CAUSE (the single most fundamental gap)
- Suggest a concrete, step-by-step study plan
- Base your analysis on the performance data above

Respond ONLY with valid JSON:
{
  "weakTopic": "${weakTopic}",
  "rootCause": "The single most fundamental gap in one sentence",
  "prerequisites": [
    {
      "concept": "Prerequisite concept name",
      "why": "Why this must be mastered first",
      "priority": "high" | "medium" | "low"
    }
  ],
  "studyPlan": [
    "Step 1: ...",
    "Step 2: ...",
    "Step 3: ..."
  ],
  "estimatedRevisionTime": "e.g. 3–4 hours",
  "relatedWeakAreas": ["topic1", "topic2"]
}`;

  try {
    const raw    = await generateText(prompt, { temperature: 0.3, numPredict: 1000 });
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
   Two prompt modes:
   • singleTopic  — "what must a student know BEFORE understanding X?"
   • fullCourse   — prerequisite hierarchy across all course topics
══════════════════════════════════════════════════════════════════════════════ */
const analyzeDependencies = async (topics, docSnippet = '', subject = '') => {
  const topicNames  = topics.map(t => (typeof t === 'string' ? t : t.name)).filter(Boolean);
  const subjectName = subject || topicNames[0] || 'Course';
  const singleMode  = topicNames.length === 1 && topicNames[0] === subjectName;

  // ── SINGLE-TOPIC MODE ─────────────────────────────────────────────────────
  // Called when the student is weak in one specific topic.
  // Goal: "What external foundational knowledge do I need BEFORE I can understand this topic?"
  const singleTopicPrompt = `You are a university professor and curriculum expert.

A student is struggling with the topic: "${subjectName}"

Your task: Build a prerequisite tree showing the EXTERNAL foundational knowledge the student must master BEFORE they can understand "${subjectName}".

IMPORTANT RULES:
- Do NOT include "${subjectName}" as a child of itself
- Do NOT include other topics from the same course — only external foundational concepts
- Level 1 should be 3-4 direct prerequisites of "${subjectName}" (e.g. mathematical concepts, CS fundamentals)
- Level 2 should be prerequisites OF those Level-1 concepts
- Level 3 should be the most basic foundations (arithmetic, logic, etc.)

Good examples of external prerequisite concepts:
- "Basic Probability", "Combinatorics", "Set Theory", "Linear Algebra", "Calculus"
- "Graph Theory", "Data Structures", "Algorithm Analysis", "Formal Logic"
- "Boolean Algebra", "Basic Statistics", "Discrete Mathematics", "Basic Mathematics"

Tree structure:
- Level 0 (1 node): "${subjectName}" — the weak topic itself (root)
- Level 1 (3-4 nodes): Direct external prerequisites needed to understand "${subjectName}"
- Level 2 (1 per Level-1 node): Prerequisite of each Level-1 concept
- Level 3 (1 per Level-2 node): Most fundamental concept underlying Level-2

Return ONLY valid JSON, no markdown, no explanation:
{
  "treeNodes": [
    { "id": "root", "name": "${subjectName}", "level": 0, "parentId": null },
    { "id": "l1-0", "name": "Direct Prerequisite A", "level": 1, "parentId": "root" },
    { "id": "l1-1", "name": "Direct Prerequisite B", "level": 1, "parentId": "root" },
    { "id": "l1-2", "name": "Direct Prerequisite C", "level": 1, "parentId": "root" },
    { "id": "l2-0", "name": "Foundation of A", "level": 2, "parentId": "l1-0" },
    { "id": "l2-1", "name": "Foundation of B", "level": 2, "parentId": "l1-1" },
    { "id": "l2-2", "name": "Foundation of C", "level": 2, "parentId": "l1-2" },
    { "id": "l3-0", "name": "Basic Foundation", "level": 3, "parentId": "l2-0" },
    { "id": "l3-1", "name": "Basic Foundation", "level": 3, "parentId": "l2-1" },
    { "id": "l3-2", "name": "Basic Foundation", "level": 3, "parentId": "l2-2" }
  ],
  "dependencies": [],
  "recommendedOrder": [],
  "criticalPath": []
}`;

  // ── FULL-COURSE MODE ──────────────────────────────────────────────────────
  const fullCoursePrompt = `You are a curriculum design expert. Build a precise 3-level prerequisite hierarchy for a university course.

Course subject: "${subjectName}"
Course topics (Level 1): ${topicNames.join(', ')}

Generate a tree with these levels:
- Level 0 (root, 1 node): The course subject itself
- Level 1 (${topicNames.length} nodes): Exactly the course topics listed above
- Level 2 (1 node per Level-1 topic): ONE external foundational concept required BEFORE studying that topic. Must NOT be one of the listed course topics. Examples: "Basic Probability", "Set Theory", "Linear Algebra", "Graph Theory", "Calculus", "Combinatorics", "Data Structures", "Propositional Logic"
- Level 3 (1 node per Level-2 node): ONE even more fundamental prerequisite. Examples: "Basic Mathematics", "Arithmetic", "Formal Logic", "Boolean Algebra"

STRICT RULES:
- Level 2 must be EXTERNAL concepts not from the course topics list
- Every Level-1 topic must have exactly 1 Level-2 child
- Every Level-2 node must have exactly 1 Level-3 child
- Keep IDs: "root", "l1-0", "l1-1", "l2-0", "l2-1", "l3-0", "l3-1", etc.

Return ONLY valid JSON:
{
  "treeNodes": [
    { "id": "root", "name": "${subjectName}", "level": 0, "parentId": null },
    { "id": "l1-0", "name": "Topic Name", "level": 1, "parentId": "root" },
    { "id": "l2-0", "name": "External Prereq", "level": 2, "parentId": "l1-0" },
    { "id": "l3-0", "name": "Foundation", "level": 3, "parentId": "l2-0" }
  ],
  "dependencies": [],
  "recommendedOrder": [],
  "criticalPath": []
}`;

  const prompt = singleMode ? singleTopicPrompt : fullCoursePrompt;

  try {
    const raw    = await generateText(prompt, { temperature: 0.2, numPredict: 3500 });
    const parsed = extractJSON(raw);
    if (!parsed) throw new Error('Invalid dependency JSON');
    // Validate treeNodes present
    if (!Array.isArray(parsed.treeNodes) || parsed.treeNodes.length < 2) {
      throw new Error('treeNodes missing or too short');
    }
    console.log(`✅ Dependency tree: ${parsed.treeNodes.length} nodes across ${Math.max(...parsed.treeNodes.map(n => n.level)) + 1} levels`);
    return parsed;
  } catch (err) {
    console.error('analyzeDependencies error:', err.message);
    return null;
  }
};


/* ═══════════════════════════════════════════════════════════════════════════
   6. LEARNING PATH GENERATION
   For each weak topic: build a prerequisite-aware recovery path.
══════════════════════════════════════════════════════════════════════════════ */
const generateLearningPath = async (weakTopics, allTopics, dependencyRelationships = [], docSnippet = '') => {
  if (!weakTopics?.length) return [];

  const topicList = allTopics.join(', ');
  const depsText  = dependencyRelationships.length
    ? dependencyRelationships
        .map(r => `"${r.source}" must be understood before "${r.target}" (${r.type || 'prerequisite'})`)
        .join('\n')
    : 'No dependency data available.';
  const docCtx = docSnippet ? docSnippet.slice(0, 2000) : '';

  const prompt = `You are an expert learning advisor.

${docCtx ? `Course material summary:\n"""\n${docCtx}\n"""\n` : ''}
All topics in this course: ${topicList}

Known prerequisite relationships:
${depsText}

The student is WEAK in the following topics: ${weakTopics.join(', ')}

For EACH weak topic, generate a step-by-step recovery learning path.
Each path should start with foundational prerequisites, then build up to the weak topic itself.

RULES:
- Only include topics that actually exist in the course topic list above.
- Each step must have a clear action: "Revise" (if already seen), "Learn" (new), or "Practice" (apply knowledge).
- Keep steps concise and actionable.
- The LAST step for each topic should always be practicing the weak topic itself.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "paths": [
    {
      "weakTopic": "TopicName",
      "summary": "One sentence describing the recovery strategy",
      "estimatedTime": "X hours",
      "steps": [
        { "order": 1, "topic": "PrerequisiteTopic", "action": "Revise", "reason": "Why this comes first" },
        { "order": 2, "topic": "AnotherTopic",      "action": "Learn",  "reason": "Builds foundation for WeakTopic" },
        { "order": 3, "topic": "WeakTopicName",     "action": "Practice","reason": "Now apply everything learned" }
      ]
    }
  ]
}`;

  try {
    const raw    = await generateText(prompt, { temperature: 0.3, numPredict: 2000 });
    const parsed = extractJSON(raw);
    if (!parsed?.paths) throw new Error('No paths in response');
    console.log(`✅ Learning paths generated for: ${weakTopics.join(', ')}`);
    return parsed.paths;
  } catch (err) {
    console.error('generateLearningPath error:', err.message);
    // Fallback: simple prerequisite-based path from dependency data
    return weakTopics.map(weakTopic => {
      const prereqs = dependencyRelationships
        .filter(r => r.target === weakTopic)
        .map(r => r.source);
      const steps = [
        ...prereqs.map((p, i) => ({ order: i + 1, topic: p, action: 'Revise', reason: `Required prerequisite for ${weakTopic}` })),
        { order: prereqs.length + 1, topic: weakTopic, action: 'Practice', reason: 'Apply your revised knowledge' },
      ];
      return { weakTopic, summary: `Revise prerequisites then tackle ${weakTopic}.`, estimatedTime: `${steps.length + 1} hours`, steps };
    });
  }
};

/* ─── legacy wrapper (kept for backwards compat) ───────────────────────────── */
const generateAdvancedQuestions = async (topics, context = '') => {
  const topicObjects = Array.isArray(topics)
    ? topics.map(t => (typeof t === 'string' ? { name: t } : t))
    : [{ name: topics }];
  return generateDocumentQuestions(topicObjects, context)
    .then(qs => qs.map(q => q.question));
};

module.exports = {
  testOllamaConnection,
  generateText,
  extractTopicsAdvanced,
  generateDocumentQuestions,
  generateAdvancedQuestions,   // legacy
  evaluateAnswer,
  analyzeWeakness,
  analyzeDependencies,
  generateLearningPath,
};
