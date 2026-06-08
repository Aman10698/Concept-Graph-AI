/**
 * Ollama test route
 * Quick way to test if Ollama integration is working
 */

const express = require('express');
const router = express.Router();
// ⚠️  Use ollamaWorkerService (spawns isolated child processes), NOT ollamaService directly.
// Direct ollamaService calls buffer the full LLM response in the main server heap
// and will crash with OOM. The worker approach keeps the server heap < 100 MB.
const ollamaWorkerService = require('../services/ollamaWorkerService');
const ollamaService = require('../services/ollamaService'); // only for health/test (small payloads)

/**
 * GET /api/ollama/health
 * Check if Ollama is running
 */
router.get('/ollama/health', async (req, res) => {
  try {
    const isRunning = await ollamaService.testOllamaConnection();
    
    if (isRunning) {
      res.status(200).json({
        success: true,
        message: '✅ Ollama is running and ready!',
        status: 'connected',
        endpoint: process.env.OLLAMA_URL || 'http://localhost:11434',
      });
    } else {
      res.status(503).json({
        success: false,
        message: '❌ Ollama is not running',
        status: 'disconnected',
        help: 'Start Ollama with: ollama serve',
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: error.message,
      help: 'Make sure Ollama is installed and running'
    });
  }
});

/**
 * POST /api/ollama/test
 * Test Ollama generation with a prompt
 */
router.post('/ollama/test', async (req, res) => {
  try {
    const { prompt = 'What is machine learning?' } = req.body;

    console.log('🧠 Testing Ollama with prompt:', prompt);

    const response = await ollamaService.generateText(prompt, {
      temperature: 0.7,
      numPredict: 200,
    });

    res.status(200).json({
      success: true,
      prompt,
      response,
      message: '✅ Ollama generation successful!',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
      help: 'Make sure Ollama is running and accessible',
    });
  }
});

/**
 * POST /api/ollama/generate-questions
 * Generate questions from topics or Ollama's own knowledge.
 * Body: { topics?: string[], context?: string, subject?: string, questionsPerTopic?: number }
 * If topics is empty, Ollama generates general questions on `subject`.
 */
router.post('/ollama/generate-questions', async (req, res) => {
  try {
    const { topics = [], context = '', subject = 'General Knowledge', questionsPerTopic = 3 } = req.body;

    // If no topics provided, generate general questions from Ollama's own knowledge
    if (!topics || topics.length === 0) {
      console.log(`📚 Generating general questions on "${subject}" from Ollama knowledge`);
      const questions = await ollamaWorkerService.generateDocumentQuestions(
        [{ name: subject }],
        context,  // may be empty — Ollama uses its own knowledge
        questionsPerTopic
      );
      return res.status(200).json({
        success: true,
        source: 'ollama-knowledge',
        subject,
        questions,
        count: questions.length,
      });
    }

    // Topics provided — generate grounded questions
    console.log(`📚 Generating questions for ${topics.length} topics`);
    const topicObjects = topics.map(t => (typeof t === 'string' ? { name: t } : t));
    const questions = await ollamaWorkerService.generateDocumentQuestions(topicObjects, context, questionsPerTopic);

    res.status(200).json({
      success: true,
      source: context ? 'rag-context' : 'ollama-knowledge',
      topics,
      questions,
      count: questions.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/ollama/evaluate-answer
 * Evaluate a student answer
 */
router.post('/ollama/evaluate-answer', async (req, res) => {
  try {
    const { question, answer, concepts = [] } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Please provide question and answer',
      });
    }

    console.log('📊 Evaluating answer for question:', question);

    const evaluation = await ollamaWorkerService.evaluateAnswer(question, answer, concepts[0] || question);

    res.status(200).json({
      success: true,
      question,
      answer: answer.substring(0, 100) + '...',
      evaluation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

/**
 * POST /api/ollama/extract-topics
 * Extract topics from text
 */
router.post('/ollama/extract-topics', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'Please provide text',
      });
    }

    console.log('🧠 Extracting topics from text (worker)');

    const result = await ollamaWorkerService.extractTopicsAdvanced(text);

    res.status(200).json({
      success: true,
      topics: result.topics,
      relationships: result.relationships,
      summary: result.summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
