const express = require('express');
const router  = express.Router();
const ctrl    = require('../controllers/bloomController');

// Progress
router.get('/bloom/all',          ctrl.getAllProgress);
router.get('/bloom/:concept',     ctrl.getProgress);

// Questions
router.post('/bloom/questions',   ctrl.getQuestions);

// Evaluation
router.post('/bloom/evaluate',    ctrl.evaluate);

// AI Dependency Analysis (based on quiz results)
router.post('/bloom/analyze-deps', ctrl.analyzeDeps);

// Diagnosis + path
router.get('/bloom/diagnose/:concept', ctrl.diagnose);
router.get('/bloom/path/:concept',     ctrl.learningPath);

module.exports = router;
