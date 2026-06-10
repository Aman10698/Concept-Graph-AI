/**
 * pdfExtractorService.js
 *
 * Multimodal PDF content extraction pipeline:
 *   Phase 1 — Text:   Per-page text via pdf-parse (form-feed split)
 *   Phase 1 — Tables: Regex-based table structure detection
 *   Phase 1 — Images: Page-to-PNG via pdf-to-png-converter + Ollama vision
 *   Phase 2 — Merge:  Per-page merged content block (TEXT / TABLES / IMAGES)
 *   Phase 3 — Meta:   page, contentType, chapter, topic, keywords per chunk
 *
 * Falls back gracefully at every step — if vision fails, text is still indexed.
 */

const os   = require('os');
const path = require('path');
const fs   = require('fs');

const { describeImage, detectVisionModel } = require('./visionService');

/* ═══════════════════════════════════════════════════════════════════
   PHASE 1a — TABLE DETECTION
   Detects pipe-delimited or tab-separated table structures in text.
═══════════════════════════════════════════════════════════════════ */
const extractTablesFromText = (text) => {
  if (!text) return '';

  const lines     = text.split('\n').map(l => l.trim());
  const tables    = [];
  let tableRows   = [];

  const isTableRow = (line) => {
    if (line.length < 4) return false;
    const pipes = (line.match(/\|/g) || []).length;
    const tabs  = (line.match(/\t/g) || []).length;
    // Separator lines like "---|---|---" are part of table but not data
    const isSep = /^[\-|:+\s]{4,}$/.test(line);
    return (pipes >= 1 || tabs >= 1) && !isSep;
  };

  for (const line of lines) {
    if (isTableRow(line)) {
      tableRows.push(line);
    } else {
      if (tableRows.length >= 2) {
        const formatted = tableRows.map(row =>
          row.split(/\s*\|\s*|\t/)
             .filter(c => c.trim())
             .join(' | ')
        ).join('\n');
        tables.push(`Table:\n${formatted}`);
      }
      tableRows = [];
    }
  }

  // Flush trailing table
  if (tableRows.length >= 2) {
    const formatted = tableRows.map(row =>
      row.split(/\s*\|\s*|\t/)
         .filter(c => c.trim())
         .join(' | ')
    ).join('\n');
    tables.push(`Table:\n${formatted}`);
  }

  return tables.join('\n\n');
};

/* ═══════════════════════════════════════════════════════════════════
   PHASE 3 — METADATA HELPERS
   Detect chapter titles and extract top keywords per page.
═══════════════════════════════════════════════════════════════════ */
const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','must','can','this','that','these','those','it','its',
  'of','in','on','at','to','for','with','by','from','and','or','but',
  'not','no','so','if','as','up','out','into','than','then','when',
  'which','who','what','how','where','why','each','some','any',
]);

const extractKeywords = (text, max = 8) => {
  const freq = {};
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !STOP_WORDS.has(w))
    .forEach(w => { freq[w] = (freq[w] || 0) + 1; });

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([w]) => w);
};

const detectChapter = (text) => {
  const lines = (text || '').split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines.slice(0, 8)) {
    if (/^(chapter|unit|module|section)\s+[\d]+/i.test(line)) return line;
    if (/^\d+\.\s+[A-Z][a-z]{2}/.test(line) && line.length < 80)  return line;
    if (/^[A-Z][A-Z\s\-]{5,60}$/.test(line) && line.length < 80)  return line;
  }
  return '';
};

/* ═══════════════════════════════════════════════════════════════════
   PHASE 1b — PER-PAGE TEXT EXTRACTION
   Uses pdf-parse with form-feed (\f) splits for page boundaries,
   then falls back to approximate equal splits if form-feeds absent.
═══════════════════════════════════════════════════════════════════ */
const extractTextPerPage = async (pdfBuffer) => {
  const pdfParse = require('pdf-parse');

  // Collect page texts via the pagerender callback
  const pageTexts = [];

  const renderPage = (pageData) =>
    pageData
      .getTextContent({ normalizeWhitespace: true })
      .then(tc => {
        let lastY  = null;
        let lastX  = null;
        let text   = '';

        for (const item of tc.items) {
          const str = item.str || '';
          if (!str) continue;

          const y = item.transform[5];
          const x = item.transform[4];

          if (lastY !== null) {
            const yDiff = Math.abs(y - lastY);
            if (yDiff > 4) {
              // New line — different vertical position
              text += '\n';
            } else {
              // Same line — insert space if neither side has whitespace
              // This fixes "Activity3.1" and "malleabilityMalleability"
              const needsSpace =
                text.length > 0 &&
                !/\s$/.test(text) &&
                !/^\s/.test(str);
              if (needsSpace) text += ' ';
            }
          }

          text  += str;
          lastY  = y;
          lastX  = x + (item.width || 0);
        }

        pageTexts.push(text.trim());
        return text;
      });

  try {
    const data = await pdfParse(pdfBuffer, { pagerender: renderPage });

    // pagerender fires for each page in order
    if (pageTexts.length > 0) {
      console.log(`[PDFExtractor] ✅ Per-page text extracted: ${pageTexts.length} pages`);
      return pageTexts.map((text, i) => ({ page: i + 1, text }));
    }

    // Fallback — use the full text and split on form-feeds
    const byFF = data.text.split('\f').map(t => t.trim()).filter(Boolean);
    if (byFF.length > 1) {
      console.log(`[PDFExtractor] Form-feed split: ${byFF.length} pages`);
      return byFF.map((text, i) => ({ page: i + 1, text }));
    }

    // Last resort — single block
    console.log('[PDFExtractor] Single-block fallback');
    return [{ page: 1, text: data.text.trim() }];

  } catch (err) {
    console.error('[PDFExtractor] pdf-parse failed:', err.message);
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════════
   PHASE 1c — PAGE IMAGE RENDERING + VISION
   Uses pdf-to-png-converter (already installed) to render pages.
   Sends each PNG to Ollama vision for educational description.
═══════════════════════════════════════════════════════════════════ */
const renderAndDescribePage = async (pdfBuffer, pageNum) => {
  try {
    const { pdfToPng } = require('pdf-to-png-converter');

    const pages = await pdfToPng(pdfBuffer, {
      disableFontFace:  true,
      useSystemFonts:   true,
      viewportScale:    1.5,
      pagesToProcess:   [pageNum],
      strictPagesToProcess: false,
    });

    if (!pages || !pages.length || !pages[0].content) {
      return null;
    }

    // pages[0].content is a Buffer (PNG bytes)
    const description = await describeImage(pages[0].content);

    // Free the PNG buffer immediately
    pages[0].content = null;

    return description;

  } catch (err) {
    // pdf-to-png-converter may fail silently on some PDFs — that's fine
    console.warn(`[PDFExtractor] Vision render page ${pageNum}: ${err.message}`);
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════════
   PHASE 2 — CONTENT MERGING
   Combines text + tables + image description into a labelled block.
   PAGE N
   TEXT:   ...
   TABLES: ...
   IMAGES: ...
═══════════════════════════════════════════════════════════════════ */
const mergePage = ({ page, text, tables, imageDescription }) => {
  const sections = [];
  if (text)             sections.push(`TEXT:\n${text}`);
  if (tables)           sections.push(`TABLES:\n${tables}`);
  if (imageDescription) sections.push(`IMAGES:\n${imageDescription}`);

  return `PAGE ${page}\n\n${sections.join('\n\n')}`;
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN EXPORT — extractMultimodal
   Full multimodal extraction pipeline for a PDF buffer.

   @param {Buffer}  pdfBuffer
   @param {object}  opts
   @param {boolean} opts.enableVision    — use Ollama vision (slow; disabled by default)
   @param {number}  opts.visionMaxPages  — cap pages sent to vision (default: 30)
   @returns {Array<PageContent>}

   Each PageContent:
   {
     page:             number,
     text:             string,
     tables:           string,
     imageDescription: string,
     merged:           string,   ← what gets chunked & embedded
     contentType:      'text' | 'table' | 'image' | 'merged',
     chapter:          string,
     topic:            string,
     keywords:         string[],
   }
═══════════════════════════════════════════════════════════════════ */
const extractMultimodal = async (pdfBuffer, opts = {}) => {
  const {
    enableVision   = false,
    visionMaxPages = 30,
  } = opts;

  // Counters for Phase 9 logging
  let pagesProcessed   = 0;
  let tablesDetected   = 0;
  let visionAttempted  = 0;
  let visionSucceeded  = 0;

  console.log('');
  console.log('═══════════════════════════════════════════════════════');
  console.log(' [PDFExtractor] Multimodal extraction starting...');
  console.log(`  Vision enabled : ${enableVision}`);
  console.log('═══════════════════════════════════════════════════════');

  // Check if a vision model is even available before wasting time on rendering
  let visionAvailable = false;
  if (enableVision) {
    const model = await detectVisionModel();
    visionAvailable = !!model;
    if (!visionAvailable) {
      console.warn('[PDFExtractor] No vision model — image analysis skipped');
    }
  }

  // Step 1 — Extract text per page
  const textPages = await extractTextPerPage(pdfBuffer);
  console.log(`[PDFExtractor] Pages extracted : ${textPages.length}`);

  const pageContents = [];

  for (const { page, text } of textPages) {
    pagesProcessed++;

    // Step 2 — Detect tables from this page's text
    const tables = extractTablesFromText(text);
    if (tables) tablesDetected++;

    // Step 3 — Vision analysis (optional)
    let imageDescription = '';
    if (enableVision && visionAvailable && page <= visionMaxPages) {
      visionAttempted++;
      const desc = await renderAndDescribePage(pdfBuffer, page);
      if (desc) {
        imageDescription = desc;
        visionSucceeded++;
      }
    }

    // Step 4 — Metadata
    const chapter  = detectChapter(text);
    const keywords = extractKeywords(text + ' ' + imageDescription);

    // Step 5 — Determine content type
    const contentType =
      imageDescription && tables ? 'merged'
      : imageDescription          ? 'image'
      : tables                    ? 'table'
      :                             'text';

    // Step 6 — Merge into labelled block
    const merged = mergePage({ page, text, tables, imageDescription });

    pageContents.push({
      page,
      text,
      tables,
      imageDescription,
      merged,
      contentType,
      chapter,
      topic:    chapter, // refined by LLM topic extraction upstream
      keywords,
    });
  }

  // Phase 9 — Debug summary
  console.log('');
  console.log('─────────────────────────────────────────────────────');
  console.log(` Pages processed      : ${pagesProcessed}`);
  console.log(` Tables detected      : ${tablesDetected}`);
  console.log(` Vision attempted     : ${visionAttempted}`);
  console.log(` Vision descriptions  : ${visionSucceeded}`);
  console.log('─────────────────────────────────────────────────────');

  return pageContents;
};

module.exports = {
  extractMultimodal,
  extractTablesFromText,
  extractKeywords,
  detectChapter,
};
