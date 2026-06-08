const BloomProgress  = require('../models/BloomProgress');
const {
  BLOOM_ORDER,
  diagnoseBloomWeakness,
  generateBloomLearningPath,
  generateDependencyAnalysis,
} = require('../services/bloomService');
// Heavy Ollama calls run in isolated worker subprocesses
const {
  generateBloomQuestions,
  generateMCQQuestions,
  evaluateBloomAnswer,
} = require('../services/ollamaWorkerService');
const { retrieveContext } = require('../services/ragService');

/* ── helper: get or create a bloom progress doc ── */
async function getOrCreate(userId, concept, syllabusId) {
  let doc = await BloomProgress.findOne({ userId, concept });
  if (!doc) {
    doc = new BloomProgress({ userId, concept, syllabusId: syllabusId || '' });
    await doc.save();
  }
  return doc;
}

/* ═══════════════════════════════════════════════════════════════════
   GET  /api/bloom/:concept
   Returns current bloom progress for a concept
═══════════════════════════════════════════════════════════════════ */
exports.getProgress = async (req, res) => {
  try {
    const { userId } = req.query;
    const concept    = decodeURIComponent(req.params.concept);
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const doc = await getOrCreate(userId, concept, req.query.syllabusId);
    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('bloom.getProgress:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════
   GET  /api/bloom/all
   Returns bloom progress for ALL concepts of a user
═══════════════════════════════════════════════════════════════════ */
exports.getAllProgress = async (req, res) => {
  try {
    const { userId, syllabusId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const filter = { userId };
    if (syllabusId) filter.syllabusId = syllabusId;

    const docs = await BloomProgress.find(filter);
    // Return as a map { conceptName: progressDoc }
    const map = Object.fromEntries(docs.map(d => [d.concept, d]));
    res.json({ success: true, data: map });
  } catch (err) {
    console.error('bloom.getAllProgress:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════
   POST /api/bloom/questions
   Body: { userId, concept, bloomLevel, parentTopic, n }
   Returns generated questions for that Bloom level
═══════════════════════════════════════════════════════════════════ */
exports.getQuestions = async (req, res) => {
  try {
    const { userId, concept, bloomLevel, parentTopic, quizType = 'subjective', n = 3, subtopics, syllabusId, ragDocumentId } = req.body;
    if (!userId || !concept || !bloomLevel)
      return res.status(400).json({ error: 'userId, concept, bloomLevel required' });

    if (!BLOOM_ORDER.includes(bloomLevel))
      return res.status(400).json({ error: `Invalid bloomLevel. Must be one of: ${BLOOM_ORDER.join(', ')}` });

    const totalN = Number(n);

    // ── Retrieve RAG context ──────────────────────────────────────────────────
    const ragQuery  = [concept, parentTopic, bloomLevel].filter(Boolean).join(' ');
    const ragContext = await retrieveContext(userId, syllabusId || '', ragQuery, 3, ragDocumentId || null);
    if (ragContext) console.log(`📖 RAG context retrieved (${ragContext.length} chars) for "${concept}"`);

    // ── Module node: subtopics present → distribute questions across all sub-topics ──
    if (Array.isArray(subtopics) && subtopics.length > 0) {
      const perSub = Math.max(1, Math.round(totalN / subtopics.length));

      // ★ Sequential batching — avoids holding all Ollama responses in memory at once
      const questions = [];
      for (const sub of subtopics) {
        const subName = typeof sub === 'string' ? sub : (sub.name || String(sub));
        const fn = quizType === 'objective' ? generateMCQQuestions : generateBloomQuestions;
        const qs = await fn(subName, bloomLevel, concept, perSub, ragContext);
        questions.push(...qs);
      }

      return res.json({ success: true, questions, bloomLevel, concept, quizType, ragUsed: !!ragContext });
    }

    // ── Leaf node: no subtopics → generate for the concept itself ──
    const questions = quizType === 'objective'
      ? await generateMCQQuestions(concept, bloomLevel, parentTopic || '', totalN, ragContext)
      : await generateBloomQuestions(concept, bloomLevel, parentTopic || '', totalN, ragContext);

    res.json({ success: true, questions, bloomLevel, concept, quizType, ragUsed: !!ragContext });
  } catch (err) {
    console.error('bloom.getQuestions:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════
   POST /api/bloom/evaluate
   Body: { userId, concept, bloomLevel, question, answer, syllabusId }
   Evaluates answer, updates progress, returns result
═══════════════════════════════════════════════════════════════════ */
exports.evaluate = async (req, res) => {
  try {
    const { userId, concept, bloomLevel, question, answer, syllabusId, ragDocumentId } = req.body;
    if (!userId || !concept || !bloomLevel || !question || !answer)
      return res.status(400).json({ error: 'userId, concept, bloomLevel, question, answer required' });

    // ── Retrieve RAG context for evaluation grounding ─────────────────────────
    const ragQuery   = [concept, question.slice(0, 120), bloomLevel].filter(Boolean).join(' ');
    const ragContext = await retrieveContext(userId, syllabusId || '', ragQuery, 2, ragDocumentId || null);

    // 1. Evaluate with Ollama (RAG-grounded)
    const result = await evaluateBloomAnswer(concept, question, answer, bloomLevel, ragContext);
    if (!result) return res.status(500).json({ error: 'Evaluation failed' });

    // 2. Update BloomProgress doc
    const doc = await getOrCreate(userId, concept, syllabusId);

    // Update score (use best score across attempts)
    const currentScore = doc.bloom[bloomLevel]?.score ?? 0;
    doc.bloom[bloomLevel].score       = Math.max(currentScore, result.total);
    doc.bloom[bloomLevel].attempts    = (doc.bloom[bloomLevel].attempts ?? 0) + 1;
    doc.bloom[bloomLevel].lastAttempt = new Date();

    // Push to history
    doc.questionHistory.push({
      question,
      bloomLevel,
      studentAnswer:     answer,
      score:             result.total,
      demonstratedLevel: result.demonstratedLevel,
      feedback:          result.feedback,
      missingConcepts:   result.missingConcepts,
    });

    // Recompute overall level and status
    doc.recompute();
    await doc.save();

    res.json({ success: true, result, bloomProgress: doc });
  } catch (err) {
    console.error('bloom.evaluate:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════
   GET  /api/bloom/diagnose/:concept
   Query: { userId, weakLevel }
   Diagnoses root causes of weakness at a given level
═══════════════════════════════════════════════════════════════════ */
exports.diagnose = async (req, res) => {
  try {
    const { userId, weakLevel } = req.query;
    const concept = decodeURIComponent(req.params.concept);
    if (!userId || !weakLevel) return res.status(400).json({ error: 'userId, weakLevel required' });

    // Load all progress docs for this user
    const docs = await BloomProgress.find({ userId });
    const allProgress = Object.fromEntries(docs.map(d => [d.concept, d]));

    const issues = diagnoseBloomWeakness(concept, weakLevel, allProgress);
    res.json({ success: true, concept, weakLevel, issues });
  } catch (err) {
    console.error('bloom.diagnose:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════
   GET  /api/bloom/path/:concept
   Query: { userId, targetLevel }
   Returns step-by-step learning path
═══════════════════════════════════════════════════════════════════ */
exports.learningPath = async (req, res) => {
  try {
    const { userId, targetLevel } = req.query;
    const concept = decodeURIComponent(req.params.concept);
    if (!userId || !targetLevel) return res.status(400).json({ error: 'userId, targetLevel required' });

    const docs = await BloomProgress.find({ userId });
    const allProgress = Object.fromEntries(docs.map(d => [d.concept, d]));

    const steps = generateBloomLearningPath(concept, targetLevel, allProgress);
    res.json({ success: true, concept, targetLevel, steps });
  } catch (err) {
    console.error('bloom.learningPath:', err.message);
    res.status(500).json({ error: err.message });
  }
};

/* ═══════════════════════════════════════════════════════════════════
   POST /api/bloom/analyze-deps
   Body: { concept, bloomLevel, parentTopic, quizResults }
   quizResults: [{ question, correct?: bool, score?: number }]
═══════════════════════════════════════════════════════════════════ */
exports.analyzeDeps = async (req, res) => {
  try {
    const { concept, bloomLevel, parentTopic = '', quizResults = [] } = req.body;
    if (!concept || !bloomLevel)
      return res.status(400).json({ error: 'concept and bloomLevel required' });

    const result = await generateDependencyAnalysis(concept, bloomLevel, parentTopic, quizResults);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('bloom.analyzeDeps:', err.message);
    res.status(500).json({ error: err.message });
  }
};
