const fs   = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const Tesseract = require('tesseract.js');

let tesseractWorker = null;

/* ── Tesseract initialisation (singleton) ──────────────────────── */
const initTesseract = async () => {
  if (!tesseractWorker) {
    console.log('🚀 Initializing Tesseract OCR engine...');
    tesseractWorker = await Tesseract.createWorker('eng');
    console.log('✅ Tesseract initialized successfully');
  }
  return tesseractWorker;
};

/* ── OCR a single image buffer or file path ─────────────────────── */
const ocrImage = async (input) => {
  const worker = await initTesseract();
  const result = await worker.recognize(input);
  return result?.data?.text ?? '';
};

/* ═══════════════════════════════════════════════════════════════════
   PDF extraction — text-based first, OCR fallback via page images
═══════════════════════════════════════════════════════════════════ */
const extractTextFromPDF = async (filePath) => {
  console.log(`📄 Extracting text from PDF: ${filePath}`);
  const fileBuffer = fs.readFileSync(filePath);

  // ── 1. Try text-based extraction ──────────────────────────────
  let pdfData;
  try {
    pdfData = await pdfParse(fileBuffer);
  } catch (e) {
    console.warn('⚠️  pdf-parse failed:', e.message);
    pdfData = { text: '', numpages: 1 };
  }

  if (pdfData.text && pdfData.text.trim().length > 20) {
    const pageCount = pdfData.info?.Pages ?? pdfData.numpages ?? 'unknown';
    console.log(`✅ PDF text extracted: ${pdfData.text.length} chars from ${pageCount} pages`);
    return {
      success: true,
      text: pdfData.text,
      pages: pageCount,
      metadata: {
        title:    pdfData.info?.Title    || 'Unknown',
        author:   pdfData.info?.Author   || 'Unknown',
        producer: pdfData.info?.Producer || 'Unknown',
      },
    };
  }

  // ── 2. Scanned PDF — convert pages to PNG images, then OCR ────
  console.log('⚠️  PDF has no embedded text — converting pages to images for OCR...');
  try {
    const path               = require('path');
    const { pathToFileURL }  = require('url');
    const { pdfToPng }       = require('pdf-to-png-converter');

    // pdfjs-dist requires a proper file:// URL (with forward slashes + trailing slash)
    // pathToFileURL handles Windows backslashes correctly: C:\...\cmaps → file:///C:/.../cmaps
    const pdfJsDistDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
    const cMapsDir     = path.join(pdfJsDistDir, 'cmaps');
    const cMapUrl      = pathToFileURL(cMapsDir).href + '/';

    const pages = await pdfToPng(filePath, {
      disableFontFace: true,
      useSystemFonts:  true,
      viewportScale:   2.0,
      cMapUrl,
      cMapPacked:      true,
    });


    if (!pages || pages.length === 0) {
      throw new Error('pdf-to-png-converter returned no pages');
    }

    console.log(`🖼️  Converted ${pages.length} page(s) to images — running OCR...`);

    const textParts = [];
    for (let i = 0; i < pages.length; i++) {
      const pageText = await ocrImage(pages[i].content); // content = Buffer
      console.log(`   Page ${i + 1}: ${pageText.trim().length} chars`);
      if (pageText.trim()) textParts.push(pageText);
    }

    const combined = textParts.join('\n\n').trim();
    if (!combined) {
      throw new Error('OCR returned no text from any page. The PDF may be empty or encrypted.');
    }

    console.log(`✅ OCR complete: ${combined.length} total chars from ${pages.length} page(s)`);
    return {
      success: true,
      text: combined,
      pages: pages.length,
      ocrFallback: true,
      metadata: { title: 'Scanned PDF (OCR)', author: 'Unknown', producer: 'Unknown' },
    };
  } catch (ocrErr) {
    console.error('❌ PDF OCR error:', ocrErr.message);
    throw new Error(
      `This PDF appears to be scanned (image-only). OCR failed: ${ocrErr.message}. ` +
      `Please try uploading a photo/screenshot of the document instead.`
    );
  }
};

/* ═══════════════════════════════════════════════════════════════════
   Image extraction via Tesseract
═══════════════════════════════════════════════════════════════════ */
const extractTextFromImage = async (filePath) => {
  console.log(`🖼️  Extracting text from image via OCR: ${filePath}`);
  try {
    const text = await ocrImage(filePath);
    if (!text || !text.trim()) {
      return { success: true, text: '[No readable text found in image]', confidence: 0 };
    }
    console.log(`✅ Image OCR complete: ${text.length} chars`);
    return { success: true, text };
  } catch (err) {
    console.error('❌ Image OCR error:', err.message);
    throw new Error(`Image OCR failed: ${err.message}`);
  }
};

/* ═══════════════════════════════════════════════════════════════════
   Plain text file extraction
═══════════════════════════════════════════════════════════════════ */
const extractTextFromPlainText = async (filePath) => {
  console.log(`📝 Reading text file: ${filePath}`);
  const text = fs.readFileSync(filePath, 'utf-8');
  if (!text || !text.trim()) throw new Error('File contains no text');
  console.log(`✅ Text file read: ${text.length} chars`);
  return { success: true, text };
};

/* ═══════════════════════════════════════════════════════════════════
   Main dispatcher
═══════════════════════════════════════════════════════════════════ */
const extractText = async (filePath, mimeType) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  console.log(`\n📥 Starting extraction`);
  console.log(`   Path: ${filePath}`);
  console.log(`   Type: ${mimeType}`);

  if (mimeType === 'application/pdf') {
    return extractTextFromPDF(filePath);
  }

  const imageTypes = ['image/jpeg','image/png','image/jpg','image/webp','image/gif','image/bmp'];
  if (imageTypes.includes(mimeType)) {
    return extractTextFromImage(filePath);
  }

  const textTypes = ['text/plain','text/txt','application/txt','text/html'];
  if (textTypes.includes(mimeType)) {
    return extractTextFromPlainText(filePath);
  }

  throw new Error(
    `Unsupported file type: ${mimeType}. Supported: PDF, JPEG, PNG, GIF, BMP, WebP, TXT`
  );
};

/* ── Cleanup ────────────────────────────────────────────────────── */
const cleanupTesseract = async () => {
  if (tesseractWorker) {
    try {
      await tesseractWorker.terminate();
      tesseractWorker = null;
      console.log('✅ Tesseract worker terminated');
    } catch (err) {
      console.error('❌ Tesseract cleanup error:', err.message);
    }
  }
};

module.exports = {
  extractText,
  extractTextFromPDF,
  extractTextFromImage,
  extractTextFromPlainText,
  cleanupTesseract,
  initTesseract,
};