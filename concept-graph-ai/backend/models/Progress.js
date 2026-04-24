const mongoose = require('mongoose');

const ProgressSchema = new mongoose.Schema({
  userId:          { type: String, required: true, unique: true },
  evaluationData:  { type: mongoose.Schema.Types.Mixed, default: {} }, // { topicName: { rating, confidence } }
  questionsData:   { type: mongoose.Schema.Types.Mixed },
  dependencyData:  { type: mongoose.Schema.Types.Mixed },
  topicsData:      { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });

module.exports = mongoose.model('Progress', ProgressSchema);
