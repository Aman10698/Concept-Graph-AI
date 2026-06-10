const mongoose = require('mongoose');

/**
 * RagRawDocument
 *
 * Stores the COMPLETE extracted text of a document immediately after
 * PDF extraction — before chunking and embedding.
 *
 * Purpose:
 *   Extraction queries ("list all activities", "all definitions", etc.)
 *   need the FULL document text in original order, not semantic chunks.
 *   This collection is the source of truth for Document Analysis mode.
 *
 * Relationship to other collections:
 *   - RagDocument     — metadata only (filename, chunkCount, status)
 *   - rag_chunks      — LanceDB vector store (chunks + embeddings for RAG)
 *   - RagRawDocument  — full text + per-page breakdown (THIS collection)
 */
const PageSchema = new mongoose.Schema(
  {
    page: { type: Number, required: true },
    text: { type: String, default: '' },
  },
  { _id: false }
);

const RagRawDocumentSchema = new mongoose.Schema(
  {
    documentId: {
      type:     String,
      required: true,
      index:    true,
    },
    userId: {
      type:     String,
      required: true,
      index:    true,
    },
    filename:  { type: String, required: true },
    mimeType:  { type: String, default: 'application/octet-stream' },
    pageCount: { type: Number, default: 0 },

    /**
     * fullText — complete document text, pages joined with double newlines.
     * This is what Document Analysis reads for extraction queries.
     */
    fullText: { type: String, default: '' },

    /**
     * pages — per-page text array, preserving original document order.
     * Used for page-aware extraction (e.g. "Activity X was on page Y").
     */
    pages: { type: [PageSchema], default: [] },
  },
  {
    timestamps: true, // createdAt + updatedAt
  }
);

// One raw document per (userId, documentId)
RagRawDocumentSchema.index({ userId: 1, documentId: 1 }, { unique: true });

module.exports = mongoose.model('RagRawDocument', RagRawDocumentSchema);
