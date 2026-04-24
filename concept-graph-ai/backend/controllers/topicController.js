const topicExtractionService = require('../services/topicExtractionService');
const ollamaService = require('../services/ollamaService');

/**
 * POST /api/topics
 * Full Ollama-powered topic extraction with rich hierarchical structure.
 * Falls back to rule-based only if Ollama is completely unavailable.
 */
const extractTopics = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ success: false, message: 'Text content is required' });
    }
    if (text.trim().length < 50) {
      return res.status(400).json({ success: false, message: 'Text must be at least 50 characters long' });
    }

    let result = null;

    // ── Try Ollama (primary) ────────────────────────────────────
    try {
      const isRunning = await ollamaService.testOllamaConnection();
      if (isRunning) {
        console.log('🦙 Using Ollama (llama3.1) for deep topic extraction...');
        const ollamaResult = await ollamaService.extractTopicsAdvanced(text);

        if (ollamaResult?.topics?.length > 0) {
          // Ollama now returns rich objects: { name, description, subtopics[] }
          const topics = ollamaResult.topics.map(t => ({
            name:        typeof t === 'string' ? t : (t.name || 'Unknown'),
            description: t.description || '',
            subtopics:   Array.isArray(t.subtopics)
              ? t.subtopics.map(s => (typeof s === 'string' ? s : (s.name || s)))
              : [],
          }));

          result = {
            topics,
            subject:       ollamaResult.subject       || topics[0]?.name || 'Concept Map',
            summary:       ollamaResult.summary       || '',
            relationships: ollamaResult.relationships || [],
            keyTerms:      ollamaResult.keyTerms      || [],
            allKeywords:   topics.map(t => t.name),
            confidence:    0.96,
            source:        'ollama',
          };
          console.log(`✅ Ollama extracted ${topics.length} topics`);
        }
      }
    } catch (ollamaErr) {
      console.warn('⚠️  Ollama unavailable, falling back to rule-based:', ollamaErr.message);
    }

    // ── Fallback: rule-based ────────────────────────────────────
    if (!result) {
      console.log('📊 Using rule-based topic extraction...');
      result = topicExtractionService.identifyTopicsAndSubtopics(text);
      result.source = 'rule-based';
      console.log(`✅ Rule-based extracted ${result.topics.length} topics`);
    }

    res.status(200).json({
      success: true,
      message: `Topics extracted via ${result.source}`,
      data: result,
    });
  } catch (error) {
    console.error('Topic extraction error:', error);
    res.status(500).json({ success: false, message: 'Error extracting topics', error: error.message });
  }
};

module.exports = { extractTopics };
