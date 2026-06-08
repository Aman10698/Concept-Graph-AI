/**
 * extractWorker.js
 *
 * Runs as a CHILD PROCESS via child_process.spawn() (NOT fork).
 * Input  : JSON via process.argv[2]  → { filePath, mimeType }
 * Output : ONE JSON line written to process.stdout, then exits.
 *
 * Why spawn instead of fork?
 *   fork() uses an IPC channel. When the child OOM-crashes, that IPC
 *   channel can corrupts and propagates to the parent on Windows.
 *   spawn() + stdout JSON has zero shared state — a crash just closes
 *   the pipe and the parent catches exit code ≠ 0.
 *
 * Why custom page-by-page PDF extraction?
 *   pdf-parse calls getPage() but never calls page.cleanup() between
 *   pages, so ALL font/image/stream resources for EVERY page accumulate
 *   simultaneously in memory. 20 pages → 4 GB. Our loop calls cleanup()
 *   after every page, keeping peak memory at ~1 page at a time (~100 MB).
 */

'use strict';

// ⚠️  CRITICAL: Redirect ALL console output to stderr.
// extractWorker communicates via stdout (pipe to server).
// console.log/error from pdfjs/tesseract would pollute that pipe buffer.
const _stderr = (...args) => process.stderr.write(args.join(' ') + '\n');
console.log   = _stderr;
console.warn  = _stderr;
console.error = _stderr;
console.info  = _stderr;

const fs         = require('fs');
const fsPromises = require('fs').promises;
const path       = require('path');


/* ── Output helpers (write JSON to stdout, then exit) ──────────────── */
const succeed = (payload) => {
  process.stdout.write(JSON.stringify({ success: true, ...payload }) + '\n');
  process.exit(0);
};

const fail = (msg) => {
  process.stdout.write(JSON.stringify({ success: false, error: msg }) + '\n');
  process.exit(1);
};

/* ═══════════════════════════════════════════════════════════════════
   PDF — page-by-page with page.cleanup() to bound memory
═══════════════════════════════════════════════════════════════════ */
const extractPDF = async (filePath) => {
  // Use the pdfjs bundled inside pdf-parse (CJS, no DOMMatrix needed)
  // Path is relative to workers/ → go up one level to reach node_modules
  const PDFJS = require('../node_modules/pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js');
  PDFJS.disableWorker = true;

  let buf;
  try {
    buf = await fsPromises.readFile(filePath);
  } catch (e) {
    return fail(`Cannot read file: ${e.message}`);
  }

  let doc;
  try {
    doc = await PDFJS.getDocument(buf);
  } catch (e) {
    // pdfjs couldn't parse it at all
    return fail(`pdfjs could not open PDF: ${e.message}`);
  }

  // Release the raw buffer ASAP — pdfjs already has its own copy
  buf = null;

  const numPages  = doc.numPages;
  const MAX_PAGES = 40; // more than enough for RAG chunking
  const limit     = Math.min(numPages, MAX_PAGES);
  const parts     = [];

  for (let i = 1; i <= limit; i++) {
    try {
      const page    = await doc.getPage(i);
      const content = await page.getTextContent({ normalizeWhitespace: true });

      // Join items preserving line breaks (same logic as pdf-parse render_page)
      let lastY = null;
      let text  = '';
      for (const item of content.items) {
        const y = item.transform[5];
        if (lastY !== null && y !== lastY) text += '\n';
        text += item.str;
        lastY = y;
      }

      if (text.trim()) parts.push(text.trim());

      // ★ THE KEY FIX: free fonts, images, streams for this page NOW
      page.cleanup();
    } catch (pageErr) {
      // Skip broken pages rather than aborting the whole doc
      console.error(`  Page ${i} error (skipped):`, pageErr.message);
    }
  }

  // Clean up the document object
  try { doc.destroy(); } catch {}

  const combined = parts.join('\n\n');

  if (combined.length > 20) {
    return succeed({ text: combined, pages: numPages, ocrFallback: false });
  }

  // ── Scanned / image-only PDF → OCR each page as image ───────────
  return extractScannedPDF(filePath);
};

/* ═══════════════════════════════════════════════════════════════════
   Scanned PDF — convert ONE page at a time to PNG then OCR
   Only attempted when text extraction returns nothing.
   
   KEY FIX: We convert and OCR one page at a time rather than loading
   all pages into memory at once. Peak memory = ~1 page (~50-100 MB)
   instead of 5 pages × 15 MB = 750 MB+ simultaneously.
═══════════════════════════════════════════════════════════════════ */
const extractScannedPDF = async (filePath) => {
  try {
    const { pathToFileURL } = require('url');
    const { pdfToPng }      = require('pdf-to-png-converter');

    const pdfJsDistDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
    const cMapsDir     = path.join(pdfJsDistDir, 'cmaps');
    const cMapUrl      = pathToFileURL(cMapsDir).href + '/';

    const Tesseract = require('tesseract.js');
    const worker    = await Tesseract.createWorker('eng');
    const texts     = [];

    // Process one page at a time — convert → OCR → free buffer → next
    const MAX_OCR_PAGES = 5;
    for (let pageNum = 1; pageNum <= MAX_OCR_PAGES; pageNum++) {
      let pages;
      try {
        pages = await pdfToPng(filePath, {
          disableFontFace: true,
          useSystemFonts:  true,
          viewportScale:   1.0, // 1.0 vs 1.2 saves ~30% RAM per page
          cMapUrl,
          cMapPacked:      true,
          pagesToProcess:  [pageNum], // ONE page at a time
        });
      } catch (pageErr) {
        // Page out of range or render error — stop trying further pages
        console.error(`  OCR page ${pageNum} convert error (stopping):`, pageErr.message);
        break;
      }

      if (!pages || pages.length === 0) break; // PDF has fewer than pageNum pages

      try {
        const result = await worker.recognize(pages[0].content);
        const t      = result?.data?.text ?? '';
        if (t.trim()) texts.push(t.trim());
      } catch (ocrErr) {
        console.error(`  OCR page ${pageNum} recognize error (skipped):`, ocrErr.message);
      }

      // ★ Free the PNG buffer immediately before converting the next page
      pages[0] = null;
      pages    = null;
    }

    await worker.terminate();

    const combined = texts.join('\n\n').trim();
    if (!combined) return fail('OCR returned no text from any page');

    return succeed({ text: combined, pages: texts.length, ocrFallback: true });
  } catch (err) {
    return fail(`Scanned PDF OCR failed: ${err.message}`);
  }
};

/* ═══════════════════════════════════════════════════════════════════
   Image — direct Tesseract OCR
═══════════════════════════════════════════════════════════════════ */
const extractImage = async (filePath) => {
  try {
    const Tesseract = require('tesseract.js');
    const worker    = await Tesseract.createWorker('eng');
    const result    = await worker.recognize(filePath);
    await worker.terminate();
    const text = result?.data?.text?.trim() ?? '';
    return succeed({ text: text || '[No readable text found in image]' });
  } catch (e) {
    return fail(`Image OCR failed: ${e.message}`);
  }
};

/* ═══════════════════════════════════════════════════════════════════
   Plain text / TXT
═══════════════════════════════════════════════════════════════════ */
const extractText = async (filePath) => {
  try {
    const text = await fsPromises.readFile(filePath, 'utf-8');
    if (!text || !text.trim()) return fail('File contains no text');
    return succeed({ text: text.trim() });
  } catch (e) {
    return fail(`Cannot read text file: ${e.message}`);
  }
};

/* ═══════════════════════════════════════════════════════════════════
   Entry point
═══════════════════════════════════════════════════════════════════ */
(async () => {
  const raw = process.argv[2];
  if (!raw) return fail('No arguments provided');

  let filePath, mimeType;
  try {
    ({ filePath, mimeType } = JSON.parse(raw));
  } catch {
    return fail('Invalid JSON argument');
  }

  if (!fs.existsSync(filePath)) return fail(`File not found: ${filePath}`);

  if (mimeType === 'application/pdf') return extractPDF(filePath);

  const imageTypes = ['image/jpeg','image/png','image/jpg','image/webp','image/gif','image/bmp'];
  if (imageTypes.includes(mimeType)) return extractImage(filePath);

  const textTypes = ['text/plain','text/txt','application/txt','text/html'];
  if (textTypes.includes(mimeType)) return extractText(filePath);

  fail(`Unsupported MIME type: ${mimeType}`);
})();
