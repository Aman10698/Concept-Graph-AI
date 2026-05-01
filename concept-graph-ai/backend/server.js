require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const uploadRoutes     = require('./routes/uploadRoutes');
const extractionRoutes = require('./routes/extractionRoutes');
const topicRoutes      = require('./routes/topicRoutes');
const graphRoutes      = require('./routes/graphRoutes');
const questionRoutes   = require('./routes/questionRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const dependencyRoutes = require('./routes/dependencyRoutes');
const weaknessRoutes   = require('./routes/weaknessRoutes');
const pipelineRoutes   = require('./routes/pipelineRoutes');
const ollamaRoutes     = require('./routes/ollamaRoutes');
const progressRoutes   = require('./routes/progressRoutes');
const sessionRoutes      = require('./routes/sessionRoutes');
const learningPathRoutes = require('./routes/learningPathRoutes');
const bloomRoutes        = require('./routes/bloomRoutes');
const { errorHandlingMiddleware } = require('./utils/middleware');
const { connectDB } = require('./services/mongoService');

const app  = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Routes ────────────────────────────────────────────────────
app.use('/api', uploadRoutes);
app.use('/api', extractionRoutes);
app.use('/api', topicRoutes);
app.use('/api', graphRoutes);
app.use('/api', questionRoutes);
app.use('/api', evaluationRoutes);
app.use('/api', dependencyRoutes);
app.use('/api', weaknessRoutes);
app.use('/api', pipelineRoutes);
app.use('/api', ollamaRoutes);
app.use('/api', progressRoutes);
app.use('/api', sessionRoutes);
app.use('/api', learningPathRoutes);
app.use('/api', bloomRoutes);
// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found', path: req.path });
});

// ── Error handler ─────────────────────────────────────────────
app.use(errorHandlingMiddleware);

// ── Start: connect MongoDB then listen ────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`💾 Upload:     POST /api/upload`);
    console.log(`🧠 Topics:     POST /api/topics`);
    console.log(`📚 Questions:  POST /api/questions`);
    console.log(`📊 Evaluate:   POST /api/evaluate\n`);
  });
}).catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});

module.exports = app;
