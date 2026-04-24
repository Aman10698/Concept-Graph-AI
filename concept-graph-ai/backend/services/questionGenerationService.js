/**
 * Question Generation Service — 100% Ollama-powered
 * Replaces static template strings with AI-generated, document-grounded questions.
 */

const ollamaService = require('./ollamaService');

/**
 * Generate questions from extracted topic data.
 * @param {Array} topicsData  - Array of topic objects { name, subtopics, description }
 * @param {string} docText    - Original document text (gives Ollama rich context)
 * @returns {object} { questions, totalQuestions, questionsByType, questionsByDifficulty }
 */
const generateQuestionsFromTopics = async (topicsData, docText = '') => {
  if (!topicsData || !Array.isArray(topicsData) || topicsData.length === 0) {
    throw new Error('Invalid topics data — cannot generate questions');
  }

  console.log('🤖 [Ollama] Generating questions...');

  const topicNames = topicsData.map(t => (typeof t === 'string' ? t : t.name)).filter(Boolean);

  // Build a rich subtopic summary for the prompt
  const subtopicLines = topicsData
    .map(t => {
      const subs = Array.isArray(t.subtopics) ? t.subtopics.join(', ') : '';
      return `  • ${t.name || t}${subs ? ': ' + subs : ''}`;
    })
    .join('\n');

  const questions = await ollamaService.generateDocumentQuestions(
    topicNames,
    subtopicLines,
    docText
  );

  if (!questions || questions.length === 0) {
    console.warn('⚠️  Ollama returned no questions — using fallback');
    return fallbackQuestions(topicNames);
  }

  console.log(`✅ [Ollama] Generated ${questions.length} questions`);

  return {
    questions,
    totalQuestions: questions.length,
    questionsByType:       categorizeByType(questions),
    questionsByDifficulty: categorizeByDifficulty(questions),
  };
};

/**
 * Legacy wrapper used by quizWorkflow.generateQuestions(topics)
 * topics may be an array of strings OR topic objects.
 */
const generateQuestions = async (topics, docText = '') => {
  const normalised = Array.isArray(topics)
    ? topics.map(t => (typeof t === 'string' ? { name: t, subtopics: [] } : t))
    : [];
  return generateQuestionsFromTopics(normalised, docText);
};

/* ── helpers ─────────────────────────────────────────────────────────────── */

const fallbackQuestions = (topicNames) => {
  const questions = topicNames.slice(0, 5).map((name, i) => ({
    id: `fallback-${i}`,
    question: `Explain the significance of "${name}" and provide a real-world example.`,
    type: 'analysis',
    topic: name,
    difficulty: 'intermediate',
    source: 'fallback',
  }));
  return {
    questions,
    totalQuestions: questions.length,
    questionsByType: categorizeByType(questions),
    questionsByDifficulty: categorizeByDifficulty(questions),
  };
};

const categorizeByType = (questions) => {
  const cats = {};
  questions.forEach(q => {
    if (!cats[q.type]) cats[q.type] = [];
    cats[q.type].push(q);
  });
  return cats;
};

const categorizeByDifficulty = (questions) => {
  const cats = {};
  questions.forEach(q => {
    if (!cats[q.difficulty]) cats[q.difficulty] = [];
    cats[q.difficulty].push(q);
  });
  return cats;
};

const getQuestionTypeDescription = (type) => {
  const d = {
    comparison: 'Compare and contrast two concepts',
    application: 'Apply knowledge to real scenarios',
    analysis: 'Break down and examine components',
    evaluation: 'Assess strengths and limitations',
    relationships: 'Explore connections between ideas',
    significance: 'Understand importance and impact',
    synthesis: 'Combine and integrate knowledge',
  };
  return d[type] || type;
};

module.exports = {
  generateQuestionsFromTopics,
  generateQuestions,
  getQuestionTypeDescription,
  categorizeByType,
  categorizeByDifficulty,
};
