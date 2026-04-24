const express = require('express');
const {
  traceWeaknessController,
  analyzeWeaknessPattersController,
} = require('../controllers/weaknessController');

const router = express.Router();

// POST /api/trace-weakness - Trace weakness through dependency chain
router.post('/trace-weakness', traceWeaknessController);

// POST /api/analyze-weakness-patterns - Analyze patterns across multiple weak topics
router.post('/analyze-weakness-patterns', analyzeWeaknessPattersController);

module.exports = router;
