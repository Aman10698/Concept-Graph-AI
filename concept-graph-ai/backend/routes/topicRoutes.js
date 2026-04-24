const express = require('express');
const topicController = require('../controllers/topicController');

const router = express.Router();

// POST /api/topics
router.post('/topics', topicController.extractTopics);

module.exports = router;
