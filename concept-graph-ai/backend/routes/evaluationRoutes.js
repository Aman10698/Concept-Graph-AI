const express = require('express');
const { evaluateAnswerController } = require('../controllers/evaluationController');

const router = express.Router();

// POST /api/evaluate-answer - Evaluate student answer against concept
router.post('/evaluate-answer', evaluateAnswerController);

module.exports = router;
