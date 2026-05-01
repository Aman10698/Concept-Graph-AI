const mongoose = require('mongoose');

const bloomLevelSchema = {
  achieved:    { type: Boolean, default: false },
  score:       { type: Number,  default: 0,   min: 0, max: 100 },
  attempts:    { type: Number,  default: 0 },
  lastAttempt: { type: Date },
};

const BloomProgressSchema = new mongoose.Schema({
  userId:     { type: String, required: true },
  syllabusId: { type: String },
  concept:    { type: String, required: true },

  dependencies: [String],   // prerequisite concept names

  // Overall status (kept in sync with bloom levels)
  status: {
    type: String,
    enum: ['not_started', 'weak', 'partial', 'strong'],
    default: 'not_started',
  },

  bloom: {
    remember:  { type: bloomLevelSchema, default: () => ({}) },
    understand:{ type: bloomLevelSchema, default: () => ({}) },
    apply:     { type: bloomLevelSchema, default: () => ({}) },
    analyze:   { type: bloomLevelSchema, default: () => ({}) },
    evaluate:  { type: bloomLevelSchema, default: () => ({}) },
    create:    { type: bloomLevelSchema, default: () => ({}) },
  },

  // Highest fully-achieved level
  bloomLevelReached: {
    type: String,
    enum: ['none','remember','understand','apply','analyze','evaluate','create'],
    default: 'none',
  },

  questionHistory: [{
    question:          String,
    bloomLevel:        String,
    studentAnswer:     String,
    score:             Number,
    demonstratedLevel: String,
    feedback:          String,
    missingConcepts:   [String],
    timestamp:         { type: Date, default: Date.now },
  }],

}, { timestamps: true });

// Index for fast lookup per user+concept
BloomProgressSchema.index({ userId: 1, concept: 1 }, { unique: true });

// Helper: recompute bloomLevelReached and status after a score update
BloomProgressSchema.methods.recompute = function () {
  const ORDER = ['remember','understand','apply','analyze','evaluate','create'];
  const PASS  = { remember:70, understand:70, apply:65, analyze:65, evaluate:60, create:60 };

  let reached = 'none';
  for (const lvl of ORDER) {
    if ((this.bloom[lvl]?.score ?? 0) >= PASS[lvl]) {
      this.bloom[lvl].achieved = true;
      reached = lvl;
    } else {
      this.bloom[lvl].achieved = false;
      break;
    }
  }
  this.bloomLevelReached = reached;

  // Derive overall status
  const idx = ORDER.indexOf(reached);
  if (idx < 0)  this.status = 'not_started';
  else if (idx <= 1) this.status = 'weak';
  else if (idx <= 3) this.status = 'partial';
  else               this.status = 'strong';
};

module.exports = mongoose.model('BloomProgress', BloomProgressSchema);
