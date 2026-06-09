const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/bloomController');

// ── Specific named routes MUST come before the /:concept wildcard ──

// List all progress
router.get('/bloom/all',                   ctrl.getAllProgress);

// Diagnosis + learning path (named paths before /:concept wildcard)
router.get('/bloom/diagnose/:concept',     ctrl.diagnose);
router.get('/bloom/path/:concept',         ctrl.learningPath);

// Questions (POST — safe, no shadowing)
router.post('/bloom/questions',            ctrl.getQuestions);

// Evaluation
router.post('/bloom/evaluate',             ctrl.evaluate);

// AI Dependency Analysis (based on quiz results)
router.post('/bloom/analyze-deps',         ctrl.analyzeDeps);

// Single concept progress — wildcard LAST to avoid shadowing named routes above
router.get('/bloom/:concept',              ctrl.getProgress);

module.exports = router;
