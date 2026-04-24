/**
 * Pipeline Routes
 * 
 * Comprehensive workflow endpoints connecting all components:
 * - Document processing (upload → extract → topics → graph)
 * - Quiz generation
 * - Answer evaluation & feedback
 * - Progress tracking
 * - Statistics & recommendations
 */

const express = require('express');
const multer = require('multer');
const path = require('path');
const pipelineController = require('../controllers/pipelineController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/gif',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

/**
 * POST /api/pipeline/process-document
 * 
 * Complete document processing pipeline:
 * 1. Upload document
 * 2. Extract text
 * 3. Extract topics
 * 4. Analyze relationships
 * 5. Create concept graph
 * 6. Save to database
 * 
 * Body: { userId: string }
 * File: multipart/form-data
 * 
 * Response: {
 *   success: boolean,
 *   data: {
 *     text: string,
 *     topics: string[],
 *     relationships: object[],
 *     graph: object,
 *     graphId: string
 *   },
 *   summary: {
 *     textLength: number,
 *     topicsCount: number,
 *     relationshipsCount: number,
 *     savedAt: string
 *   }
 * }
 */
router.post(
  '/pipeline/process-document',
  upload.single('document'),
  pipelineController.processDocument
);

/**
 * POST /api/pipeline/generate-quiz
 * 
 * Generate quiz from topics:
 * 1. Get topics from user's graphs
 * 2. Generate questions
 * 3. Return session with questions
 * 
 * Body: {
 *   userId: string,
 *   graphId?: string,
 *   topicFilter?: string[]
 * }
 * 
 * Response: {
 *   success: boolean,
 *   data: {
 *     topics: string[],
 *     questionCount: number,
 *     sessionId: string
 *   }
 * }
 */
router.post('/pipeline/generate-quiz', pipelineController.generateQuiz);

/**
 * POST /api/pipeline/submit-answer
 * 
 * Submit and evaluate quiz answer:
 * 1. Evaluate answer with AI
 * 2. Analyze weaknesses if low score
 * 3. Update user progress
 * 4. Save result to database
 * 5. Return feedback
 * 
 * Body: {
 *   userId: string,
 *   question: string,
 *   userAnswer: string,
 *   topic: string,
 *   confidence?: number (0-100)
 * }
 * 
 * Response: {
 *   success: boolean,
 *   data: {
 *     evaluation: {
 *       rating: 'strong'|'partial'|'weak',
 *       confidence: number,
 *       feedback: string,
 *       scores: {
 *         keyword: number,
 *         length: number,
 *         understanding: number
 *       }
 *     },
 *     progress: object,
 *     feedback: string
 *   },
 *   summary: {
 *     rating: string,
 *     confidence: number,
 *     feedback: string
 *   }
 * }
 */
router.post('/pipeline/submit-answer', pipelineController.submitAnswer);

/**
 * GET /api/pipeline/statistics/:userId
 * 
 * Get user's quiz statistics and progress:
 * - Total questions answered
 * - Accuracy by topic
 * - Weak areas
 * - Progress trends
 * 
 * Response: {
 *   success: boolean,
 *   data: {
 *     quizStats: {
 *       totalQuestions: number,
 *       strongAnswers: number,
 *       partialAnswers: number,
 *       weakAnswers: number,
 *       averageConfidence: number,
 *       topicBreakdown: object
 *     },
 *     progress: object,
 *     graphs: object[]
 *   }
 * }
 */
router.get('/pipeline/statistics/:userId', pipelineController.getStatistics);

/**
 * GET /api/pipeline/progress/:userId
 * 
 * Get user's learning progress:
 * - Topics mastered
 * - Topics in progress
 * - Weak topics
 * - Overall statistics
 * 
 * Response: {
 *   success: boolean,
 *   data: {
 *     overall: {
 *       totalTopics: number,
 *       masteredCount: number,
 *       inProgressCount: number,
 *       weakCount: number
 *     },
 *     byCategory: {
 *       mastered: object[],
 *       inProgress: object[],
 *       weak: object[]
 *     },
 *     quizStats: object,
 *     weakTopics: object[]
 *   }
 * }
 */
router.get('/pipeline/progress/:userId', pipelineController.getProgress);

/**
 * GET /api/pipeline/recommendations/:userId
 * 
 * Get personalized learning recommendations:
 * - Topics to focus on
 * - Topics with highest weak rate
 * - Suggested next topics
 * - Learning insights
 * 
 * Response: {
 *   success: boolean,
 *   data: {
 *     focusTopics: object[],
 *     reviewTopics: object[],
 *     nextTopics: object[],
 *     insights: string[]
 *   }
 * }
 */
router.get(
  '/pipeline/recommendations/:userId',
  pipelineController.getRecommendations
);

// Error handling middleware for this router
router.use((error, req, res, next) => {
  console.error('Pipeline route error:', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  if (error.message === 'Invalid file type') {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Supported: PDF, PNG, JPEG, GIF, TXT, DOCX',
    });
  }

  res.status(400).json({
    success: false,
    message: error.message || 'An error occurred',
  });
});

module.exports = router;
