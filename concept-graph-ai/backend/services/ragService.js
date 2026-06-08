/**
 * ragService.js  (LanceDB edition — memory-hardened, batch-flushed)
 *
 * Handles the RAG (Retrieval-Augmented Generation) pipeline:
 *  1. storeDocument   — chunk text, embed each chunk via Ollama, stream into LanceDB
 *  2. retrieveContext — embed query, ANN vector search, return top-K context string
 *  3. deleteDocument  — remove all chunks for a documentId + userId from LanceDB
 *  4. listDocuments   — list unique documents indexed for a user/syllabus
 *
 * Storage backend: LanceDB (local file-based vector database at ./lancedb/)
 * Embedding model: nomic-embed-text  (pulled via Ollama, 768-dim vectors)
 *
 * Memory strategy:
 *  - Rows are flushed to LanceDB in small batches (FLUSH_EVERY) so the
 *    peak working set is always bounded to ~FLUSH_EVERY vectors, not the
 *    entire document's worth of embeddings.
 *  - The source `words` array is nulled out once chunking is complete.
 *  - retrieveContext selects ONLY text + chunkIndex — never loads the
 *    768-float vector column back into JS memory.
 *  - embedText nulls the parsed JSON object after extracting the array.
 */

const crypto = require('crypto');
const { getRagTable, embedText } = require('./lanceService');
const RagDocument = require('../models/RagDocument');

/* ── Chunking / memory parameters ────────────────────────────────── */
const CHUNK_WORDS   = 400;  // target words per chunk
const OVERLAP_WORDS = 60;   // words of overlap between adjacent chunks
const MAX_CTX_CHARS = 6000; // max chars returned as context to Ollama (was 2400 — too small)
// ★ Flush each chunk immediately after embedding — never hold more than
//   1 vector (768 floats × 4 B = 3 KB) in the JS heap at once.
const FLUSH_EVERY   = 10;

/* ═══════════════════════════════════════════════════════════════════
   CHUNK GENERATOR — yields one { index, text, wordCount } at a time.
   Never builds the full chunks[] array in memory — each chunk is
   yielded, processed (embedded + written to LanceDB), then discarded.
═══════════════════════════════════════════════════════════════════ */
function* makeChunks(fullText) {
  const words = fullText.trim().split(/\s+/);
  let start = 0;
  let idx   = 0;

  while (start < words.length) {
    const end   = Math.min(start + CHUNK_WORDS, words.length);
    const slice = words.slice(start, end);

    yield {
      index:     idx++,
      text:      slice.join(' '),
      wordCount: slice.length,
    };

    if (end === words.length) break;

    start = end - OVERLAP_WORDS;
  }
  // words goes out of scope here and becomes reclaimable by GC
}

/* ═══════════════════════════════════════════════════════════════════
   0. COMPUTE DOC ID — same algorithm used by storeDocument.
   Call this before embedding to get the stable ID immediately.
═══════════════════════════════════════════════════════════════════ */
const computeDocId = (userId, syllabusId, filename) => {
  const docKey = `${userId}::${syllabusId || ''}::${filename}`;

  return crypto
    .createHash('sha256')
    .update(docKey)
    .digest('hex');
};

/* ── Safe LanceDB filter values — escape single quotes ── */
const escapeLanceValue = (value) =>
  String(value).replace(/'/g, "\\'"  );

/* ═══════════════════════════════════════════════════════════════════
   0b. REGISTER DOCUMENT — saves metadata to MongoDB immediately.
   Returns the real documentId so the frontend can show it right away
   before LanceDB embedding (which can take minutes) completes.
═══════════════════════════════════════════════════════════════════ */
const registerDocument = async (userId, syllabusId, filename, mimeType) => {
  const documentId = computeDocId(userId, syllabusId, filename);
  await RagDocument.findOneAndUpdate(
    { userId, documentId },
    {
      $set: {
        documentId,
        userId,
        syllabusId: syllabusId || '',
        filename,
        mimeType: mimeType || 'application/octet-stream',
        indexed: false,
        status: 'processing',
        // Don't overwrite chunkCount/createdAt if doc already exists
      },
      $setOnInsert: { chunkCount: 0, createdAt: new Date() },
    },
    { upsert: true, new: true }
  );
  console.log(`📋 RAG: Registered doc "${filename}" (id: ${documentId}) for user="${userId}"`);
  return documentId;
};

/* ═══════════════════════════════════════════════════════════════════
   1. STORE DOCUMENT
   Streams one chunk at a time through embed → LanceDB write.
   Peak JS heap = 1 chunk text + 1 vector (768 floats) + LanceDB
   native overhead, regardless of document size.
═══════════════════════════════════════════════════════════════════ */
const storeDocument = async (userId, syllabusId, filename, mimeType, fullText) => {
  if (!fullText || fullText.trim().length < 20) {
    throw new Error('Extracted text is too short to index for RAG.');
  }

  /* ── 1a. Stable documentId (same file always replaces its old rows) ── */
  const docId = computeDocId(userId, syllabusId, filename);
  const createdAt = new Date().toISOString();

  /* ── 1b. Delete old rows for this doc before inserting new ones ── */
  const table = await getRagTable();
  try {
    await table.delete(`documentId = '${escapeLanceValue(docId)}'`);
  } catch (_) {
    // Fine if table was empty — LanceDB may throw on no-op deletes
  }

  /* ── 1c. Stream chunks → embed → batch → write to LanceDB ── */
  let totalStored = 0;
  const batch = [];

  try {
    for (const chunk of makeChunks(fullText)) {
      // ★ Embed this single chunk (only 1 vector in memory at a time)
      const vector = await embedText(chunk.text);

      // ★ Accumulate into the batch instead of writing one-by-one
      batch.push({
        id:         `${docId}::${chunk.index}`,
        userId,
        syllabusId: syllabusId || '',
        documentId: docId,
        filename,
        mimeType:   mimeType || 'application/octet-stream',
        chunkIndex: chunk.index,
        wordCount:  chunk.wordCount,
        text:       chunk.text,
        vector,
        createdAt,
      });

      totalStored++;

      if (batch.length >= FLUSH_EVERY) {
        await table.add(batch);
        // Free all vectors in the flushed batch
        for (const row of batch) row.vector.length = 0;
        batch.length = 0;
      }

      if (totalStored % 10 === 0) {
        console.log(`  📐 Processed ${totalStored} chunks so far…`);
      }
    }  // end for (const chunk of makeChunks)

    // ★ Flush any remaining rows
    if (batch.length) {
      await table.add(batch);
      for (const row of batch) row.vector.length = 0;
      batch.length = 0;
    }

    console.log(`✅ LanceDB RAG: stored ${totalStored} chunks for "${filename}" (docId: ${docId})`);

    // ── Update MongoDB to reflect final chunk count + mark as indexed ──
    await RagDocument.findOneAndUpdate(
      { userId, documentId: docId },
      {
        $set: {
          chunkCount: totalStored,
          indexed:    true,
          status:     'indexed',
        },
      },
      { upsert: true }
    );

    return { documentId: docId, chunkCount: totalStored, updated: false };

  } catch (err) {
    await RagDocument.findOneAndUpdate(
      { userId, documentId: docId },
      {
        $set: {
          indexed: false,
          status:  'failed',
        },
      }
    );

    throw err;
  }
};

/* ═══════════════════════════════════════════════════════════════════
   2. RETRIEVE CONTEXT
   Embeds the query, runs ANN vector search in LanceDB,
   returns a formatted string ready for Ollama prompt injection.
   ★ Only fetches text + chunkIndex — never loads the 768-float
     vector column back into JS heap.
═══════════════════════════════════════════════════════════════════ */
const retrieveContext = async (userId, syllabusId, query, topK = 3, ragDocumentId = null) => {
  try {
    if (!query || !query.trim()) return '';

    const table = await getRagTable();

    /* ── 2a. Embed the query ── */
    const queryVector = await embedText(query);

    /* ── 2b. Build where-filter ── */
    let whereClause = `userId = '${userId}'`;
    if (ragDocumentId) {
      whereClause += ` AND documentId = '${escapeLanceValue(ragDocumentId)}'`;
    } else if (syllabusId) {
      whereClause += ` AND syllabusId = '${syllabusId}'`;
    }

    /* ── 2c. ANN vector search — select ONLY the columns we need ── */
    // ★ .select() prevents LanceDB from deserializing the 768-float vector
    //   column into JS objects — avoids the main source of heap bloat here.
    try {
      const results = await table
        .vectorSearch(queryVector)
        .where(whereClause)
        .select(['text', 'chunkIndex'])
        .limit(topK)
        .toArray();

      if (!results?.length) {
        return '';
      }

      /* ── 2d. Sort by original position for coherent reading order ── */
      results.sort((a, b) => (a.chunkIndex ?? 0) - (b.chunkIndex ?? 0));

      const context = results
        .map(r => r.text)
        .join('\n\n---\n\n');

      return context.slice(0, MAX_CTX_CHARS);

    } finally {
      // ★ Always free the query vector — even if the search throws
      queryVector.length = 0;
    }

  } catch (err) {
    console.error('ragService.retrieveContext error:', err.message);
    return '';
  }
};

/* ═══════════════════════════════════════════════════════════════════
   3. LIST DOCUMENTS
   Returns one entry per unique documentId for a user (aggregated).
   ★ Selects only metadata columns — no vector, no text bodies.
═══════════════════════════════════════════════════════════════════ */
const listDocuments = async (userId, syllabusId) => {
  try {
    // Read from MongoDB — always up-to-date, even for docs still being indexed
    const query = { userId };
    if (syllabusId) query.syllabusId = syllabusId;

    const docs = await RagDocument.find(query)
      .sort({ createdAt: -1 })
      .lean();

    return docs.map(d => ({
      _id:        d.documentId,
      filename:   d.filename,
      mimeType:   d.mimeType,
      syllabusId: d.syllabusId,
      chunkCount: d.chunkCount,
      indexed:    d.indexed,
      createdAt:  d.createdAt,
    }));
  } catch (err) {
    console.error('ragService.listDocuments error:', err.message);
    return [];
  }
};

/* ═══════════════════════════════════════════════════════════════════
   4. DELETE DOCUMENT
   Removes all chunks for a documentId that belongs to userId.
═══════════════════════════════════════════════════════════════════ */
const deleteDocument = async (userId, documentId) => {
  try {
    // Delete from MongoDB first
    await RagDocument.deleteOne({ userId, documentId });

    // Then delete embeddings from LanceDB
    const table = await getRagTable();
    // Verify ownership with a tiny projection — no need to load text or vectors
    const check = await table
      .query()
      .where(`documentId = '${escapeLanceValue(documentId)}' AND userId = '${escapeLanceValue(userId)}'`)
      .select(['documentId'])
      .limit(1)
      .toArray();

    if (check && check.length > 0) {
      await table.delete(`documentId = '${escapeLanceValue(documentId)}' AND userId = '${escapeLanceValue(userId)}'`);
    }
    console.log(`🗑️  RAG: deleted document "${documentId}" for user "${userId}"`);
    return true;
  } catch (err) {
    console.error('ragService.deleteDocument error:', err.message);
    return false;
  }
};

module.exports = {
  computeDocId,
  registerDocument,
  storeDocument,
  retrieveContext,
  listDocuments,
  deleteDocument,
};
