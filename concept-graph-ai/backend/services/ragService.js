/**
 * ragService.js  — Production Edition
 *
 * Complete educational RAG pipeline:
 *
 *  Phase 1  — PDF extraction      (pdfExtractorService — fixed text concatenation)
 *  Phase 2  — Text cleaning       (textCleanerService  — dedup, normalize)
 *  Phase 3  — Full doc storage    (MongoDB RagRawDocument)
 *  Phase 4  — Structured indexing (MongoDB RagStructuredElement — activities, questions, etc.)
 *  Phase 5  — Semantic chunking   (semanticChunker — structure-aware, not word-count)
 *  Phase 6  — Embedding           (LanceDB via lanceService)
 *  Phase 7  — Hybrid retrieval    (vector + BM25 + metadata via hybridSearchService)
 *  Phase 8  — Query routing       (ragRoutes.js — extraction vs knowledge)
 *  Phase 9  — Debug logging       (every step logged)
 */

const crypto = require('crypto');

const { getRagTable, embedText }   = require('./lanceService');
const { makeSemanticChunks }       = require('./semanticChunker');
const { cleanPages }               = require('./textCleanerService');
const {
  extractActivities,
  extractDefinitions,
  extractFormulas,
  extractQuestions,
  extractExercises,
} = require('./documentAnalysisService');

const RagDocument          = require('../models/RagDocument');
const RagRawDocument       = require('../models/RagRawDocument');
const RagStructuredElement = require('../models/RagStructuredElement');

const MAX_CTX_CHARS = 30000;
const FLUSH_EVERY   = 10;

/* ═══════════════════════════════════════════════════════════════════
   DOCUMENT ID  — stable SHA-256 of userId::syllabusId::filename
═══════════════════════════════════════════════════════════════════ */
const computeDocId = (userId, syllabusId, filename) => {
  const key = `${userId}::${syllabusId || ''}::${filename}`;
  return crypto.createHash('sha256').update(key).digest('hex');
};

/* ── LanceDB filter escaper ────────────────────────────────────── */
const esc = (v) => String(v).replace(/'/g, "\\'");

/* ═══════════════════════════════════════════════════════════════════
   REGISTER DOCUMENT
   Saves metadata immediately so the document shows in "My Notes"
   before the slow embedding completes.
═══════════════════════════════════════════════════════════════════ */
const registerDocument = async (userId, syllabusId, filename, mimeType) => {
  const documentId = computeDocId(userId, syllabusId, filename);
  await RagDocument.findOneAndUpdate(
    { userId, documentId },
    {
      $set: {
        documentId,
        userId,
        syllabusId:  syllabusId || '',
        filename,
        mimeType:    mimeType || 'application/octet-stream',
        indexed:     false,
        status:      'processing',
      },
      $setOnInsert: { chunkCount: 0, createdAt: new Date() },
    },
    { upsert: true }
  );
  console.log(`📋 RAG: Registered "${filename}" (id: ${documentId.slice(0,16)}...)`);
  return documentId;
};

/* ═══════════════════════════════════════════════════════════════════
   SAVE RAW DOCUMENT  (Phase 3)
   Stores the CLEANED full text in MongoDB before chunking.
   This is the source of truth for Document Analysis mode.
═══════════════════════════════════════════════════════════════════ */
const saveRawDocument = async (userId, syllabusId, filename, mimeType, cleanedPages) => {
  try {
    const documentId = computeDocId(userId, syllabusId, filename);

    let pagesArr = [];
    let fullText = '';

    if (Array.isArray(cleanedPages)) {
      pagesArr = cleanedPages.map(p => ({ page: p.page || 0, text: p.text || '' }));
      fullText = pagesArr.map(p => p.text).join('\n\n');
    } else {
      fullText = String(cleanedPages || '');
      pagesArr = [{ page: 1, text: fullText }];
    }

    await RagRawDocument.findOneAndUpdate(
      { userId, documentId },
      {
        $set: {
          documentId,
          userId,
          filename,
          mimeType:  mimeType || 'application/octet-stream',
          pageCount: pagesArr.length,
          fullText,
          pages:     pagesArr,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    console.log(`📄 [RAG] Raw doc saved: "${filename}" (${pagesArr.length} pages, ${fullText.length.toLocaleString()} chars)`);
    return documentId;
  } catch (err) {
    console.error('[RAG] saveRawDocument error (non-fatal):', err.message);
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════════
   INDEX STRUCTURED ELEMENTS  (Phase 4)
   Pre-extracts activities, questions, definitions, formulas at
   INDEX TIME so extraction queries hit the DB directly.
═══════════════════════════════════════════════════════════════════ */
const indexStructuredElements = async (userId, documentId, fullText, pages) => {
  try {
    // Remove all old elements for this document first
    await RagStructuredElement.deleteMany({ userId, documentId });

    const elements = [];

    // ── Activities ─────────────────────────────────────────────
    const activities = extractActivities(fullText, pages);
    for (const a of activities) {
      elements.push({
        documentId, userId,
        type:       'activity',
        identifier: a.id || a.label,
        label:      a.label,
        page:       a.page || 0,
        content:    a.content,
      });
    }

    // ── Questions ──────────────────────────────────────────────
    const questions = extractQuestions(fullText, pages);
    for (const q of questions) {
      elements.push({
        documentId, userId,
        type:       'question',
        identifier: String(q.number || ''),
        label:      `Q${q.number}`,
        page:       q.page || 0,
        content:    q.question,
      });
    }

    // ── Definitions ────────────────────────────────────────────
    const definitions = extractDefinitions(fullText, pages);
    for (const d of definitions) {
      elements.push({
        documentId, userId,
        type:       'definition',
        identifier: d.term,
        label:      d.term,
        page:       d.page || 0,
        content:    `${d.term}: ${d.definition}`,
      });
    }

    // ── Formulas ───────────────────────────────────────────────
    const formulas = extractFormulas(fullText, pages);
    for (let i = 0; i < formulas.length; i++) {
      const f = formulas[i];
      elements.push({
        documentId, userId,
        type:       'formula',
        identifier: String(i + 1),
        label:      `Formula ${i + 1}`,
        page:       f.page || 0,
        content:    f.formula,
      });
    }

    // ── Exercises ──────────────────────────────────────────────
    const exercises = extractExercises(fullText, pages);
    for (const ex of exercises) {
      elements.push({
        documentId, userId,
        type:       'exercise',
        identifier: ex.label,
        label:      ex.label,
        page:       ex.page || 0,
        content:    ex.content,
      });
    }

    if (elements.length > 0) {
      await RagStructuredElement.insertMany(elements, { ordered: false });
    }

    console.log(`📊 [RAG] Structured index: ${elements.length} elements`);
    console.log(`   Activities  : ${activities.length}`);
    console.log(`   Questions   : ${questions.length}`);
    console.log(`   Definitions : ${definitions.length}`);
    console.log(`   Formulas    : ${formulas.length}`);
    console.log(`   Exercises   : ${exercises.length}`);

    return {
      activityCount:   activities.length,
      questionCount:   questions.length,
      definitionCount: definitions.length,
      formulaCount:    formulas.length,
      exerciseCount:   exercises.length,
      total:           elements.length,
    };
  } catch (err) {
    console.error('[RAG] indexStructuredElements error (non-fatal):', err.message);
    return { total: 0 };
  }
};

/* ═══════════════════════════════════════════════════════════════════
   STORE DOCUMENT  (orchestrates all phases)

   Input: either
     (a) pages[] from pdfExtractorService (multimodal, page-aware)
     (b) plain text string (legacy path)

   Pipeline:
     1. Clean text       (textCleanerService)
     2. Save to MongoDB  (RagRawDocument)
     3. Index elements   (RagStructuredElement)
     4. Semantic chunk   (semanticChunker)
     5. Embed + store    (LanceDB)
═══════════════════════════════════════════════════════════════════ */
const storeDocument = async (userId, syllabusId, filename, mimeType, textOrPages) => {
  if (!textOrPages) throw new Error('No content provided for indexing.');

  const docId     = computeDocId(userId, syllabusId, filename);
  const createdAt = new Date().toISOString();
  const isPages   = Array.isArray(textOrPages);

  // ── Phase 1: Validate ────────────────────────────────────────
  if (isPages) {
    const total = textOrPages.reduce((s, p) => s + (p.text || '').length, 0);
    if (total < 20) throw new Error('Extracted text is too short to index.');
    console.log(`\n[RAG] Multimodal mode: ${textOrPages.length} raw pages`);
  } else {
    if (String(textOrPages).trim().length < 20) throw new Error('Text too short to index.');
    console.log('\n[RAG] Text-only mode');
  }

  // ── Phase 2: Clean text ──────────────────────────────────────
  let cleanedPages;
  if (isPages) {
    cleanedPages = cleanPages(textOrPages);
  } else {
    const rawText = String(textOrPages);
    cleanedPages  = cleanPages([{ page: 1, text: rawText }]);
  }

  // ── Phase 3: Save full cleaned text to MongoDB ───────────────
  await saveRawDocument(userId, syllabusId, filename, mimeType, cleanedPages);

  // ── Phase 4: Index structured elements ───────────────────────
  const fullText = cleanedPages.map(p => p.text).join('\n\n');
  await indexStructuredElements(userId, docId, fullText, cleanedPages);

  // ── Phase 5: Semantic chunking ───────────────────────────────
  const chunkIter = makeSemanticChunks(cleanedPages);

  // ── Phase 6: Embed + store in LanceDB ───────────────────────
  const table = await getRagTable();

  // Delete old rows for this document
  try {
    await table.delete(`documentId = '${esc(docId)}'`);
  } catch (_) { /* empty table — fine */ }

  let   totalStored = 0;
  const pagesStored = new Set();
  const typeCount   = { text: 0, table: 0, image: 0, merged: 0 };
  const batch       = [];

  try {
    for (const chunk of chunkIter) {
      if (chunk.page != null) pagesStored.add(chunk.page);
      typeCount[chunk.contentType] = (typeCount[chunk.contentType] || 0) + 1;

      const vector = await embedText(chunk.text);

      batch.push({
        id:          `${docId}::${chunk.index}`,
        userId,
        syllabusId:  syllabusId || '',
        documentId:  docId,
        filename,
        mimeType:    mimeType || 'application/octet-stream',
        chunkIndex:  chunk.index,
        wordCount:   chunk.wordCount,
        text:        chunk.text,
        vector,
        createdAt,
        page:        chunk.page        ?? 0,
        contentType: chunk.contentType || 'text',
        chapter:     chunk.chapter     || '',
        topic:       chunk.topic       || '',
        keywords:    chunk.keywords    || '',
      });

      totalStored++;

      if (batch.length >= FLUSH_EVERY) {
        await table.add(batch);
        batch.forEach(r => { r.vector.length = 0; });
        batch.length = 0;
      }

      if (totalStored % 20 === 0) console.log(`  📐 Indexed ${totalStored} chunks…`);
    }

    if (batch.length) {
      await table.add(batch);
      batch.forEach(r => { r.vector.length = 0; });
      batch.length = 0;
    }

    // ── Summary log ─────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════');
    console.log(` [RAG] Indexed: "${filename}"`);
    console.log(` Chunks stored    : ${totalStored}`);
    console.log(` Pages indexed    : ${[...pagesStored].filter(p => p > 0).length}`);
    console.log(` Text chunks      : ${typeCount.text   || 0}`);
    console.log(` Table chunks     : ${typeCount.table  || 0}`);
    console.log(` Merged chunks    : ${typeCount.merged || 0}`);
    console.log('═══════════════════════════════════════════════════════');

    await RagDocument.findOneAndUpdate(
      { userId, documentId: docId },
      { $set: { chunkCount: totalStored, indexed: true, status: 'indexed' } },
      { upsert: true }
    );

    return { documentId: docId, chunkCount: totalStored };

  } catch (err) {
    await RagDocument.findOneAndUpdate(
      { userId, documentId: docId },
      { $set: { indexed: false, status: 'failed' } }
    ).catch(() => {});
    throw err;
  }
};

/* ═══════════════════════════════════════════════════════════════════
   RETRIEVE CONTEXT  — Hybrid Search for knowledge questions
═══════════════════════════════════════════════════════════════════ */
const retrieveContext = async (userId, syllabusId, query, topK = 15, ragDocumentId = null) => {
  try {
    if (!query?.trim()) return '';

    const table       = await getRagTable();
    const queryVector = await embedText(query);

    let whereClause = `userId = '${esc(userId)}'`;
    if (ragDocumentId)  whereClause += ` AND documentId = '${esc(ragDocumentId)}'`;
    else if (syllabusId) whereClause += ` AND syllabusId = '${esc(syllabusId)}'`;

    try {
      const { hybridSearch, formatContextWithCitations } = require('./hybridSearchService');

      const chunks = await hybridSearch({
        table, queryVector, query, whereClause,
        topK,
        vectorK: Math.min(topK * 3, 60),
      });

      if (!chunks.length) return '';

      chunks.sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
      const context = formatContextWithCitations(chunks, MAX_CTX_CHARS);
      const pages   = [...new Set(chunks.map(c => c.page).filter(Boolean))].sort((a, b) => a - b);
      console.log(`[RAG] Context: ${chunks.length} chunks, pages [${pages.join(',')}], ${context.length} chars`);

      return context;
    } finally {
      queryVector.length = 0;
    }
  } catch (err) {
    console.error('ragService.retrieveContext error:', err.message);
    return '';
  }
};

/* ═══════════════════════════════════════════════════════════════════
   RETRIEVE STRUCTURED ELEMENTS  (for extraction queries)
   Queries RagStructuredElement directly — no regex, no LLM.
═══════════════════════════════════════════════════════════════════ */
const retrieveStructuredElements = async (userId, documentId, type) => {
  try {
    const query = { userId, documentId };
    if (type && type !== 'all') query.type = type;

    const elements = await RagStructuredElement
      .find(query)
      .sort({ page: 1, identifier: 1 })
      .lean();

    return elements;
  } catch (err) {
    console.error('retrieveStructuredElements error:', err.message);
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════════
   RETRIEVE FULL DOCUMENT  (for extraction context)
═══════════════════════════════════════════════════════════════════ */
const retrieveFullDocument = async (userId, documentId) => {
  try {
    const rawDoc = await RagRawDocument.findOne({ userId, documentId }).lean();
    if (rawDoc?.fullText?.length > 20) {
      return {
        fullText:  rawDoc.fullText.slice(0, MAX_CTX_CHARS),
        pages:     rawDoc.pages || [],
        pageCount: rawDoc.pageCount || 0,
        source:    'mongodb',
      };
    }

    // Fallback: LanceDB chunk concatenation
    console.warn(`[RAG] No raw doc for "${documentId}" — LanceDB fallback`);
    const table = await getRagTable();
    const rows  = await table
      .query()
      .where(`userId = '${esc(userId)}' AND documentId = '${esc(documentId)}'`)
      .select(['text', 'chunkIndex', 'page'])
      .toArray();

    if (!rows.length) return { fullText: '', pages: [], pageCount: 0, source: 'none' };

    rows.sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));
    return {
      fullText:  rows.map(r => r.text).join('\n\n').slice(0, MAX_CTX_CHARS),
      pages:     [],
      pageCount: 0,
      source:    'lancedb',
    };
  } catch (err) {
    console.error('retrieveFullDocument error:', err.message);
    return { fullText: '', pages: [], pageCount: 0, source: 'error' };
  }
};

/* ═══════════════════════════════════════════════════════════════════
   GET RAW DOCUMENT  — debug endpoint
═══════════════════════════════════════════════════════════════════ */
const getRawDocument = async (userId, documentId) => {
  try {
    return await RagRawDocument.findOne({ userId, documentId }).lean();
  } catch (err) {
    console.error('getRawDocument error:', err.message);
    return null;
  }
};

/* ═══════════════════════════════════════════════════════════════════
   LIST DOCUMENTS
═══════════════════════════════════════════════════════════════════ */
const listDocuments = async (userId, syllabusId) => {
  try {
    const query = { userId };
    if (syllabusId) query.syllabusId = syllabusId;

    const docs = await RagDocument.find(query).sort({ createdAt: -1 }).lean();
    return docs.map(d => ({
      _id:        d.documentId,
      filename:   d.filename,
      mimeType:   d.mimeType,
      syllabusId: d.syllabusId,
      chunkCount: d.chunkCount,
      indexed:    d.indexed,
      status:     d.status,
      createdAt:  d.createdAt,
    }));
  } catch (err) {
    console.error('ragService.listDocuments error:', err.message);
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════════
   DELETE DOCUMENT
   Removes from: LanceDB, RagDocument, RagRawDocument, RagStructuredElement
═══════════════════════════════════════════════════════════════════ */
const deleteDocument = async (userId, documentId) => {
  try {
    await Promise.all([
      RagDocument.deleteOne({ userId, documentId }),
      RagRawDocument.deleteOne({ userId, documentId }),
      RagStructuredElement.deleteMany({ userId, documentId }),
    ]);

    const table  = await getRagTable();
    const filter = `documentId = '${esc(documentId)}' AND userId = '${esc(userId)}'`;
    const check  = await table.query().where(filter).select(['documentId']).limit(1).toArray();
    if (check?.length > 0) await table.delete(filter);

    console.log(`🗑️  RAG: deleted "${documentId}"`);
    return true;
  } catch (err) {
    console.error('ragService.deleteDocument error:', err.message);
    return false;
  }
};

module.exports = {
  computeDocId,
  registerDocument,
  saveRawDocument,
  storeDocument,
  retrieveContext,
  retrieveFullDocument,
  retrieveStructuredElements,
  getRawDocument,
  listDocuments,
  deleteDocument,
};
