/**
 * ragRoutes.js  — Production Edition
 *
 * Routes:
 *  POST   /api/rag/register           — register doc metadata instantly
 *  POST   /api/rag/index              — index plain text (legacy)
 *  POST   /api/rag/index-multimodal   — full PDF extraction + indexing
 *  GET    /api/rag/documents          — list user documents
 *  DELETE /api/rag/documents/:id      — delete document
 *  POST   /api/rag/chat               — Hybrid chat router
 *  POST   /api/rag/analyze            — explicit document analysis
 *  GET    /api/rag/document-debug     — document structure diagnostics
 *  GET    /api/rag/debug/document     — alias for document-debug
 *  GET    /api/rag/debug/retrieval    — retrieval diagnostics
 *  POST   /api/rag/chat-history       — save chat thread
 *  GET    /api/rag/chat-history       — load chat thread
 *  DELETE /api/rag/chat-history       — clear chat thread
 *
 * Query Router Logic:
 *   EXTRACTION queries → RagStructuredElement (pre-built DB index, instant)
 *   KNOWLEDGE questions → LanceDB hybrid search → Ollama
 */

const express = require('express');
const router  = express.Router();
const multer  = require('multer');

const {
  storeDocument,
  listDocuments,
  deleteDocument,
  retrieveContext,
  retrieveFullDocument,
  retrieveStructuredElements,
  getRawDocument,
  registerDocument,
} = require('../services/ragService');

const {
  classifyQuery,
  formatResultsAsMarkdown,
} = require('../services/documentAnalysisService');

const { embedText }  = require('../services/lanceService');
const ChatHistory    = require('../models/ChatHistory');
const RagStructuredElement = require('../models/RagStructuredElement');

/* ── Multer: memory storage for uploaded PDFs ────────────────── */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 },
});

/* ═══════════════════════════════════════════════════════════════════
   POST /api/rag/register
═══════════════════════════════════════════════════════════════════ */
router.post('/rag/register', async (req, res) => {
  try {
    const { userId, filename, mimetype, syllabusId } = req.body;
    if (!userId)   return res.status(400).json({ error: 'userId is required' });
    if (!filename) return res.status(400).json({ error: 'filename is required' });
    const documentId = await registerDocument(userId, syllabusId || '', filename, mimetype || 'application/octet-stream');
    res.json({ success: true, documentId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   POST /api/rag/index  — legacy plain-text path
═══════════════════════════════════════════════════════════════════ */
router.post('/rag/index', async (req, res) => {
  try {
    const { userId, syllabusId, filename, mimetype, extractedText } = req.body;
    if (!userId)   return res.status(400).json({ error: 'userId is required' });
    if (!filename) return res.status(400).json({ error: 'filename is required' });
    if (!extractedText?.trim() || extractedText.length < 20)
      return res.status(400).json({ error: 'extractedText too short' });

    const result = await storeDocument(userId, syllabusId || '', filename, mimetype || 'application/octet-stream', extractedText);
    res.json({ success: true, rag: result });
  } catch (err) {
    console.error('POST /rag/index:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   POST /api/rag/index-multimodal  — full PDF extraction pipeline
═══════════════════════════════════════════════════════════════════ */
router.post('/rag/index-multimodal', upload.single('file'), async (req, res) => {
  try {
    const { userId, syllabusId, enableVision } = req.body;
    const file = req.file;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (!file)   return res.status(400).json({ error: 'PDF file is required' });

    const filename  = file.originalname || 'document.pdf';
    const mimeType  = file.mimetype     || 'application/pdf';
    const useVision = enableVision === 'true' || enableVision === true;

    console.log(`\n📄 Multimodal RAG: "${filename}" (${(file.size / 1024).toFixed(0)} KB), vision: ${useVision}`);

    const { extractMultimodal } = require('../services/pdfExtractorService');
    const pages = await extractMultimodal(file.buffer, { enableVision: useVision, visionMaxPages: 30 });

    if (!pages.length) return res.status(422).json({ error: 'Could not extract text from PDF' });

    const result   = await storeDocument(userId, syllabusId || '', filename, mimeType, pages);
    const fullText = pages.map(p => p.text).join('\n\n');

    res.json({
      success:       true,
      message:       `Indexed ${pages.length} pages`,
      rag:           { ...result, pages: pages.length, vision: useVision },
      extractedText: fullText,
    });
  } catch (err) {
    console.error('POST /rag/index-multimodal:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   GET /api/rag/documents
═══════════════════════════════════════════════════════════════════ */
router.get('/rag/documents', async (req, res) => {
  try {
    const { userId, syllabusId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const docs = await listDocuments(userId, syllabusId || null);
    res.json({ success: true, documents: docs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   DELETE /api/rag/documents/:id
═══════════════════════════════════════════════════════════════════ */
router.delete('/rag/documents/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    const { id }     = req.params;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const deleted = await deleteDocument(userId, id);
    if (!deleted) return res.status(404).json({ error: 'Document not found' });
    await ChatHistory.deleteOne({ userId, documentId: id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   GET /api/rag/document-debug  (alias: /api/rag/debug/document)
   Full structural diagnostics — queries RagStructuredElement.
═══════════════════════════════════════════════════════════════════ */
const documentDebugHandler = async (req, res) => {
  try {
    const { userId, documentId } = req.query;
    if (!userId)     return res.status(400).json({ error: 'userId required' });
    if (!documentId) return res.status(400).json({ error: 'documentId required' });

    const rawDoc = await getRawDocument(userId, documentId);
    if (!rawDoc) {
      return res.json({ success: false, hasRawDocument: false, message: 'Re-upload to enable Document Analysis.' });
    }

    // Query pre-built structured index
    const [activities, questions, definitions, formulas, exercises] = await Promise.all([
      RagStructuredElement.find({ userId, documentId, type: 'activity'   }).lean(),
      RagStructuredElement.find({ userId, documentId, type: 'question'   }).lean(),
      RagStructuredElement.find({ userId, documentId, type: 'definition' }).lean(),
      RagStructuredElement.find({ userId, documentId, type: 'formula'    }).lean(),
      RagStructuredElement.find({ userId, documentId, type: 'exercise'   }).lean(),
    ]);

    // LanceDB chunk count
    let chunkCount = 0, pagesIndexed = 0;
    try {
      const { getRagTable } = require('../services/lanceService');
      const table = await getRagTable();
      const rows  = await table.query()
        .where(`userId = '${userId.replace(/'/g,"\\'")}' AND documentId = '${documentId.replace(/'/g,"\\'")}' `)
        .select(['chunkIndex', 'page']).toArray();
      chunkCount   = rows.length;
      pagesIndexed = new Set(rows.map(r => r.page).filter(p => p > 0)).size;
    } catch (_) {}

    res.json({
      success:          true,
      hasRawDocument:   true,
      filename:         rawDoc.filename,
      pageCount:        rawDoc.pageCount,
      fullTextLength:   rawDoc.fullText.length,
      wordCount:        rawDoc.fullText.split(/\s+/).filter(Boolean).length,
      // Structured index counts (accurate — from DB, not regex)
      activityCount:    activities.length,
      questionCount:    questions.length,
      definitionCount:  definitions.length,
      formulaCount:     formulas.length,
      exerciseCount:    exercises.length,
      // Sample activities for quick inspection
      sampleActivities: activities.slice(0, 5).map(a => ({ label: a.label, page: a.page, preview: a.content?.slice(0, 100) })),
      // LanceDB
      chunkCount,
      pagesIndexed,
      // Previews
      firstPagePreview: rawDoc.pages?.[0]?.text?.slice(0, 300) || '',
      lastPagePreview:  rawDoc.pages?.[rawDoc.pages.length - 1]?.text?.slice(0, 300) || '',
      createdAt:        rawDoc.createdAt,
      updatedAt:        rawDoc.updatedAt,
    });
  } catch (err) {
    console.error('document-debug:', err.message);
    res.status(500).json({ error: err.message });
  }
};

router.get('/rag/document-debug', documentDebugHandler);
router.get('/rag/debug/document', documentDebugHandler);

/* ═══════════════════════════════════════════════════════════════════
   GET /api/rag/debug/retrieval
   Tests the retrieval pipeline for a given query.
═══════════════════════════════════════════════════════════════════ */
router.get('/rag/debug/retrieval', async (req, res) => {
  try {
    const { userId, documentId, query } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!query)  return res.status(400).json({ error: 'query required' });

    const { isExtraction, queryType } = classifyQuery(query);
    let retrievalMode = 'vector', chunks = [], context = '';

    if (isExtraction && documentId) {
      retrievalMode = 'structured-index';
      const typeMap = { activities: 'activity', questions: 'question', definitions: 'definition', formulas: 'formula', exercises: 'exercise' };
      const dbType  = typeMap[queryType] || null;
      const elements = await retrieveStructuredElements(userId, documentId, dbType);

      chunks  = elements.map(e => ({ type: e.type, identifier: e.identifier, page: e.page, content: e.content?.slice(0, 100) }));
      context = `Found ${elements.length} ${queryType || 'elements'} in structured index`;
    } else {
      retrievalMode = 'hybrid-vector';
      context = await retrieveContext(userId, null, query, 10, documentId || null);
      chunks  = [{ preview: context.slice(0, 300), length: context.length }];
    }

    const docs = await listDocuments(userId, null).catch(() => []);

    res.json({
      success: true,
      query,
      isExtractionQuery: isExtraction,
      queryType,
      retrievalMode,
      resultCount:  chunks.length,
      contextLength: context.length,
      results:      chunks.slice(0, 10),
      documentsIndexed: docs.length,
      documents: docs.map(d => ({ id: d._id, filename: d.filename, chunks: d.chunkCount, status: d.status })),
    });
  } catch (err) {
    console.error('debug/retrieval:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   POST /api/rag/analyze  — explicit analysis endpoint
═══════════════════════════════════════════════════════════════════ */
router.post('/rag/analyze', async (req, res) => {
  try {
    const { userId, documentId, queryType = 'all' } = req.body;
    if (!userId)     return res.status(400).json({ error: 'userId required' });
    if (!documentId) return res.status(400).json({ error: 'documentId required' });

    const typeMap = {
      all:         null,
      activities:  'activity',
      questions:   'question',
      definitions: 'definition',
      formulas:    'formula',
      exercises:   'exercise',
    };
    const dbType   = typeMap[queryType];
    const elements = await retrieveStructuredElements(userId, documentId, dbType);

    // Format as structured response
    const grouped = {};
    for (const el of elements) {
      if (!grouped[el.type]) grouped[el.type] = [];
      grouped[el.type].push({ identifier: el.identifier, page: el.page, content: el.content, label: el.label });
    }

    res.json({ success: true, queryType, totalElements: elements.length, elements: grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════════════════════════════════════════════════
   POST /api/rag/chat  — Hybrid Query Router
═══════════════════════════════════════════════════════════════════ */
router.post('/rag/chat', async (req, res) => {
  try {
    const { userId, documentId, messages = [] } = req.body;
    if (!userId)          return res.status(400).json({ error: 'userId required' });
    if (!messages.length) return res.status(400).json({ error: 'messages empty' });

    const lastUser = [...messages].reverse().find(m => m.role === 'user');
    const query    = lastUser?.content || '';

    const { isExtraction, queryType } = classifyQuery(query);

    // SSE setup
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

    /* ── BRANCH A: EXTRACTION — query structured index ────────── */
    if (isExtraction && documentId) {
      console.log(`\n📚 [Chat] EXTRACTION mode — type: ${queryType} | "${query.slice(0, 60)}"`);

      const typeMap   = { activities: 'activity', questions: 'question', definitions: 'definition', formulas: 'formula', exercises: 'exercise', summary: null };
      const dbType    = typeMap[queryType] ?? null;
      const elements  = await retrieveStructuredElements(userId, documentId, dbType);

      console.log(`   Found ${elements.length} elements in structured index`);

      if (elements.length > 0) {
        // Format elements directly as markdown
        const markdown = formatElementsMarkdown(elements, queryType, query);

        // Send to Ollama for light polish
        const systemPrompt = `You are an expert study assistant. The student asked: "${query}"

The following items were extracted from their notes using a deterministic parser. Present them clearly and educationally.
DO NOT omit any item. DO NOT add items not listed below. Cite page numbers where shown.

EXTRACTED ITEMS:
${markdown.slice(0, 25000)}`;

        try {
          const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model:    OLLAMA_MODEL,
              messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }],
              stream:   true,
            }),
          });

          if (ollamaRes.ok) {
            await pipeStream(ollamaRes, res);
          } else {
            streamText(res, markdown);
          }
        } catch (_) {
          streamText(res, markdown);
        }
        return;
      }

      // Structured index empty — fall through to RAG with full text
      console.log('   Structured index empty — falling back to RAG');
    }

    /* ── BRANCH B: KNOWLEDGE — hybrid vector search ────────────── */
    console.log(`\n🔍 [Chat] RAG mode | "${query.slice(0, 60)}"`);

    const context = await retrieveContext(userId, null, query, 15, documentId || null);
    console.log(`   Context: ${context.length} chars`);

    const systemPrompt = context
      ? `You are an expert study assistant. Answer ONLY from the student's notes below.
Rules:
1. Use ONLY the content provided — no outside knowledge.
2. If not in notes: say "This topic isn't in your uploaded notes."
3. Cite page numbers when shown as [Page N].
4. Format with Markdown: **bold** key terms, bullet lists, ## headings.
5. Be educational and concise.

STUDENT'S NOTES:
${context}`
      : `You are a study assistant. No relevant content was found in the student's notes.
Say: "I couldn't find this in your uploaded notes. Please check if the relevant file has been uploaded."
Do NOT answer from general knowledge.`;

    const cleanMsgs = messages.filter(m => m.content?.trim());
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        model:    OLLAMA_MODEL,
        messages: [{ role: 'system', content: systemPrompt }, ...cleanMsgs],
        stream:   true,
      }),
    });

    if (!ollamaRes.ok) {
      res.write(`data: ${JSON.stringify({ error: `Ollama ${ollamaRes.status}` })}\n\n`);
      return res.end();
    }

    await pipeStream(ollamaRes, res);

  } catch (err) {
    console.error('POST /rag/chat:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else { res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`); res.end(); }
  }
});

/* ─── Format structured elements as clean markdown ──────────── */
const formatElementsMarkdown = (elements, queryType, query) => {
  const lines = [];
  const byType = {};
  for (const el of elements) {
    if (!byType[el.type]) byType[el.type] = [];
    byType[el.type].push(el);
  }

  for (const [type, items] of Object.entries(byType)) {
    lines.push(`## ${type.charAt(0).toUpperCase() + type.slice(1)}s Found (${items.length} total)\n`);
    for (const el of items) {
      const pageTag = el.page > 0 ? ` *(Page ${el.page})*` : '';
      if (type === 'activity') {
        lines.push(`### ${el.label}${pageTag}`);
        lines.push(el.content.replace(/^Activity[\s\d.]+/i, '').trim().slice(0, 600));
        lines.push('');
      } else if (type === 'definition') {
        lines.push(`- **${el.label}**: ${el.content.replace(/^[^:]+:\s*/, '')}${pageTag}`);
      } else if (type === 'formula') {
        lines.push(`- \`${el.content}\`${pageTag}`);
      } else if (type === 'question') {
        lines.push(`${el.identifier}. ${el.content}${pageTag}`);
      } else {
        lines.push(`### ${el.label}${pageTag}`);
        lines.push(el.content.slice(0, 500));
        lines.push('');
      }
    }
    lines.push('');
  }

  return lines.join('\n') || `No ${queryType} found in the document.`;
};

/* ─── SSE streaming helpers ──────────────────────────────────── */
const streamText = (res, text) => {
  const CHUNK = 300;
  for (let i = 0; i < text.length; i += CHUNK) {
    res.write(`data: ${JSON.stringify({ token: text.slice(i, i + CHUNK) })}\n\n`);
  }
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
};

const pipeStream = async (ollamaRes, res) => {
  const dec = new TextDecoder();
  for await (const chunk of ollamaRes.body) {
    const lines = dec.decode(chunk, { stream: true }).split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const json  = JSON.parse(line);
        const token = json?.message?.content ?? '';
        if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
        if (json.done) { res.write(`data: ${JSON.stringify({ done: true })}\n\n`); res.end(); return; }
      } catch (_) {}
    }
  }
  res.end();
};

/* ═══════════════════════════════════════════════════════════════════
   CHAT HISTORY
═══════════════════════════════════════════════════════════════════ */
router.post('/rag/chat-history', async (req, res) => {
  try {
    const { userId, documentId, documentName = '', messages = [] } = req.body;
    if (!userId || !documentId) return res.status(400).json({ error: 'userId and documentId required' });
    const clean = messages.filter(m => m.role && m.content?.trim());
    await ChatHistory.findOneAndUpdate({ userId, documentId }, { $set: { documentName, messages: clean } }, { upsert: true });
    res.json({ success: true, saved: clean.length });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/rag/chat-history', async (req, res) => {
  try {
    const { userId, documentId } = req.query;
    if (!userId || !documentId) return res.status(400).json({ error: 'userId and documentId required' });
    const record = await ChatHistory.findOne({ userId, documentId }).lean();
    res.json({ success: true, messages: record?.messages ?? [], updatedAt: record?.updatedAt ?? null });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/rag/chat-history', async (req, res) => {
  try {
    const { userId, documentId } = req.query;
    if (!userId || !documentId) return res.status(400).json({ error: 'userId and documentId required' });
    await ChatHistory.deleteOne({ userId, documentId });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
