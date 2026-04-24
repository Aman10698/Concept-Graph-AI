const express = require('express');
const { generateQuestionsController } = require('../controllers/questionController');

const router = express.Router();

// POST /api/questions - Generate questions from topics
router.post('/questions', generateQuestionsController);

module.exports = router;
