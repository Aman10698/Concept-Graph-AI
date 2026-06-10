const router        = require('express').Router();
const Session       = require('../models/Session');
const RagDocument   = require('../models/RagDocument');
const ChatHistory   = require('../models/ChatHistory');
const BloomProgress = require('../models/BloomProgress');
const { deleteDocument } = require('../services/ragService');
const { buildDepGraph, buildModuleDepGraph, buildConceptDepGraph } = require('../services/depGraphService');
const ollamaWorker  = require('../services/ollamaWorkerService');

/* ─── helper: compute masteredCount ─────────────────────────── */
const getMasteredCount = (evaluationData = {}) =>
  Object.values(evaluationData).filter(v => v?.rating === 'strong').length;

/* ══════════════════════════════════════════════════════════════
   POST /api/sessions/module-dep-graph  ← MUST be before :userId wildcard
   POST /api/sessions/dep-graph/analyze  ← MUST be before :userId wildcard
   POST /api/sessions/explain-node       ← MUST be before :userId wildcard
══════════════════════════════════════════════════════════════ */

/* One comprehensive graph for an entire module/chapter */
router.post('/sessions/module-dep-graph', async (req, res) => {
  try {
    const { sessionId, moduleName } = req.body;
    if (!sessionId || !moduleName)
      return res.status(400).json({ success: false, message: 'sessionId and moduleName are required' });

    const session = await Session.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const topicsData     = session.topicsData    || null;
    const evaluationData = session.evaluationData || {};
    const topicDepGraphs = session.topicDepGraphs || {};
    const conceptGraph   = session.conceptGraph   || null;
    const conceptMastery = session.conceptMastery || {};

    // Merge topicDepGraphs scores into evaluationData (legacy path)
    const mergedEval = { ...evaluationData };
    Object.entries(topicDepGraphs).forEach(([name, data]) => {
      if (!mergedEval[name] && data.score != null) {
        mergedEval[name] = { rating: data.rating, score: data.score };
      } else if (mergedEval[name] && data.score != null && mergedEval[name].score == null) {
        mergedEval[name] = { ...mergedEval[name], rating: data.rating, score: data.score };
      }
    });

    let result;
    let isConceptMode = false;

    /* ── NEW PATH: session has a concept graph ── */
    if (conceptGraph?.nodes?.length) {
      isConceptMode = true;
      result = buildConceptDepGraph(conceptGraph, conceptMastery);
      console.log(`✅ module-dep-graph [CONCEPT MODE]: "${moduleName}" → ${result.nodes.length} nodes, ${(result.edges||[]).length} edges`);
    } else {
      /* ── LEGACY PATH: topic hierarchy ── */
      result = buildModuleDepGraph(moduleName, topicsData, mergedEval, topicDepGraphs);
      console.log(`✅ module-dep-graph [LEGACY]: "${moduleName}" → ${result.nodes.length} nodes (${result.quizzedCount}/${result.totalCount} quizzed)`);
    }

    // Ask Ollama for a module-level root cause if there are weak nodes
    let rootCause = '';
    if ((result.weakNodes || []).length > 0) {
      try {
        const ollamaResult = await ollamaWorker.analyzeWeakness(
          moduleName, result.weakNodes, result.scores
        );
        rootCause = ollamaResult?.rootCause || '';
      } catch (e) {
        console.warn(`⚠️ Ollama module analysis failed: ${e.message}`);
      }
    }

    res.json({
      success: true,
      data: {
        ...result,
        rootCause,
        isConceptMode,
        // Expose root causes array for concept mode visualization
        rootCauses: result.rootCauses || [],
      },
    });
  } catch (err) {
    console.error('❌ module-dep-graph error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});
router.post('/sessions/dep-graph/analyze', async (req, res) => {
  try {
    const { sessionId, topicName } = req.body;
    if (!sessionId || !topicName) {
      return res.status(400).json({ success: false, message: 'sessionId and topicName are required' });
    }
    const session = await Session.findById(sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    const topicsData     = session.topicsData    || null;
    const evaluationData = session.evaluationData || {};
    const topicDepGraphs = session.topicDepGraphs || {};

    const mergedEval = { ...evaluationData };
    Object.entries(topicDepGraphs).forEach(([name, data]) => {
      if (!mergedEval[name] && data.score != null) {
        mergedEval[name] = { rating: data.rating, score: data.score };
      } else if (mergedEval[name] && data.score != null && mergedEval[name].score == null) {
        mergedEval[name] = { ...mergedEval[name], rating: data.rating, score: data.score };
      }
    });

    const { nodes, scores, weakNodes, rootScore, rootRating, recommendedPath } =
      buildDepGraph(topicName, topicsData, mergedEval, topicDepGraphs);

    let ollamaResult = null;
    if (weakNodes.length > 0 || Object.keys(scores).length > 0) {
      try {
        ollamaResult = await ollamaWorker.analyzeWeakness(topicName, weakNodes, scores);
      } catch (e) {
        console.warn(`⚠️  Ollama explanation failed for "${topicName}": ${e.message}`);
      }
    }

    console.log(`✅ dep-graph/analyze: "${topicName}" → ${nodes.length} nodes, Ollama=${!!ollamaResult}`);
    res.json({
      success: true,
      data: {
        topicName, nodes, scores,
        rating: rootRating, score: rootScore, recommendedPath,
        rootCause:             ollamaResult?.rootCause             || '',
        studyPlan:             ollamaResult?.studyPlan             || [],
        explanation:           ollamaResult?.explanation           || '',
        estimatedRevisionTime: ollamaResult?.estimatedRevisionTime || '',
      },
    });
  } catch (err) {
    console.error('❌ dep-graph/analyze error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/sessions/explain-node', async (req, res) => {
  try {
    const { topicName, parentTopic, status, score, siblings = [] } = req.body;
    if (!topicName) return res.status(400).json({ success: false, message: 'topicName is required' });
    const { explainWeakNode } = require('../services/ollamaService');
    const result = await explainWeakNode(topicName, parentTopic || topicName, status || 'weak', score ?? null, siblings);
    res.json({ success: true, data: result });
  } catch (err) {
    console.error('❌ explain-node error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   POST /api/sessions/:userId   ← wildcard, must come AFTER specific routes above
   Create a new session when a syllabus is uploaded.
   Body: { title, subject, extractedText, topicsData, questionsData?, dependencyData? }
══════════════════════════════════════════════════════════════ */
router.post('/sessions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, subject, extractedText, topicsData, questionsData, dependencyData, conceptGraph, mindMap, conceptMastery } = req.body;

    const session = await Session.create({
      userId,
      title:          title || 'Untitled Syllabus',
      subject:        subject || topicsData?.subject || '',
      extractedText:  (extractedText || '').substring(0, 50000),
      topicsData:     topicsData     || null,
      questionsData:  questionsData  || null,
      dependencyData: dependencyData || null,
      conceptGraph:   conceptGraph   || null,
      mindMap:        mindMap        || null,   // ← heading-based mind map
      conceptMastery: conceptMastery || {},
      evaluationData: {},
      topicCount:     topicsData?.topics?.length || (mindMap?.nodes?.length || conceptGraph?.nodes?.length || 0),
      questionCount:  questionsData?.questions?.length || 0,
      masteredCount:  0,
    });

    const mode = conceptGraph ? 'concept' : mindMap ? 'mindmap' : 'legacy';
    console.log(`✅ Session created: ${session._id} for user ${userId} [mode: ${mode}]`);
    res.status(201).json({ success: true, sessionId: session._id.toString(), session: _summary(session) });
  } catch (err) {
    console.error('❌ POST /sessions error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/sessions/user/:userId
   List all sessions for a user (summary only, no bulky text fields).
══════════════════════════════════════════════════════════════ */
router.get('/sessions/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const sessions = await Session.find(
      { userId },
      'title subject topicCount questionCount masteredCount evaluationData createdAt updatedAt'
    ).sort({ updatedAt: -1 }).lean();

    res.json({ success: true, sessions: sessions.map(_summary) });
  } catch (err) {
    console.error('❌ GET /sessions/user error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   GET /api/sessions/:sessionId
   Load full session data (topics, questions, dependencies, evaluations).
══════════════════════════════════════════════════════════════ */
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const session = await Session.findById(req.params.sessionId).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    res.json({
      success: true,
      data: {
        sessionId:      session._id.toString(),
        title:          session.title,
        subject:        session.subject,
        extractedText:  session.extractedText || '',   // ← needed for question grounding
        topicsData:     session.topicsData,
        questionsData:  session.questionsData,
        dependencyData: session.dependencyData,
        conceptGraph:   session.conceptGraph   || null,
        mindMap:        session.mindMap        || null,
        conceptMastery: session.conceptMastery || {},
        evaluationData: session.evaluationData || {},
        topicDepGraphs: session.topicDepGraphs || {},
        topicCount:     session.topicCount,
        questionCount:  session.questionCount,
        masteredCount:  session.masteredCount,
        createdAt:      session.createdAt,
        updatedAt:      session.updatedAt,
      },
    });
  } catch (err) {
    console.error('❌ GET /sessions/:id error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /api/sessions/:sessionId/data
   Update questions and/or dependency data after AI processing.
   Body: { questionsData?, dependencyData? }
══════════════════════════════════════════════════════════════ */
router.patch('/sessions/:sessionId/data', async (req, res) => {
  try {
    const { questionsData, dependencyData, topicDepGraphs, conceptGraph, mindMap, conceptMastery } = req.body;
    const $set = { updatedAt: new Date() };
    if (questionsData   !== undefined) { $set.questionsData  = questionsData;  $set.questionCount = questionsData?.questions?.length || 0; }
    if (dependencyData  !== undefined)   $set.dependencyData  = dependencyData;
    if (topicDepGraphs  !== undefined)   $set.topicDepGraphs  = topicDepGraphs;
    if (conceptGraph    !== undefined)   $set.conceptGraph    = conceptGraph;
    if (mindMap         !== undefined)   $set.mindMap         = mindMap;        // ← new
    if (conceptMastery  !== undefined)   $set.conceptMastery  = conceptMastery;

    const session = await Session.findByIdAndUpdate(req.params.sessionId, { $set }, { returnDocument: 'after' }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    console.log(`✅ Session data updated: ${req.params.sessionId}`);
    res.json({ success: true, updatedAt: session.updatedAt });
  } catch (err) {
    console.error('❌ PATCH /sessions/data error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /api/sessions/:sessionId/concept-mastery
   Update per-concept mastery scores for concept-graph-mode sessions.
   Body: { updates: { concept_id: { correct, incorrect, mastery, status } } }
   Uses dot-notation so updates are always additive (safe merge).
══════════════════════════════════════════════════════════════ */
router.patch('/sessions/:sessionId/concept-mastery', async (req, res) => {
  try {
    const { updates } = req.body;
    if (!updates || typeof updates !== 'object')
      return res.status(400).json({ success: false, message: 'updates object required' });

    const $set = { updatedAt: new Date() };
    Object.entries(updates).forEach(([conceptId, data]) => {
      $set[`conceptMastery.${conceptId}`] = { ...data, updatedAt: new Date() };
    });

    const current = await Session.findById(req.params.sessionId)
      .select('conceptMastery topicCount').lean();
    if (!current) return res.status(404).json({ success: false, message: 'Session not found' });

    const merged = { ...(current.conceptMastery || {}), ...updates };
    const masteredCount = Object.values(merged).filter(v => v?.status === 'strong').length;
    $set.masteredCount = masteredCount;

    await Session.findByIdAndUpdate(req.params.sessionId, { $set });
    console.log(`✅ Concept mastery updated: ${req.params.sessionId} — ${Object.keys(updates).length} concept(s)`);
    res.json({ success: true, masteredCount });
  } catch (err) {
    console.error('❌ PATCH /concept-mastery error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /api/sessions/:sessionId/evaluation
   Merge evaluation scores — never overwrites, always merges.
   Body: { evaluationData: { topicName: { rating, score } } }
══════════════════════════════════════════════════════════════ */
router.patch('/sessions/:sessionId/evaluation', async (req, res) => {
  try {
    const { evaluationData } = req.body;
    if (!evaluationData) return res.status(400).json({ success: false, message: 'evaluationData required' });

    // Merge each topic individually (dot-notation update)
    const $set = { updatedAt: new Date() };
    Object.entries(evaluationData).forEach(([topic, data]) => {
      $set[`evaluationData.${topic}`] = { ...data, updatedAt: new Date() };
    });

    // Recompute masteredCount after merge
    const current = await Session.findById(req.params.sessionId).select('evaluationData').lean();
    if (!current) return res.status(404).json({ success: false, message: 'Session not found' });

    const merged = { ...(current.evaluationData || {}), ...evaluationData };
    $set.masteredCount = getMasteredCount(merged);

    await Session.findByIdAndUpdate(req.params.sessionId, { $set });
    console.log(`✅ Evaluation merged for session: ${req.params.sessionId}`);
    res.json({ success: true, masteredCount: $set.masteredCount });
  } catch (err) {
    console.error('❌ PATCH /sessions/evaluation error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   DELETE /api/sessions/:sessionId
   Remove a session AND all its associated data:
     - MongoDB Session document
     - LanceDB vector embeddings (all chunks for this syllabus)
     - MongoDB RagDocument metadata records
     - MongoDB ChatHistory records
═════════════════════════════════════════════════════════════ */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findByIdAndDelete(sessionId).lean();

    if (session) {
      const { userId, _id } = session;
      const syllabusId = _id.toString();

      // 1. Find all RAG documents for this syllabus and delete their LanceDB chunks
      const ragDocs = await RagDocument.find({ userId, syllabusId }).lean();
      for (const doc of ragDocs) {
        try {
          await deleteDocument(userId, doc.documentId);
        } catch (e) {
          console.warn(`⚠️  RAG delete failed for doc ${doc.documentId}:`, e.message);
        }
      }

      // 2. Delete all ChatHistory records for this syllabus's documents
      if (ragDocs.length > 0) {
        const docIds = ragDocs.map(d => d.documentId);
        await ChatHistory.deleteMany({ userId, documentId: { $in: docIds } });
      }

      // 3. Delete all RagDocument metadata records for this syllabus
      await RagDocument.deleteMany({ userId, syllabusId });

      // 4. Delete all BloomProgress records tagged to this syllabus
      const bloomResult = await BloomProgress.deleteMany({ userId, syllabusId });

      console.log(
        `✅ Session + all associated data deleted: ${sessionId}` +
        ` (RAG docs: ${ragDocs.length}, BloomProgress: ${bloomResult.deletedCount})`
      );
    } else {
      console.log(`✅ Session deleted (already absent): ${sessionId}`);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ DELETE /sessions error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════
   PATCH /api/sessions/migrate/:oldUserId/:newUserId
   Re-assign all sessions from one userId to another.
   Use when a user's Firebase UID changes (re-registration etc.).
   Safe: only moves sessions, never deletes.
══════════════════════════════════════════════════════════════ */
router.patch('/sessions/migrate/:oldUserId/:newUserId', async (req, res) => {
  try {
    const { oldUserId, newUserId } = req.params;
    if (!oldUserId || !newUserId || oldUserId === newUserId) {
      return res.status(400).json({ success: false, message: 'oldUserId and newUserId must be different non-empty strings' });
    }
    const result = await Session.updateMany(
      { userId: oldUserId },
      { $set: { userId: newUserId } }
    );
    const count = result.modifiedCount ?? result.nModified ?? 0;
    console.log(`✅ Migrated ${count} sessions from "${oldUserId}" → "${newUserId}"`);
    res.json({ success: true, migrated: count });
  } catch (err) {
    console.error('❌ PATCH /sessions/migrate error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

/* ─── summary shape (for list view) ─────────────────────────── */
function _summary(s) {
  const evalVals = Object.values(s.evaluationData || {});
  const strong   = evalVals.filter(v => v?.rating === 'strong').length;
  // topicCount may be 0 on old sessions — fall back to answered count
  const total    = s.topicCount || evalVals.length || 0;
  return {
    sessionId:    (s._id || s.sessionId)?.toString(),
    title:        s.title,
    subject:      s.subject || '',
    topicCount:   total,
    questionCount:s.questionCount || 0,
    masteredCount:strong,
    progress:     total > 0 ? Math.round((strong / total) * 100) : 0,
    answeredCount:evalVals.length,
    createdAt:    s.createdAt,
    updatedAt:    s.updatedAt,
  };
}

module.exports = router;
