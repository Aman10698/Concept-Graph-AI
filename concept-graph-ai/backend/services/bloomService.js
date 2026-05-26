/**
 * bloomService.js
 * Generates Bloom-level questions and evaluates answers using Ollama.
 */

const { generateText } = require('./ollamaService');

const BLOOM_ORDER = ['remember','understand','apply','analyze','evaluate','create'];

const BLOOM_DESCRIPTORS = {
  remember:  'recall of facts, definitions, key terms, and basic procedures',
  understand:'explanation and interpretation in own words; summarising, classifying',
  apply:     'using knowledge to solve new problems, compute results, or demonstrate procedures',
  analyze:   'breaking down into parts, comparing, identifying relationships and patterns',
  evaluate:  'judging quality, critiquing design decisions, justifying choices with evidence',
  create:    'designing, constructing, or proposing a novel solution or artefact',
};

const BLOOM_VERBS = {
  remember:  'Define, List, Name, Recall, State',
  understand:'Explain, Describe, Summarise, Classify, Interpret',
  apply:     'Solve, Use, Compute, Demonstrate, Implement',
  analyze:   'Compare, Break down, Identify, Examine, Differentiate',
  evaluate:  'Judge, Critique, Justify, Assess, Recommend',
  create:    'Design, Construct, Propose, Develop, Formulate',
};

/* ─── extractJSON helper ──────────────────────────────────────────────── */
function extractJSON(text) {
  try { return JSON.parse(text); } catch (_) { /* fall through */ }
  const s = text.replace(/```(?:json)?/gi,'').replace(/```/g,'').trim();
  try { return JSON.parse(s); } catch (_) { /* fall through */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (_) { /* fall through */ } }
  return null;
}

/* ═══════════════════════════════════════════════════════════════════════
   1. GENERATE BLOOM-LEVEL QUESTIONS
═══════════════════════════════════════════════════════════════════════ */
const generateBloomQuestions = async (concept, bloomLevel, parentTopic = '', n = 3) => {
  const descriptor = BLOOM_DESCRIPTORS[bloomLevel] || bloomLevel;
  const verbs      = BLOOM_VERBS[bloomLevel]       || '';
  const context    = parentTopic ? `Subject area: "${parentTopic}".` : '';

  const prompt = `You are a university professor. ${context}
Write exactly ${n} exam questions about "${concept}" at Bloom's Taxonomy level: ${bloomLevel} (${descriptor}).
Use these verbs as a guide: ${verbs}.
Output ONLY a plain numbered list. No extra text, no markdown, no explanations.
Example format:
1. What is the definition of X?
2. Explain how X works in your own words.
3. Compare X and Y.

Now write ${n} questions about "${concept}" at the ${bloomLevel} level:`;

  try {
    const raw = await generateText(prompt, { temperature: 0.5, numPredict: 800 });
    console.log(`[bloomService] Raw Ollama output for ${bloomLevel}:\n${raw.slice(0, 400)}`);

    const questions = [];

    // Primary parser: numbered list lines  "1. ..." or "1) ..."
    for (const line of raw.split('\n')) {
      const m = line.match(/^\s*\d{1,2}[.)]\s*(.+)/);
      if (!m) continue;
      const q = m[1].trim().replace(/\*\*/g, '').trim();
      if (q.length > 15) {
        questions.push({
          question:   q.endsWith('?') ? q : q + '?',
          bloomLevel,
          concept,
          difficulty: questions.length === 0 ? 'beginner'
                    : questions.length === 1 ? 'intermediate' : 'advanced',
        });
      }
      if (questions.length >= n) break;
    }

    // Fallback: if numbered parser found nothing, take non-empty lines
    if (questions.length === 0) {
      for (const line of raw.split('\n')) {
        const t = line.trim().replace(/\*\*/g, '');
        if (t.length > 20 && !t.startsWith('#') && !t.toLowerCase().startsWith('here')) {
          questions.push({
            question:   t.endsWith('?') ? t : t + '?',
            bloomLevel,
            concept,
            difficulty: questions.length === 0 ? 'beginner'
                      : questions.length === 1 ? 'intermediate' : 'advanced',
          });
        }
        if (questions.length >= n) break;
      }
    }

    console.log(`[bloomService] Parsed ${questions.length} questions for [${bloomLevel}] "${concept}"`);
    return questions;
  } catch (err) {
    console.error('generateBloomQuestions error:', err.message);
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   1b. GENERATE MCQ (OBJECTIVE) QUESTIONS
═══════════════════════════════════════════════════════════════════════ */
const generateMCQQuestions = async (concept, bloomLevel, parentTopic = '', n = 3) => {
  const descriptor = BLOOM_DESCRIPTORS[bloomLevel] || bloomLevel;
  const context    = parentTopic ? `Subject area: "${parentTopic}".` : '';

  // Use a simple line-based format — far more reliable than JSON from Ollama
  const prompt = `You are a university professor. ${context}
Write exactly ${n} multiple-choice questions about "${concept}" at Bloom's level: ${bloomLevel} (${descriptor}).

Use this EXACT format for every question (copy the labels exactly):
Q: [question text]
A: [option A]
B: [option B]
C: [option C]
D: [option D]
ANSWER: [A or B or C or D]
EXPLAIN: [one sentence explaining the correct answer]

Rules:
- All 4 options must be plausible.
- Only one option is correct.
- Each question targets the ${bloomLevel} cognitive level.
- No markdown, no numbering, no extra text.

Write ${n} questions now:`;

  try {
    const raw = await generateText(prompt, { temperature: 0.5, numPredict: 1400 });
    console.log(`[bloomService] MCQ raw:\n${raw.slice(0, 600)}`);

    const mcqs = [];
    // Split into blocks by blank lines or by 'Q:' starts
    const blocks = raw.split(/\n(?=Q:)/i).map(b => b.trim()).filter(Boolean);

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const get = (prefix) => {
        const line = lines.find(l => l.toUpperCase().startsWith(prefix.toUpperCase() + ':'));
        return line ? line.slice(prefix.length + 1).trim() : '';
      };

      const question  = get('Q');
      const optA      = get('A');
      const optB      = get('B');
      const optC      = get('C');
      const optD      = get('D');
      const answerRaw = get('ANSWER');
      const explain   = get('EXPLAIN');

      if (!question || !optA || !optB || !answerRaw) continue; // skip malformed

      const correct = answerRaw.trim().toUpperCase().replace(/[^ABCD]/g, '').charAt(0) || 'A';

      mcqs.push({
        question:    question.endsWith('?') ? question : question + '?',
        options:     { A: optA, B: optB, C: optC || '(no option)', D: optD || '(no option)' },
        correct,
        explanation: explain,
        bloomLevel,
        concept,
        type:        'mcq',
        difficulty:  mcqs.length === 0 ? 'beginner' : mcqs.length === 1 ? 'intermediate' : 'advanced',
      });

      if (mcqs.length >= n) break;
    }

    console.log(`[bloomService] Parsed ${mcqs.length} MCQ for [${bloomLevel}] "${concept}"`);
    return mcqs;
  } catch (err) {
    console.error('generateMCQQuestions error:', err.message);
    return [];
  }
};


/* ═══════════════════════════════════════════════════════════════════════
   2. EVALUATE BLOOM-LEVEL ANSWER
═══════════════════════════════════════════════════════════════════════ */
const evaluateBloomAnswer = async (concept, question, studentAnswer, expectedBloomLevel) => {
  const descriptor = BLOOM_DESCRIPTORS[expectedBloomLevel] || expectedBloomLevel;

  const prompt = `You are a strict but fair university professor evaluating a student's answer.

Concept: "${concept}"
Expected Bloom level: "${expectedBloomLevel}" (${descriptor})

QUESTION:
${question}

STUDENT'S ANSWER:
${studentAnswer}

Evaluate on 4 dimensions (each 0–25):
1. Factual accuracy
2. Depth of reasoning
3. Use of relevant examples or steps
4. Meeting the cognitive demand of "${expectedBloomLevel}"

Also classify the highest Bloom level this answer actually demonstrates:
[remember | understand | apply | analyze | evaluate | create | none]

Respond ONLY with valid JSON (no markdown):
{
  "scores": {
    "accuracy": 0-25,
    "depth": 0-25,
    "examples": 0-25,
    "cognitive": 0-25
  },
  "total": 0-100,
  "demonstratedLevel": "...",
  "feedback": "2-3 sentence targeted feedback",
  "strengths": ["..."],
  "improvements": ["..."],
  "missingConcepts": ["..."]
}`;

  try {
    const raw    = await generateText(prompt, { temperature: 0.2, numPredict: 800 });
    const parsed = extractJSON(raw);
    if (!parsed || typeof parsed.total !== 'number') throw new Error('Invalid eval JSON');

    const total = Math.max(0, Math.min(100, Math.round(parsed.total)));
    const PASS  = { remember:70, understand:70, apply:65, analyze:65, evaluate:60, create:60 };
    const passed = total >= (PASS[expectedBloomLevel] ?? 65);

    return {
      total,
      passed,
      scores: {
        accuracy:  parsed.scores?.accuracy  ?? 0,
        depth:     parsed.scores?.depth     ?? 0,
        examples:  parsed.scores?.examples  ?? 0,
        cognitive: parsed.scores?.cognitive ?? 0,
      },
      demonstratedLevel: parsed.demonstratedLevel || 'none',
      feedback:          parsed.feedback          || '',
      strengths:         parsed.strengths         || [],
      improvements:      parsed.improvements      || [],
      missingConcepts:   parsed.missingConcepts   || [],
      expectedLevel:     expectedBloomLevel,
    };
  } catch (err) {
    console.error('evaluateBloomAnswer error:', err.message);
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════════════
   3. DIAGNOSE BLOOM WEAKNESS
═══════════════════════════════════════════════════════════════════════ */
const diagnoseBloomWeakness = (conceptName, weakLevel, allBloomProgress) => {
  const levelIdx = BLOOM_ORDER.indexOf(weakLevel);
  if (levelIdx < 0) return [];
  const issues = [];

  const self = allBloomProgress[conceptName];
  if (self) {
    for (let i = 0; i < levelIdx; i++) {
      const lvl   = BLOOM_ORDER[i];
      const score = self.bloom?.[lvl]?.score ?? 0;
      if (score < 70) {
        issues.push({
          type:    'same_concept_lower_level',
          concept: conceptName,
          level:   lvl,
          score,
          message: `"${conceptName}" — ${lvl} score is ${score}% (need ≥70%)`,
        });
      }
    }
  }

  const deps = self?.dependencies ?? [];
  deps.forEach(dep => {
    const depProgress = allBloomProgress[dep];
    const depReached  = BLOOM_ORDER.indexOf(depProgress?.bloomLevelReached ?? 'none');
    const required    = Math.max(0, levelIdx - 1);
    if (depReached < required) {
      issues.push({
        type:          'prerequisite_too_weak',
        concept:       dep,
        currentLevel:  depProgress?.bloomLevelReached ?? 'none',
        requiredLevel: BLOOM_ORDER[required],
        message:       `"${dep}" must reach "${BLOOM_ORDER[required]}" before you can ${weakLevel} "${conceptName}"`,
      });
    }
  });

  return issues;
};

/* ═══════════════════════════════════════════════════════════════════════
   4. GENERATE BLOOM LEARNING PATH
═══════════════════════════════════════════════════════════════════════ */
const generateBloomLearningPath = (targetConcept, targetLevel, allBloomProgress) => {
  const targetIdx = BLOOM_ORDER.indexOf(targetLevel);
  if (targetIdx < 0) return [];
  const steps = [];

  const self = allBloomProgress[targetConcept];
  const deps = self?.dependencies ?? [];

  // Step 1 — fix prerequisite concepts
  deps.forEach(dep => {
    const depProgress = allBloomProgress[dep];
    const depReached  = BLOOM_ORDER.indexOf(depProgress?.bloomLevelReached ?? 'none');
    const required    = Math.max(0, targetIdx - 1);
    if (depReached < required) {
      steps.push({
        order:         steps.length + 1,
        concept:       dep,
        bloomLevel:    BLOOM_ORDER[required],
        action:        `Reach "${BLOOM_ORDER[required]}" level in prerequisite "${dep}"`,
        reason:        `Required before "${targetLevel}" in "${targetConcept}"`,
        estimatedTime: '30–45 min',
        type:          'prerequisite',
      });
    }
  });

  // Step 2 — fix gaps in lower levels of target concept
  for (let i = 0; i < targetIdx; i++) {
    const lvl   = BLOOM_ORDER[i];
    const score = self?.bloom?.[lvl]?.score ?? 0;
    if (score < 70) {
      steps.push({
        order:         steps.length + 1,
        concept:       targetConcept,
        bloomLevel:    lvl,
        action:        `Strengthen "${lvl}" of "${targetConcept}" (score: ${score}%)`,
        reason:        `Must pass "${lvl}" before reaching "${targetLevel}"`,
        estimatedTime: '20–30 min',
        type:          'lower_level',
      });
    }
  }

  // Step 3 — practice target level
  steps.push({
    order:         steps.length + 1,
    concept:       targetConcept,
    bloomLevel:    targetLevel,
    action:        `Practice "${targetLevel}" questions for "${targetConcept}"`,
    reason:        'Final target level',
    estimatedTime: '45–60 min',
    type:          'target',
  });

  return steps;
};

/* ========================================================================
   5. AI-POWERED DEPENDENCY ANALYSIS (tree-format)
======================================================================== */
const generateDependencyAnalysis = async (concept, bloomLevel, parentTopic, quizResults) => {
  const context = parentTopic ? `Subject: "${parentTopic}".` : '';
  const score = quizResults.length
    ? Math.round(quizResults.reduce((s, r) =>
        s + (r.correct !== undefined ? (r.correct ? 100 : 0) : (r.score || 0)), 0)
      / quizResults.length)
    : 0;

  const resultsText = quizResults.map((r, i) =>
    `Q${i + 1}: "${r.question}" - ${r.correct !== undefined ? (r.correct ? 'Correct' : 'Wrong') : `Score: ${r.score}%`}`
  ).join('\n');

  // Extract the per-question statuses so we can build nodes directly from the questions
  const questionNodes = quizResults.map((r, i) => {
    const qStatus = r.correct !== undefined
      ? (r.correct ? 'strong' : 'weak')
      : (r.score >= 70 ? 'strong' : r.score >= 40 ? 'partial' : 'weak');
    return { question: r.question, status: qStatus, index: i + 1 };
  });

  // Ask the AI only to label the sub-topics that appear in the quiz questions
  const questionList = questionNodes
    .map(q => `Q${q.index}: "${q.question}"`)
    .join('\n');

  const prompt = `You are an AI tutor. ${context}
A student finished a "${bloomLevel}" Bloom level quiz on the topic "${concept}".
Score: ${score}%.

These are the EXACT quiz questions that were asked:
${questionList}

Your task: For each question above, extract the KEY SUB-TOPIC it is testing (2-5 words).
Then create a dependency tree where:
- Root node is "${concept}" (PARENT: none, STATUS: current)
- Each child node is a sub-topic extracted from ONE of the quiz questions above
- Use ONLY sub-topics from the quiz questions listed above — do NOT invent new topics

Output one node per quiz question PLUS the root, one blank line between each, using this EXACT format:

NODE: [sub-topic name from the question]
PARENT: [parent node name or none]
STATUS: [strong | partial | weak]
REASON: [one sentence referencing the quiz result]

For STATUS, use the quiz result:
${questionNodes.map(q => `Q${q.index} → ${q.status}`).join(', ')}

First node must be "${concept}" with PARENT: none and STATUS: current.
Each PARENT must match a previous NODE exactly.
No extra text. No topics that were not in the quiz questions. Start now:`;

  // ── Helper: deterministic node builder from quiz questions ──────────────
  const buildNodesFromQuestions = () => {
    const root = { name: concept, parent: 'none', status: 'current',
      reason: 'The concept being studied.' };
    const children = questionNodes.map(q => {
      // Use first 4-5 meaningful words of the question as sub-topic label
      const words = q.question
        .replace(/[?]/g, '')
        .split(/\s+/)
        .filter(w => !['what','is','the','a','an','of','how','why','does','do','are','can','in','on','to','for','with','that','this','which','when','where'].includes(w.toLowerCase()));
      const label = words.slice(0, 4).join(' ') || `Topic ${q.index}`;
      return {
        name:   label,
        parent: concept,
        status: q.status,
        reason: `Based on quiz question ${q.index}.`,
      };
    });
    return [root, ...children];
  };

  try {
    const raw = await generateText(prompt, { temperature: 0.3, numPredict: 800 });
    console.log('[bloomService] DepTree raw:\n' + raw.slice(0, 600));

    const nodes = [];
    const blocks = raw.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);

    for (const block of blocks) {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      const get = key => {
        const l = lines.find(x => x.toUpperCase().startsWith(key.toUpperCase() + ':'));
        return l ? l.slice(key.length + 1).trim() : '';
      };
      const name   = get('NODE');
      const parent = get('PARENT');
      const status = get('STATUS').toLowerCase().replace(/\s+/g, '_');
      const reason = get('REASON');
      if (!name) continue;
      const valid = ['current','strong','partial','weak','not_started'];
      nodes.push({
        name,
        parent: /^none$/i.test(parent) ? 'none' : (parent || 'none'),
        status: valid.includes(status) ? status : 'not_started',
        reason,
      });
      if (nodes.length >= 10) break;
    }

    // Guarantee root
    if (!nodes.find(n => n.status === 'current')) {
      nodes.unshift({ name: concept, parent: 'none', status: 'current',
        reason: 'The concept being studied.' });
    }

    // Fallback: if AI gave fewer child nodes than quiz questions, build deterministically
    const childCount = nodes.filter(n => n.status !== 'current').length;
    if (childCount < quizResults.length) {
      console.warn('[bloomService] AI gave fewer nodes than questions — using deterministic fallback');
      const fallback = buildNodesFromQuestions();
      console.log('[bloomService] Fallback nodes:', fallback.length);
      return { score, nodes: fallback };
    }

    console.log('[bloomService] DepTree nodes:', nodes.length);
    return { score, nodes };
  } catch (err) {
    console.error('generateDependencyAnalysis error:', err.message);
    // Deterministic fallback on total failure
    const fallback = buildNodesFromQuestions();
    return { score, nodes: fallback };
  }
};

module.exports = {
  BLOOM_ORDER,
  BLOOM_DESCRIPTORS,
  generateBloomQuestions,
  generateMCQQuestions,
  evaluateBloomAnswer,
  diagnoseBloomWeakness,
  generateBloomLearningPath,
  generateDependencyAnalysis,
};
