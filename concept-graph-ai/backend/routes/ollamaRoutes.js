/**
 * Ollama test route
 * Quick way to test if Ollama integration is working
 */

const express = require('express');
const router = express.Router();
const ollamaService = require('../services/ollamaService');

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
 * Generate questions from topics
 */
router.post('/ollama/generate-questions', async (req, res) => {
  try {
    const { topics = [], context = '' } = req.body;

    if (!topics || topics.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide topics array',
      });
    }

    console.log('📚 Generating questions for topics:', topics);

    const questions = await ollamaService.generateAdvancedQuestions(topics, context);

    res.status(200).json({
      success: true,
      topics,
      questions,
      count: questions.length,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
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

    const evaluation = await ollamaService.evaluateAnswer(question, answer, concepts);

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

    console.log('🧠 Extracting topics from text');

    const result = await ollamaService.extractTopicsAdvanced(text);

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
