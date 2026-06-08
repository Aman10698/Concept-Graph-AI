const { categorizeByType, categorizeByDifficulty } = require('../services/questionGenerationService');
const ollamaService = require('../services/ollamaWorkerService');  // ★ runs in isolated subprocess

/**
 * POST /api/questions
 * Generates unique, document-grounded questions via Gemini.
 * Falls back to template-based only if Gemini throws.
 */
const generateQuestionsController = async (req, res) => {
  try {
    const { topics, extractedText = '', _seed } = req.body;

    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ success: false, message: 'Topics array is required' });
    }

    // Normalise topic format — can be strings or { name, subtopics } objects
    const topicsFormatted = topics.map(t =>
      typeof t === 'string' ? { name: t, subtopics: [] } : t
    );

    const subject = req.body.subject || null;
    const seed    = _seed || Date.now();

    // ── SINGLE-NODE MODE vs BULK MODE ────────────────────────────────────────
    const isSingleNodeClick =
      topicsFormatted.length === 1 &&
      (topicsFormatted[0].parentTopic !== undefined && topicsFormatted[0].parentTopic !== null ||
       req.body._seed !== undefined);

    const topicObjects = [];

    if (isSingleNodeClick) {
      const t = topicsFormatted[0];
      topicObjects.push({
        name:        t.name,
        parentTopic: t.parentTopic || null,
        subject:     t.subject || subject || null,
        subtopics:   [],
      });
    } else {
      topicsFormatted.forEach(t => {
        const parentName = t.name;
        const subs = (t.subtopics || [])
          .map(s => (typeof s === 'string' ? s : s.name || ''))
          .filter(Boolean);

        topicObjects.push({ name: parentName, parentTopic: null, subject: subject || null, subtopics: subs });
        subs.forEach(subName => {
          topicObjects.push({ name: subName, parentTopic: parentName, subject: subject || null });
        });
      });
    }

    const docSnippet = extractedText
      ? extractedText.replace(/\s+/g, ' ').trim().slice(0, 8000)
      : '';

    const MIN_PER_TOPIC = 3;
    const MAX_PER_TOPIC = 5;
    const uniqueParents = topicsFormatted.length;
    const questionsPerTopic = isSingleNodeClick
      ? MAX_PER_TOPIC
      : uniqueParents <= 3 ? MAX_PER_TOPIC : uniqueParents <= 6 ? 4 : MIN_PER_TOPIC;

    const MAX_Q = questionsPerTopic * topicObjects.length;

    let questions = [];
    let source = 'rule-based';

    // ── Try Gemini (primary) ──────────────────────────────────────────────────
    try {
      console.log(`✨ Generating questions via Gemini (${questionsPerTopic}/topic, ${topicObjects.length} entries, seed=${seed})...`);
      questions = await ollamaService.generateDocumentQuestions(topicObjects, docSnippet, questionsPerTopic, seed);
      source = 'gemini';
      console.log(`✅ Gemini generated ${questions.length} questions`);
    } catch (geminiErr) {
      console.warn('⚠️  Gemini unavailable:', geminiErr.message);
    }

    // ── Fallback if Gemini returned nothing ───────────────────────────────────
    if (questions.length === 0) {
      console.log('📝 Falling back to template questions...');
      const { generateQuestionsFromTopics } = require('../services/questionGenerationService');
      const tpl = await generateQuestionsFromTopics(topicsFormatted);
      questions = tpl.questions.slice(0, MAX_Q);
      source = 'templates';
    }

    const capped = questions.slice(0, MAX_Q);

    res.status(200).json({
      success: true,
      message: `Generated ${capped.length} questions via ${source}`,
      data: {
        questions:             capped,
        totalQuestions:        capped.length,
        questionsByType:       categorizeByType(capped),
        questionsByDifficulty: categorizeByDifficulty(capped),
        source,
      },
    });
  } catch (error) {
    console.error('Question generation error:', error);
    res.status(500).json({ success: false, message: 'Error generating questions', error: error.message });
  }
};

module.exports = { generateQuestionsController };
