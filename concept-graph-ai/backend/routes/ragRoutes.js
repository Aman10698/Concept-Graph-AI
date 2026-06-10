const express     = require('express');
const router      = express.Router();
const { storeDocument, listDocuments, deleteDocument, retrieveContext, registerDocument } = require('../services/ragService');
const { embedText }  = require('../services/lanceService');
const ChatHistory    = require('../models/ChatHistory');

/**
 * POST /api/rag/register
 * Body: { userId, filename, mimetype, syllabusId? }
 *
 * Fast endpoint — saves document metadata to MongoDB immediately and
 * returns the real documentId. Call this right after upload so the doc
 * appears in "My Notes" before the slow LanceDB embedding finishes.
 */
router.post('/rag/register', async (req, res) => {
  try {
    const { userId, filename, mimetype, syllabusId } = req.body;
    if (!userId)   return res.status(400).json({ error: 'userId is required' });
    if (!filename) return res.status(400).json({ error: 'filename is required' });

    const documentId = await registerDocument(userId, syllabusId || '', filename, mimetype || 'application/octet-stream');
    res.json({ success: true, documentId });
  } catch (err) {
    console.error('ragRoutes POST /rag/register:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rag/index
 * Body: { userId, syllabusId?, filename, mimetype, extractedText }
 */
router.post('/rag/index', async (req, res) => {

  try {
    const { userId, syllabusId, filename, mimetype, extractedText } = req.body;

    if (!userId)        return res.status(400).json({ error: 'userId is required' });
    if (!filename)      return res.status(400).json({ error: 'filename is required' });
    if (!extractedText || extractedText.trim().length < 20) {
      return res.status(400).json({ error: 'extractedText is too short to index' });
    }

    const result = await storeDocument(
      userId,
      syllabusId || '',
      filename,
      mimetype || 'application/octet-stream',
      extractedText,
    );

    console.log(`📚 RAG: Indexed ${result.chunkCount} chunks for user="${userId}"`);

    res.json({
      success: true,
      message: 'Document indexed for RAG successfully',
      rag: { documentId: result.documentId, chunkCount: result.chunkCount },
    });
  } catch (err) {
    console.error('ragRoutes POST /rag/index:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rag/documents
 * Query: userId (required), syllabusId (optional)
 */
router.get('/rag/documents', async (req, res) => {
  try {
    const { userId, syllabusId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const docs = await listDocuments(userId, syllabusId || null);
    res.json({ success: true, documents: docs });
  } catch (err) {
    console.error('ragRoutes GET /documents:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/rag/documents/:id
 * Query: userId (required)
 */
router.delete('/rag/documents/:id', async (req, res) => {
  try {
    const { userId } = req.query;
    const { id }     = req.params;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const deleted = await deleteDocument(userId, id);
    if (!deleted) return res.status(404).json({ error: 'Document not found or access denied' });

    // Also wipe the chat history thread for this document
    await ChatHistory.deleteOne({ userId, documentId: id });

    res.json({ success: true, message: 'RAG document and chat history deleted' });
  } catch (err) {
    console.error('ragRoutes DELETE /documents/:id:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rag/debug
 * Query: userId (required), documentId (optional), query (required)
 *
 * Diagnostic endpoint — runs the full retrieval pipeline and returns:
 *  - How many chars of context were retrieved
 *  - The actual raw context text that would be sent to Ollama
 *  - Whether nomic-embed-text is reachable
 *
 * Usage: http://localhost:5000/api/rag/debug?userId=XXX&query=what+are+crops
 */
router.get('/rag/debug', async (req, res) => {
  try {
    const { userId, documentId, query } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!query)  return res.status(400).json({ error: 'query required' });

    // Test embedding step
    let embedOk = false;
    let embedError = null;
    try {
      const vec = await embedText(query.slice(0, 200));
      embedOk = Array.isArray(vec) && vec.length > 0;
      vec.length = 0;
    } catch (e) {
      embedError = e.message;
    }

    // Run retrieval
    let context = '';
    let retrievalError = null;
    try {
      context = await retrieveContext(userId, null, query, 8, documentId || null);
    } catch (e) {
      retrievalError = e.message;
    }

    // List documents for the user
    const docs = await listDocuments(userId, null).catch(() => []);

    res.json({
      success: true,
      diagnosis: {
        embedModelOk:    embedOk,
        embedError,
        retrievalError,
        contextLength:   context.length,
        contextPreview:  context.slice(0, 500),  // first 500 chars
        fullContext:     context,                 // full retrieved context
        docsIndexed:     docs.length,
        documents:       docs.map(d => ({ id: d._id, filename: d.filename, chunks: d.chunkCount })),
      },
    });
  } catch (err) {
    console.error('ragRoutes GET /rag/debug:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rag/chat
 * Body: { userId, documentId, messages: [{role, content}], stream?: boolean }
 *
 * Retrieves relevant RAG context, calls Ollama with a grounded system prompt.
 * Responds with SSE (text/event-stream) token-by-token.
 */
router.post('/rag/chat', async (req, res) => {
  try {
    const { userId, documentId, messages = [] } = req.body;

    if (!userId)       return res.status(400).json({ error: 'userId is required' });
    if (!messages.length) return res.status(400).json({ error: 'messages array is empty' });

    // Last user message is the query for RAG retrieval
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    const query = lastUserMsg?.content || '';

    // Retrieve top-8 relevant chunks from LanceDB (was top-5)
    const context = await retrieveContext(userId, null, query, 8, documentId || null);

    // Log what's being retrieved so you can see it in the terminal
    console.log(`\n🔍 RAG Chat — query: "${query.slice(0, 80)}"`);
    console.log(`   documentId: ${documentId || 'all docs'}`);
    console.log(`   Context retrieved: ${context.length} chars`);
    if (context.length > 0) {
      console.log(`   Context preview: ${context.slice(0, 200)}…`);
    } else {
      console.log(`   ⚠️  No context found! Check if nomic-embed-text indexed the document correctly.`);
    }

    // System prompt — strictly grounded in uploaded notes, markdown output
    const systemPrompt = context
      ? `You are an expert study assistant for a student. Your ONLY job is to help the student understand their uploaded study notes.

STRICT RULES — follow these without exception:
1. Answer EXCLUSIVELY based on the RELEVANT CONTENT below. Do NOT use any outside knowledge.
2. If the answer is not present in the content, say: "This topic isn't covered in your uploaded notes. Please check your syllabus or upload more relevant material."
3. Never make up facts, definitions, or examples that are not in the notes.
4. Stay within the syllabus — do not go beyond what the document covers.
5. Format your response using clean Markdown:
   - Use **bold** for key terms and important concepts
   - Use bullet lists (- item) for enumerating points
   - Use numbered lists (1. item) for sequences or steps
   - Use ## headings for major sections
   - Use \`inline code\` for technical terms, formulas, or code snippets
   - Use \`\`\`language ... \`\`\` fenced blocks for multi-line code
6. Be concise, educational, and structured. Avoid unnecessary filler text.

---
RELEVANT CONTENT FROM STUDENT'S NOTES:
${context}
---

Answer the student's question based only on the above content.`
      : `You are a study assistant. The student has not uploaded any notes yet, or no relevant content was found for this query.

Please let them know: "I couldn't find relevant content in your uploaded notes for this question. Try uploading your study material on the Upload Notes page, or rephrase your question."

Do NOT answer from general knowledge — stay within the student's syllabus.`;

    // Build the full messages array for Ollama.
    // ⚠️  Filter out any messages with empty content — Ollama throws
    //    "model output must contain either output text or tool calls"
    //    if it sees a message with content: "" in the history.
    const cleanMessages = messages.filter(m => m.content && m.content.trim().length > 0);

    const ollamaMessages = [
      { role: 'system', content: systemPrompt },
      ...cleanMessages,
    ];

    // Always stream for chat — gives real-time typing feel
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const OLLAMA_URL   = process.env.OLLAMA_URL   || 'http://localhost:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';

    // NOTE: Do NOT pass a custom `options` block here.
    // Pairing temperature/num_predict with a long system prompt causes llama3.1
    // to emit an empty first token, triggering Ollama's
    // "model output must contain either output text or tool calls" error.
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model:    OLLAMA_MODEL,
        messages: ollamaMessages,
        stream:   true,
      }),
    });

    if (!ollamaRes.ok) {
      res.write(`data: ${JSON.stringify({ error: `Ollama returned ${ollamaRes.status}` })}\n\n`);
      return res.end();
    }

    // Pipe Ollama's NDJSON stream → SSE
    const decoder = new TextDecoder();
    for await (const chunk of ollamaRes.body) {
      const lines = decoder.decode(chunk, { stream: true }).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          const token = json?.message?.content ?? '';
          if (token) {
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          }
          if (json.done) {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            return res.end();
          }
        } catch (_) { /* skip malformed lines */ }
      }
    }
    res.end();
  } catch (err) {
    console.error('ragRoutes POST /rag/chat:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

/* ═══════════════════════════════════════════════════════════════════
   CHAT HISTORY  —  save · load · clear
   All keyed by (userId, documentId)  →  one thread per document.
═══════════════════════════════════════════════════════════════════ */

/**
 * POST /api/rag/chat-history
 * Body: { userId, documentId, documentName?, messages: [{role,content,time}] }
 *
 * Upserts the full message array for this (userId, documentId) pair.
 * Called from the frontend after every completed AI turn.
 */
router.post('/rag/chat-history', async (req, res) => {
  try {
    const { userId, documentId, documentName = '', messages = [] } = req.body;
    if (!userId)     return res.status(400).json({ error: 'userId is required' });
    if (!documentId) return res.status(400).json({ error: 'documentId is required' });

    // Strip any blank messages before storing
    const clean = messages.filter(m => m.role && m.content && m.content.trim().length > 0);

    await ChatHistory.findOneAndUpdate(
      { userId, documentId },
      { $set: { documentName, messages: clean } },
      { upsert: true, new: true }
    );

    res.json({ success: true, saved: clean.length });
  } catch (err) {
    console.error('ragRoutes POST /rag/chat-history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rag/chat-history
 * Query: userId (required), documentId (required)
 *
 * Returns the stored messages array for this session.
 * Returns an empty array if no history exists yet.
 */
router.get('/rag/chat-history', async (req, res) => {
  try {
    const { userId, documentId } = req.query;
    if (!userId)     return res.status(400).json({ error: 'userId is required' });
    if (!documentId) return res.status(400).json({ error: 'documentId is required' });

    const record = await ChatHistory.findOne({ userId, documentId }).lean();
    res.json({
      success:  true,
      messages: record?.messages ?? [],
      updatedAt: record?.updatedAt ?? null,
    });
  } catch (err) {
    console.error('ragRoutes GET /rag/chat-history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/rag/chat-history
 * Query: userId (required), documentId (required)
 *
 * Wipes the stored message thread for this session.
 * Called when the user clicks "Clear" in the chat UI.
 */
router.delete('/rag/chat-history', async (req, res) => {
  try {
    const { userId, documentId } = req.query;
    if (!userId)     return res.status(400).json({ error: 'userId is required' });
    if (!documentId) return res.status(400).json({ error: 'documentId is required' });

    await ChatHistory.deleteOne({ userId, documentId });
    res.json({ success: true });
  } catch (err) {
    console.error('ragRoutes DELETE /rag/chat-history:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
