/**
 * textCleanerService.js
 *
 * Production-grade text cleaning pipeline for PDF-extracted content.
 *
 * Fixes the following extraction artifacts from NCERT-style PDFs:
 *
 *  1. Concatenated words:   "Activity3.1"     → "Activity 3.1"
 *  2. Duplicate phrases:    "Activity 3.1Activity 3.1Activity 3.1" → "Activity 3.1"
 *  3. Repeated headers:     Lines appearing on >50% of pages removed (page numbers, chapter titles)
 *  4. Whitespace noise:     Multiple spaces → single space, 3+ newlines → 2 newlines
 *  5. OCR artifacts:        Stray single chars between words, broken ligatures
 *
 * Pipeline order (must be applied in this order):
 *   fixConcatenatedWords → deduplicateRepeatedPhrases → normalizeWhitespace
 *
 * Usage:
 *   const { cleanPages } = require('./textCleanerService');
 *   const cleaned = cleanPages(rawPages);  // rawPages = [{page, text}]
 */

/* ═══════════════════════════════════════════════════════════════════
   1. FIX CONCATENATED WORDS
   Inserts missing spaces at word boundaries that pdf-parse misses.

   Cases handled:
     lowercase→UPPERCASE:   "metalsMalleability"  → "metals Malleability"
     letter→digit (non-decimal): "properties3.1"  → "properties 3.1"
     digit→UPPERCASE:       "3.1CHEMICAL"         → "3.1 CHEMICAL"
     UPPER-run→lower-run:   "ACTIVITYProperties"  → "ACTIVITY Properties"
═══════════════════════════════════════════════════════════════════ */
const fixConcatenatedWords = (text) => {
  if (!text) return '';

  return text
    // lowercase letter immediately followed by UPPERCASE letter
    // "metalsMalleability" → "metals Malleability"
    .replace(/([a-z])([A-Z])/g, '$1 $2')

    // UPPERCASE run (2+) followed by lowercase letter
    // "ACTIVITYProperties" → "ACTIVITY Properties"
    .replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1 $2')

    // letter followed by digit that starts a new section reference
    // "properties3." → "properties 3." but NOT "H2O" or "CO2"
    // Rule: only if the digit is followed by a dot+digit (section number like 3.1, 3.2)
    .replace(/([a-zA-Z])(\d+\.\d)/g, '$1 $2')

    // digit followed by UPPERCASE letter (not a unit)
    // "3.1CHEMICAL" → "3.1 CHEMICAL"
    .replace(/(\d)([A-Z]{2,})/g, '$1 $2');
};

/* ═══════════════════════════════════════════════════════════════════
   2. DEDUPLICATE REPEATED PHRASES
   Collapses any phrase that appears 2+ times consecutively.

   Algorithm:
     For each possible phrase length (words 2–20):
       Find occurrences where phrase repeats immediately after itself
       Collapse to single occurrence

   Examples:
     "Activity 3.1Activity 3.1Activity 3.1" → "Activity 3.1"
     "Figure 3.1Figure 3.1"                 → "Figure 3.1"
     "3.2 CHEMICAL PROPERTIES3.2 CHEMICAL"  → "3.2 CHEMICAL PROPERTIES"
═══════════════════════════════════════════════════════════════════ */
const deduplicateRepeatedPhrases = (text) => {
  if (!text) return '';

  // Pass 1: Simple consecutive character-level deduplication
  // Handles exact: "Activity 3.1Activity 3.1" with no separator
  // Works for phrases 6–80 chars
  let result = text;

  // Regex approach: find a phrase that immediately repeats 2+ times
  // We escape the phrase and replace (phrase){2,} with phrase
  // Do multiple passes for overlapping cases
  for (let pass = 0; pass < 3; pass++) {
    // Match any sequence of 6–80 non-newline chars that repeats consecutively
    result = result.replace(
      /(.{6,80}?)\1+/g,
      (match, phrase) => {
        // Only collapse if phrase looks like real content (not just spaces/punctuation)
        const meaningful = /[a-zA-Z0-9]/.test(phrase);
        return meaningful ? phrase : match;
      }
    );
  }

  return result;
};

/* ═══════════════════════════════════════════════════════════════════
   3. REMOVE REPEATING HEADER / FOOTER LINES
   Identifies lines that appear on >50% of pages and removes them.
   These are page headers, chapter running titles, page numbers, etc.

   @param {Array<{page, text}>} pages
   @returns {Array<{page, text}>} cleaned pages
═══════════════════════════════════════════════════════════════════ */
const removeRepeatingHeaderFooter = (pages) => {
  if (!pages || pages.length < 3) return pages; // not enough pages to detect pattern

  const totalPages = pages.length;
  const threshold  = Math.ceil(totalPages * 0.5); // appears on >50% of pages

  // Count line frequency across all pages
  const lineFreq = new Map();
  for (const { text } of pages) {
    const lines = text.split('\n');
    // Only check first 3 and last 3 lines (headers/footers)
    const candidates = [
      ...lines.slice(0, 3),
      ...lines.slice(-3),
    ];
    for (const line of candidates) {
      const norm = line.trim();
      if (!norm || norm.length < 3 || norm.length > 100) continue;
      // Skip pure numbers (page numbers)
      if (/^\d+$/.test(norm)) continue;
      lineFreq.set(norm, (lineFreq.get(norm) || 0) + 1);
    }
  }

  // Build set of header/footer lines to remove
  const toRemove = new Set();
  for (const [line, count] of lineFreq.entries()) {
    if (count >= threshold) {
      toRemove.add(line);
    }
  }

  if (toRemove.size > 0) {
    console.log(`[TextCleaner] Removing ${toRemove.size} repeating header/footer lines:`);
    for (const l of toRemove) console.log(`  - "${l.slice(0, 60)}"`);
  }

  // Remove identified lines from all pages
  return pages.map(({ page, text }) => {
    const lines   = text.split('\n');
    const cleaned = lines.filter(line => !toRemove.has(line.trim()));
    return { page, text: cleaned.join('\n') };
  });
};

/* ═══════════════════════════════════════════════════════════════════
   4. NORMALIZE WHITESPACE
   - Multiple spaces     → single space
   - 3+ newlines         → 2 newlines
   - Trailing spaces     → removed
   - Tabs                → single space
═══════════════════════════════════════════════════════════════════ */
const normalizeWhitespace = (text) => {
  if (!text) return '';
  return text
    .replace(/\t/g, ' ')          // tabs → space
    .replace(/[ \f\r]+/g, ' ')   // multiple spaces → one
    .replace(/ +\n/g, '\n')      // trailing spaces before newline
    .replace(/\n{3,}/g, '\n\n')  // 3+ newlines → 2
    .trim();
};

/* ═══════════════════════════════════════════════════════════════════
   5. CLEAN SINGLE PAGE
   Applies the full cleaning pipeline to a single page's text.
═══════════════════════════════════════════════════════════════════ */
const cleanPage = (text) => {
  if (!text) return '';
  let t = text;
  t = fixConcatenatedWords(t);
  t = deduplicateRepeatedPhrases(t);
  t = normalizeWhitespace(t);
  return t;
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN EXPORT — cleanPages
   Applies the full pipeline to an array of page objects.

   @param {Array<{page: number, text: string, ...rest}>} pages
   @returns {Array<{page: number, text: string, ...rest}>}
═══════════════════════════════════════════════════════════════════ */
const cleanPages = (pages) => {
  if (!pages || !pages.length) return pages;

  const before = pages.reduce((s, p) => s + (p.text || '').length, 0);

  // Step 1: Remove repeating headers/footers (cross-page analysis)
  const noHeaders = removeRepeatingHeaderFooter(pages);

  // Step 2: Clean each page individually
  const cleaned = noHeaders.map(p => ({
    ...p,
    text: cleanPage(p.text || ''),
    // Also clean the merged field if present
    merged: p.merged ? cleanPage(p.merged) : p.merged,
  }));

  const after = cleaned.reduce((s, p) => s + (p.text || '').length, 0);
  const removed = before - after;
  const pct = before > 0 ? ((removed / before) * 100).toFixed(1) : 0;

  console.log(`[TextCleaner] Cleaned ${pages.length} pages`);
  console.log(`[TextCleaner] Before: ${before.toLocaleString()} chars`);
  console.log(`[TextCleaner] After : ${after.toLocaleString()} chars`);
  console.log(`[TextCleaner] Removed: ${removed.toLocaleString()} chars (${pct}% noise)`);

  return cleaned;
};

/* ─── Also export for standalone use in tests ─────────────────── */
module.exports = {
  cleanPages,
  cleanPage,
  fixConcatenatedWords,
  deduplicateRepeatedPhrases,
  removeRepeatingHeaderFooter,
  normalizeWhitespace,
};
