/**
 * semanticChunker.js
 *
 * Structure-aware chunker for educational PDF content.
 *
 * Unlike the old word-count chunker (800 words, fixed overlap):
 *  - Splits at document structure boundaries (Activity, Section, Chapter)
 *  - Never splits inside an Activity block
 *  - Never splits inside a Question block
 *  - Target: 400–600 words per chunk (max 900)
 *  - Overlap: 50 words between adjacent chunks (reduced from 150)
 *
 * This ensures that "Activity 3.1 … [content] … Activity 3.2"
 * never gets cut in the middle of an activity, giving the LLM
 * complete, coherent context for each chunk.
 */

/* ═══════════════════════════════════════════════════════════════════
   STRUCTURAL BOUNDARY PATTERNS
   Lines matching these are natural split points.
═══════════════════════════════════════════════════════════════════ */
const BOUNDARY_PATTERNS = [
  /^\s*Activity\s+[\d.]+/i,              // Activity 3.1
  /^\s*ACTIVITY\s+[\d.]+/,              // ACTIVITY 3.1 (all-caps)
  /^\s*(Chapter|Unit|Module)\s+\d+/i,   // Chapter 3, Unit 1
  /^\s*\d+\.\d+\s+[A-Z][A-Z\s]{3,}/,   // 3.2 CHEMICAL PROPERTIES
  /^\s*Exercises?\s*$/i,                 // Exercises
  /^\s*In[\s-]text\s+Questions?/i,      // In-text Questions
  /^\s*Summary\s*$/i,                   // Summary
  /^\s*Questions?\s*\d*\s*$/i,          // Questions
  /^\s*Try\s+These\s*$/i,               // Try These
  /^\s*Think\s+and\s+Discuss/i,         // Think and Discuss
];

const isBoundary = (line) => BOUNDARY_PATTERNS.some(p => p.test(line));

const TARGET_WORDS = 500;   // target words per chunk
const MAX_WORDS    = 900;   // hard cap per chunk
const OVERLAP_WORDS = 50;   // word overlap between chunks

/* ═══════════════════════════════════════════════════════════════════
   SEGMENT TEXT
   Splits a page's text into semantic segments at boundary lines.
   Returns: [{header, body}]
═══════════════════════════════════════════════════════════════════ */
const segmentText = (text) => {
  const lines    = text.split('\n');
  const segments = [];
  let current    = { header: '', lines: [] };

  for (const line of lines) {
    if (isBoundary(line) && line.trim().length > 0) {
      // Save current segment if it has content
      if (current.lines.length > 0 || current.header) {
        segments.push(current);
      }
      // Start new segment with this boundary as header
      current = { header: line.trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }

  // Save final segment
  if (current.lines.length > 0 || current.header) {
    segments.push(current);
  }

  return segments;
};

/* ═══════════════════════════════════════════════════════════════════
   WORD COUNT HELPER
═══════════════════════════════════════════════════════════════════ */
const countWords = (text) => (text || '').trim().split(/\s+/).filter(Boolean).length;

/* ═══════════════════════════════════════════════════════════════════
   CHUNK SINGLE SEGMENT
   If a segment is too long, split at paragraph boundaries.
   Returns: [string]  (chunk texts)
═══════════════════════════════════════════════════════════════════ */
const chunkSegment = (header, body) => {
  const fullText   = (header ? header + '\n' : '') + body;
  const wordCount  = countWords(fullText);

  if (wordCount <= MAX_WORDS) {
    // Fits in one chunk — return as-is
    return [fullText.trim()];
  }

  // Too long — split at paragraph boundaries (\n\n)
  const paragraphs = body.split(/\n{2,}/);
  const chunks     = [];
  let   current    = header ? header + '\n' : '';

  for (const para of paragraphs) {
    const candidate = current + '\n\n' + para;
    if (countWords(candidate) > MAX_WORDS && countWords(current) > 0) {
      // Current chunk is full — save it
      chunks.push(current.trim());
      // New chunk with overlap: take last OVERLAP_WORDS words from previous
      const overlapWords = current.trim().split(/\s+/).slice(-OVERLAP_WORDS).join(' ');
      current = overlapWords + '\n\n' + para;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN EXPORT — makeSemanticChunks
   Takes an array of page objects and yields semantic chunks.

   @param {Array<{page, text, merged, contentType, chapter, keywords}>} pages
   @yields {{ index, text, wordCount, page, contentType, chapter, keywords }}
═══════════════════════════════════════════════════════════════════ */
function* makeSemanticChunks(pages) {
  let globalIdx = 0;

  for (const pageContent of pages) {
    const {
      page        = 0,
      merged      = '',
      text        = '',
      contentType = 'text',
      chapter     = '',
      keywords    = [],
    } = pageContent;

    const source = (merged || text).trim();
    if (!source) continue;

    // Segment the page into structural blocks
    const segments = segmentText(source);

    for (const seg of segments) {
      const segBody = seg.lines.join('\n');
      const chunks  = chunkSegment(seg.header, segBody);

      for (const chunkText of chunks) {
        if (!chunkText.trim()) continue;

        const wc = countWords(chunkText);
        if (wc < 10) continue; // skip tiny fragments

        yield {
          index:       globalIdx++,
          text:        chunkText,
          wordCount:   wc,
          page,
          contentType,
          chapter,
          topic:       chapter,
          keywords:    Array.isArray(keywords) ? keywords.join(',') : (keywords || ''),
        };
      }
    }
  }
}

module.exports = { makeSemanticChunks, segmentText, isBoundary };
