const express = require('express');
const extractionController = require('../controllers/extractionController');

const router = express.Router();

// POST /api/extract
router.post('/extract', extractionController.extractFromFile);

module.exports = router;
