const express = require('express');
const router  = express.Router();
const Session = require('../models/Session');

/* ─── helper: compute masteredCount ─────────────────────────── */
const getMasteredCount = (evaluationData = {}) =>
  Object.values(evaluationData).filter(v => v?.rating === 'strong').length;

/* ══════════════════════════════════════════════════════════════
   POST /api/sessions/:userId
   Create a new session when a syllabus is uploaded.
   Body: { title, subject, extractedText, topicsData, questionsData?, dependencyData? }
══════════════════════════════════════════════════════════════ */
router.post('/sessions/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { title, subject, extractedText, topicsData, questionsData, dependencyData } = req.body;

    const session = await Session.create({
      userId,
      title:          title || 'Untitled Syllabus',
      subject:        subject || topicsData?.subject || '',
      extractedText:  (extractedText || '').substring(0, 50000),
      topicsData:     topicsData     || null,
      questionsData:  questionsData  || null,
      dependencyData: dependencyData || null,
      evaluationData: {},
      topicCount:     topicsData?.topics?.length || 0,
      questionCount:  questionsData?.questions?.length || 0,
      masteredCount:  0,
    });

    console.log(`✅ Session created: ${session._id} for user ${userId}`);
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
        topicsData:     session.topicsData,
        questionsData:  session.questionsData,
        dependencyData: session.dependencyData,
        evaluationData: session.evaluationData || {},
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
    const { questionsData, dependencyData } = req.body;
    const $set = { updatedAt: new Date() };
    if (questionsData  !== undefined) { $set.questionsData  = questionsData;  $set.questionCount = questionsData?.questions?.length || 0; }
    if (dependencyData !== undefined)   $set.dependencyData  = dependencyData;

    const session = await Session.findByIdAndUpdate(req.params.sessionId, { $set }, { new: true }).lean();
    if (!session) return res.status(404).json({ success: false, message: 'Session not found' });

    console.log(`✅ Session data updated: ${req.params.sessionId}`);
    res.json({ success: true, updatedAt: session.updatedAt });
  } catch (err) {
    console.error('❌ PATCH /sessions/data error:', err.message);
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
   Remove a session.
══════════════════════════════════════════════════════════════ */
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    await Session.findByIdAndDelete(req.params.sessionId);
    console.log(`✅ Session deleted: ${req.params.sessionId}`);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ DELETE /sessions error:', err.message);
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
