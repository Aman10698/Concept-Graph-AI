const { categorizeByType, categorizeByDifficulty } = require('../services/questionGenerationService');
const ollamaService = require('../services/ollamaService');

/**
 * POST /api/questions
 * Generates 10 unique, document-grounded questions via Ollama.
 * Falls back to template-based only if Ollama is completely unavailable.
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

    // Detect the overall subject from the session if provided
    const subject = req.body.subject || null;
    // Variation seed — used to rotate question style/angle so repeated calls differ
    const seed = _seed || Date.now();

    // Build a FLAT list of topic objects each carrying full hierarchy context.
    //
    // SINGLE-NODE MODE (clicked from mind map):
    //   The frontend sends exactly ONE topic object that already has parentTopic set
    //   (or has _seed, indicating an on-demand per-node request).
    //   In this case we must NOT expand subtopics — only generate for the clicked node.
    //
    // BULK MODE (full-course generation):
    //   Multiple topics sent without parentTopic → expand each into parent + subtopics.
    const isSingleNodeClick =
      topicsFormatted.length === 1 &&
      (topicsFormatted[0].parentTopic !== undefined && topicsFormatted[0].parentTopic !== null ||
       req.body._seed !== undefined);

    const topicObjects = [];

    if (isSingleNodeClick) {
      // Only the clicked node — carry its parentTopic and subject as-is
      const t = topicsFormatted[0];
      topicObjects.push({
        name:        t.name,
        parentTopic: t.parentTopic || null,
        subject:     t.subject || subject || null,
        subtopics:   [],
      });
    } else {
      // Full-course / bulk mode — expand each topic + its subtopics
      topicsFormatted.forEach(t => {
        const parentName = t.name;
        const subs = (t.subtopics || [])
          .map(s => (typeof s === 'string' ? s : s.name || ''))
          .filter(Boolean);

        // Add the parent topic itself
        topicObjects.push({
          name:        parentName,
          parentTopic: null,
          subject:     subject || null,
          subtopics:   subs,
        });

        // Add each subtopic with the parent as context
        subs.forEach(subName => {
          topicObjects.push({
            name:        subName,
            parentTopic: parentName,
            subject:     subject || null,
          });
        });
      });
    }

    // Give Ollama a large window so it can generate specific, grounded questions
    const docSnippet = extractedText
      ? extractedText.replace(/\s+/g, ' ').trim().slice(0, 8000)
      : '';

    let questions = [];
    let source = 'rule-based';

    // 3–5 questions per topic (scales with complexity).
    // For a single-node click always use MAX so the user gets a full quiz.
    const MIN_PER_TOPIC  = 3;
    const MAX_PER_TOPIC  = 5;
    const uniqueParents  = topicsFormatted.length;
    const questionsPerTopic = isSingleNodeClick
      ? MAX_PER_TOPIC
      : uniqueParents <= 3 ? MAX_PER_TOPIC : uniqueParents <= 6 ? 4 : MIN_PER_TOPIC;

    const MAX_Q = questionsPerTopic * topicObjects.length;

    // ── Try Ollama ────────────────────────────────────────────────
    try {
      const isRunning = await ollamaService.testOllamaConnection();

      if (isRunning) {
        console.log(`🦙 Generating questions via Ollama (${questionsPerTopic}/topic, ${topicObjects.length} topic+subtopic entries, seed=${seed})...`);
        questions = await ollamaService.generateDocumentQuestions(topicObjects, docSnippet, questionsPerTopic, seed);
        source = 'ollama';
        console.log(`\u2705 Ollama generated ${questions.length} questions`);
      }
    } catch (ollamaErr) {
      console.warn('\u26a0\ufe0f  Ollama unavailable:', ollamaErr.message);
    }

    // ── Fallback if Ollama returned nothing ───────────────────────
    if (questions.length === 0) {
      console.log('📝 Falling back to template questions...');
      const { generateQuestionsFromTopics } = require('../services/questionGenerationService');
      const tpl = generateQuestionsFromTopics(topicsFormatted);
      questions = tpl.questions.slice(0, MAX_Q);
      source = 'templates';
    }

    // Hard cap — never return more than MAX_Q questions
    const capped = questions.slice(0, MAX_Q);

    const result = {
      questions: capped,
      totalQuestions: capped.length,
      questionsByType: categorizeByType(capped),
      questionsByDifficulty: categorizeByDifficulty(capped),
      source,
    };

    res.status(200).json({
      success: true,
      message: `Generated ${result.questions.length} questions via ${source}`,
      data: result,
    });
  } catch (error) {
    console.error('Question generation error:', error);
    res.status(500).json({ success: false, message: 'Error generating questions', error: error.message });
  }
};

module.exports = { generateQuestionsController };
