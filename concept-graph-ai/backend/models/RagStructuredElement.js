/**
 * RagStructuredElement.js
 *
 * Stores pre-extracted structured elements from a document.
 *
 * Built at INDEX TIME — not at query time.
 * Queried directly for extraction queries ("list all activities", etc.)
 * instead of running regex on fullText at query time.
 *
 * One document can have thousands of elements.
 * Indexed on (documentId, type) for fast extraction queries.
 *
 * Types:
 *   activity   — Activity 3.1, Activity 3.2, etc.
 *   question   — Numbered questions and in-text questions
 *   definition — "X is called Y", "X is known as Y"
 *   formula    — Chemical equations, math expressions
 *   exercise   — Exercise blocks
 *   figure     — Figure references
 *   table      — Table blocks
 */
const mongoose = require('mongoose');

const RagStructuredElementSchema = new mongoose.Schema(
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

    /** Element type — determines which extraction query returns this */
    type: {
      type:     String,
      required: true,
      enum:     ['activity', 'question', 'definition', 'formula', 'exercise', 'figure', 'table'],
      index:    true,
    },

    /**
     * Human-readable identifier, e.g.:
     *   activity   → "3.1", "3.12"
     *   question   → "1", "Q1", "(a)"
     *   definition → "Malleability"
     *   formula    → sequential index as string
     */
    identifier: {
      type:    String,
      default: '',
    },

    /** Page number where this element appears (0 = unknown) */
    page: {
      type:    Number,
      default: 0,
    },

    /** Full text content of the element */
    content: {
      type:    String,
      default: '',
    },

    /**
     * For definitions: stores the term separately for lookup
     * For activities: stores just the header label
     */
    label: {
      type:    String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for fast per-document-per-type queries
RagStructuredElementSchema.index({ documentId: 1, type: 1 });

// Compound index for userId + type (cross-document queries)
RagStructuredElementSchema.index({ userId: 1, type: 1 });

module.exports = mongoose.model('RagStructuredElement', RagStructuredElementSchema);
