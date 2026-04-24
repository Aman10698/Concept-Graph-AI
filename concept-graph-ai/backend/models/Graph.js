const mongoose = require('mongoose');

const GraphSchema = new mongoose.Schema({
  userId:        { type: String, required: true, index: true },
  topicsData:    { type: mongoose.Schema.Types.Mixed },
  extractedText: { type: String },
  title:         { type: String, default: 'Untitled Graph' },
}, { timestamps: true });

module.exports = mongoose.model('Graph', GraphSchema);
