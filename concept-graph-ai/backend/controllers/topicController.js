const topicExtractionService = require('../services/topicExtractionService');
const ollamaService = require('../services/ollamaWorkerService');  // ★ runs in isolated subprocess

/**
 * POST /api/topics
 * Gemini-powered topic extraction with rich hierarchical structure.
 * Falls back to rule-based only if Gemini throws.
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

    // ── Try Gemini (primary) ────────────────────────────────────
    try {
      console.log('✨ Using Gemini for deep topic extraction...');
      const geminiResult = await ollamaService.extractTopicsAdvanced(text);

      if (geminiResult?.topics?.length > 0) {
        // Recursively normalize subtopics — preserve full depth, never flatten to strings
        const normalizeSubtopics = (subs) => {
          if (!Array.isArray(subs)) return [];
          return subs
            .map(s => {
              if (typeof s === 'string') return { name: s, description: '', subtopics: [] };
              if (typeof s === 'object' && s !== null) {
                return {
                  name: (s.name || '').trim(),
                  description: s.description || '',
                  subtopics: normalizeSubtopics(s.subtopics || []),
                };
              }
              return null;
            })
            .filter(s => s && s.name.length > 0);
        };

        const topics = geminiResult.topics
          .map(t => ({
            name: typeof t === 'string' ? t : (t.name || ''),
            description: t.description || '',
            subtopics: normalizeSubtopics(t.subtopics || []),
          }))
          .filter(t => t.name.trim().length > 0); // drop any nameless entries

        // Strip course code prefix (e.g. "IFT4528 Cloud Computing" → "Cloud Computing")
        const rawSubject = geminiResult.subject || topics[0]?.name || 'Concept Map';
        const cleanSubject = rawSubject
          .replace(/^[A-Z]{2,6}[-\s]?\d{3,6}\s*/i, '')
          .replace(/[,;:]+$/, '')
          .trim() || rawSubject;

        result = {
          topics,
          subject: cleanSubject,
          summary: geminiResult.summary || '',
          relationships: geminiResult.relationships || [],
          keyTerms: geminiResult.keyTerms || [],
          allKeywords: topics.map(t => t.name),
          confidence: 0.96,
          source: 'gemini',
        };
        console.log(`✅ Gemini extracted ${topics.length} topics with subtopics`);
      }
    } catch (geminiErr) {
      console.warn('⚠️  Gemini unavailable, falling back to rule-based:', geminiErr.message);
    }

    // ── Fallback: rule-based ──────────────────────────────────────
    if (!result) {
      console.log('📊 Using rule-based topic extraction...');
      try {
        // identifyTopicsAndSubtopics is async — must await it
        const fallback = await topicExtractionService.identifyTopicsAndSubtopics(text);

        // The service returns { mainTopics, topicsData, subject, summary, keyTerms, relationships }
        // Normalise to the shape callers expect (topics array of objects)
        const topics = (fallback.topicsData || []).length > 0
          ? fallback.topicsData
          : (fallback.mainTopics || []).map(name => ({ name, description: '', subtopics: [] }));

        result = {
          topics,
          subject: fallback.subject || topics[0]?.name || 'Concept Map',
          summary: fallback.summary || '',
          relationships: fallback.relationships || [],
          keyTerms: fallback.keyTerms || [],
          allKeywords: (fallback.mainTopics || topics.map(t => t.name)),
          confidence: 0.6,
          source: 'rule-based',
        };
        console.log(`✅ Rule-based extracted ${topics.length} topics`);
      } catch (fallbackErr) {
        console.error('❌ Rule-based fallback also failed:', fallbackErr.message);
        // Last resort: return empty-but-valid result so the frontend doesn’t crash
        result = {
          topics: [],
          subject: 'Concept Map',
          summary: '',
          relationships: [],
          keyTerms: [],
          allKeywords: [],
          confidence: 0,
          source: 'error-fallback',
        };
      }
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
