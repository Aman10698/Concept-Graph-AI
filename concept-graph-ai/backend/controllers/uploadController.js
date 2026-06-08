const fs   = require('fs');
const path = require('path');
const { extractText }    = require('../services/textExtractionService');

/**
 * POST /api/upload
 * Accepts a single file (PDF, image, txt) and extracts its text.
 * RAG indexing is NOT done here — use POST /api/rag/index separately.
 */
const uploadFile = async (req, res) => {
  const filePath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileInfo = {
      filename:     req.file.filename,
      originalName: req.file.originalname,
      mimetype:     req.file.mimetype,
      size:         req.file.size,
      uploadedAt:   new Date().toISOString(),
    };

    // ── Extract text ──────────────────────────────────────────────
    let extractedText  = '';
    let extractionMeta = {};
    try {
      const extracted  = await extractText(req.file.path, req.file.mimetype);
      extractedText    = extracted.text || '';
      extractionMeta   = { pages: extracted.pages, ocrFallback: extracted.ocrFallback };
    } catch (extErr) {
      console.warn('⚠️  Text extraction failed (non-fatal):', extErr.message);
    }

    // ★ Delete the temp file — text is now extracted, disk file no longer needed
    try { fs.unlinkSync(req.file.path); } catch (_) {}

    res.status(200).json({
      success: true,
      message: 'File uploaded and text extracted successfully',
      file:    fileInfo,
      extraction: {
        preview:        extractedText.slice(0, 500),
        extractedText,                       // full text returned so RAG can be triggered separately
        characterCount: extractedText.length,
        ...extractionMeta,
      },
    });
  } catch (error) {
    // Clean up file even on failure
    if (filePath) { try { fs.unlinkSync(filePath); } catch (_) {} }
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error:   error.message,
    });
  }
};

const deleteFile = (req, res) => {
  try {
    const { filename } = req.params;
    const filePath     = path.join(__dirname, '..', 'uploads', filename);

    // Prevent directory traversal attacks
    if (!filePath.startsWith(path.join(__dirname, '..', 'uploads'))) {
      return res.status(400).json({ message: 'Invalid file path' });
    }

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.status(200).json({ success: true, message: 'File deleted successfully' });
    } else {
      res.status(404).json({ success: false, message: 'File not found' });
    }
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: 'Error deleting file', error: error.message });
  }
};

module.exports = { uploadFile, deleteFile };
