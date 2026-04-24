const express = require('express');
const graphController = require('../controllers/graphController');

const router = express.Router();

// POST /api/graph/convert
router.post('/graph/convert', graphController.convertTopicsToGraph);

// POST /api/graph/stats
router.post('/graph/stats', graphController.getGraphStats);

module.exports = router;
