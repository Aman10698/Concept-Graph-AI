const mongoose = require('mongoose');

/**
 * One Session = one uploaded syllabus + all its derived data + user's per-topic scores.
 * A user can have many sessions (one per uploaded syllabus).
 */
const SessionSchema = new mongoose.Schema({
  userId:         { type: String, required: true, index: true },

  // Human-readable title (filename or user-set)
  title:          { type: String, required: true, default: 'Untitled Syllabus' },
  subject:        { type: String, default: '' },

  // Raw text extracted from the uploaded file
  extractedText:  { type: String, default: '' },

  // AI-generated data
  topicsData:     { type: mongoose.Schema.Types.Mixed, default: null },
  questionsData:  { type: mongoose.Schema.Types.Mixed, default: null },
  dependencyData: { type: mongoose.Schema.Types.Mixed, default: null },

  // Per-topic quiz scores — merged on every retake
  // Shape: { "TopicName": { rating, score, confidence, updatedAt } }
  evaluationData: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Per-topic prerequisite dependency graphs generated after each quiz
  // Shape: { "TopicName": { rating, score, nodes, improvements, testedAt } }
  topicDepGraphs: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Computed counts (for list view — avoids fetching full data)
  topicCount:     { type: Number, default: 0 },
  questionCount:  { type: Number, default: 0 },
  masteredCount:  { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('Session', SessionSchema);
