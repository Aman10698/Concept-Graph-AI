const mongoose = require('mongoose');

/**
 * RagDocument — stores document metadata immediately on upload.
 * This is separate from LanceDB (which stores the actual embeddings).
 * Having metadata in MongoDB means the document is visible in the
 * "My Notes" list right away, even before LanceDB embedding finishes.
 */
const ragDocumentSchema = new mongoose.Schema({
  documentId:  { type: String, required: true },
  userId:      { type: String, required: true, index: true },
  syllabusId:  { type: String, default: '' },
  filename:    { type: String, required: true },
  mimeType:    { type: String, default: 'application/octet-stream' },
  chunkCount:  { type: Number, default: 0 },
  indexed:     { type: Boolean, default: false },
  status:      { type: String, default: 'processing', enum: ['processing', 'indexed', 'failed'] },
  createdAt:   { type: Date, default: Date.now },
});

// Unique constraint: one doc per user+documentId
ragDocumentSchema.index({ userId: 1, documentId: 1 }, { unique: true });

module.exports = mongoose.model('RagDocument', ragDocumentSchema);
