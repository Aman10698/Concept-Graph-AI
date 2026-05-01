const { evaluateAnswer: ruleBasedEvaluate } = require('../services/answerEvaluationService');
const ollamaService = require('../services/ollamaService');

/**
 * POST /api/evaluate-answer
 * Gemini AI evaluation — 4-dimension scoring with detailed, specific feedback.
 * Falls back to rule-based only if Gemini throws.
 */
const evaluateAnswerController = async (req, res) => {
  try {
    const { studentAnswer, concept, topic, question } = req.body;

    if (!studentAnswer || typeof studentAnswer !== 'string' || studentAnswer.trim().length < 3) {
      return res.status(400).json({ success: false, message: 'Student answer is required' });
    }
    if (!concept || typeof concept !== 'string') {
      return res.status(400).json({ success: false, message: 'Concept is required' });
    }

    const questionText = question
      || (topic
        ? `In the context of "${topic}", ${concept}`
        : concept);

    const keyHints = [concept, topic].filter(Boolean);

    let evaluation = null;

    // ── Try Gemini (primary) ──────────────────────────────────────────────────
    try {
      console.log('✨ Using Gemini for deep answer evaluation...');
      const aiEval = await ollamaService.evaluateAnswer(questionText, studentAnswer, keyHints);

      if (aiEval && typeof aiEval.score === 'number') {
        evaluation = {
          ...aiEval,
          topic:  topic  || concept,
          source: 'gemini',
        };
        console.log(`✅ Gemini evaluation: score=${aiEval.score}, rating=${aiEval.rating}`);
      }
    } catch (geminiErr) {
      console.warn('⚠️  Gemini unavailable, using rule-based evaluation:', geminiErr.message);
    }

    // ── Fallback: rule-based ──────────────────────────────────────────────────
    if (!evaluation) {
      console.log('📊 Using rule-based answer evaluation...');
      const rb = await ruleBasedEvaluate(studentAnswer, concept, topic || '');
      evaluation = {
        ...rb,
        scores: {
          accuracy:      rb.scores?.keyword       ?? 0,
          depth:         rb.scores?.length        ?? 0,
          examples:      rb.scores?.understanding ?? 0,
          clarity:       rb.scores?.understanding ?? 0,
          keyword:       rb.scores?.keyword       ?? 0,
          length:        rb.scores?.length        ?? 0,
          understanding: rb.scores?.understanding ?? 0,
        },
        strengths:       [],
        improvements:    rb.feedback ? [rb.feedback] : [],
        missingConcepts: [],
        source:          'rule-based',
      };
    }

    res.status(200).json({
      success: true,
      message: 'Answer evaluated successfully',
      data: evaluation,
    });
  } catch (error) {
    console.error('Answer evaluation error:', error);
    res.status(500).json({ success: false, message: 'Error evaluating answer', error: error.message });
  }
};

module.exports = { evaluateAnswerController };
