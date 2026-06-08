const mongoose = require('mongoose');

/**
 * ChatHistory
 *
 * Stores the full message thread for one (userId, documentId) pair.
 * Upserted on every save — one record per user per document.
 *
 * messages[].time is stored as a Number (ms epoch) so it round-trips
 * cleanly through JSON without timezone conversion issues.
 */
const MessageSchema = new mongoose.Schema(
  {
    role:    { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    time:    { type: Number, default: () => Date.now() }, // ms epoch
  },
  { _id: false }
);

const ChatHistorySchema = new mongoose.Schema(
  {
    userId:       { type: String, required: true, index: true },
    documentId:   { type: String, required: true, index: true },
    documentName: { type: String, default: '' },
    messages:     { type: [MessageSchema], default: [] },
  },
  { timestamps: true }
);

// Compound index — one record per (user, document)
ChatHistorySchema.index({ userId: 1, documentId: 1 }, { unique: true });

module.exports = mongoose.model('ChatHistory', ChatHistorySchema);
