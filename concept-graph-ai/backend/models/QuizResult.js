const mongoose = require('mongoose');

const QuizResultSchema = new mongoose.Schema({
  userId:     { type: String, required: true, index: true },
  topic:      { type: String, required: true },
  question:   { type: String },
  answer:     { type: String },
  rating:     { type: String, enum: ['strong', 'partial', 'weak'] },
  confidence: { type: Number, default: 0 },
  feedback:   { type: String },
}, { timestamps: true });

module.exports = mongoose.model('QuizResult', QuizResultSchema);
