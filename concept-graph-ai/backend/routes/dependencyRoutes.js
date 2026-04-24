const express = require('express');
const { analyzeDependenciesController } = require('../controllers/dependencyController');

const router = express.Router();

// POST /api/analyze-dependencies - Analyze topic dependencies
router.post('/analyze-dependencies', analyzeDependenciesController);

module.exports = router;
