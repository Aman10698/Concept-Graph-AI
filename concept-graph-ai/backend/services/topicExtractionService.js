/**
 * Topic Extraction Service — 100% Ollama-powered
 * Replaces old keyword-counting logic with full AI analysis.
 */

const ollamaService = require('./ollamaService');

/**
 * Main entry point called by workflowService.
 * Returns { mainTopics: string[], topicsData: object[], subject, summary, keyTerms, relationships }
 */
const identifyTopicsAndSubtopics = async (text) => {
  console.log('🤖 [Ollama] Extracting topics from document...');

  const result = await ollamaService.extractTopicsAdvanced(text);

  if (!result || !Array.isArray(result.topics) || result.topics.length === 0) {
    console.warn('⚠️  Ollama returned no topics — falling back to basic extraction');
    return fallbackExtraction(text);
  }

  // Build flat list of topic name strings (used by graph / dependency layers)
  const mainTopics = result.topics.map(t => t.name).filter(Boolean);

  console.log(`✅ [Ollama] Extracted ${mainTopics.length} topics for: "${result.subject || 'Unknown Subject'}"`);

  return {
    mainTopics,
    topicsData: result.topics,   // rich objects with subtopics & descriptions
    subject:       result.subject      || '',
    summary:       result.summary      || '',
    keyTerms:      result.keyTerms     || [],
    relationships: result.relationships || [],
  };
};

/**
 * Simple fallback — used only when Ollama is unreachable.
 */
const fallbackExtraction = (text) => {
  const stopWords = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
    'from','is','are','was','were','be','have','has','do','will','would','could',
    'should','this','that','these','those','i','you','he','she','it','we','they',
  ]);

  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !stopWords.has(w));
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  const mainTopics = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);

  return {
    mainTopics,
    topicsData: mainTopics.map(t => ({ name: t, subtopics: [], description: '' })),
    subject: 'Unknown',
    summary: '',
    keyTerms: [],
    relationships: [],
  };
};

// kept for backwards compat with anything that imports these directly
const extractKeywords = (text, limit = 10) => {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const freq = {};
  words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([w]) => w);
};

module.exports = {
  identifyTopicsAndSubtopics,
  extractKeywords,
};
