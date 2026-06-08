/**
 * lanceService.js
 *
 * Singleton wrapper around LanceDB (local, file-based vector database).
 *
 *  - connectLance()  — opens (or creates) the ./lancedb directory
 *  - getRagTable()   — opens (or creates) the `rag_chunks` table
 *  - embedText(text) — calls Ollama /api/embeddings → float32[]
 *
 * The LanceDB directory lives at:  backend/lancedb/
 * No external server needed — it's just files on disk.
 */

const path = require('path');
const lancedb = require('@lancedb/lancedb');

/* ── Config ────────────────────────────────────────────────────────── */
// LANCE_DIR can be set in .env to a path outside OneDrive to avoid Windows file-lock warnings.
// Default: backend/lancedb  (fine for dev machines without OneDrive sync issues)
const LANCE_DIR   = process.env.LANCE_DIR || path.join(__dirname, '..', 'lancedb');
const TABLE_NAME  = 'rag_chunks';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const EMBED_DIM   = 768; // nomic-embed-text output dimension
const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';

/* ── Singletons ────────────────────────────────────────────────────── */
let _db    = null;
let _table = null;

/* ═══════════════════════════════════════════════════════════════════
   CONNECT — open the LanceDB directory (creates it if absent)
═══════════════════════════════════════════════════════════════════ */
const connectLance = async () => {
  if (_db) return _db;
  _db = await lancedb.connect(LANCE_DIR);
  console.log(`✅ LanceDB connected: ${LANCE_DIR}`);
  return _db;
};

/* ═══════════════════════════════════════════════════════════════════
   GET TABLE — opens or bootstraps the rag_chunks table
═══════════════════════════════════════════════════════════════════ */
const getRagTable = async () => {
  if (_table) return _table;

  const db = await connectLance();
  const existingNames = await db.tableNames();

  if (existingNames.includes(TABLE_NAME)) {
    _table = await db.openTable(TABLE_NAME);
    console.log(`✅ LanceDB: opened existing table "${TABLE_NAME}"`);
  } else {
    // Bootstrap with a single placeholder row so LanceDB knows the schema.
    // We immediately delete it, but LanceDB needs at least one row to infer types.
    const placeholder = [{
      id:          '__placeholder__',
      userId:      '',
      syllabusId:  '',
      documentId:  '',
      filename:    '',
      mimeType:    '',
      chunkIndex:  0,
      wordCount:   0,
      text:        '',
      vector:      new Array(EMBED_DIM).fill(0),
      createdAt:   new Date().toISOString(),
    }];
    _table = await db.createTable(TABLE_NAME, placeholder);
    await _table.delete(`id = '__placeholder__'`);
    console.log(`✅ LanceDB: created new table "${TABLE_NAME}" (dim=${EMBED_DIM})`);
  }

  return _table;
};

/* ═══════════════════════════════════════════════════════════════════
   EMBED TEXT — call Ollama /api/embeddings → float32[]
═══════════════════════════════════════════════════════════════════ */
const embedText = async (text) => {
  const res = await fetch(`${OLLAMA_BASE}/api/embeddings`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ model: EMBED_MODEL, prompt: text }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`Ollama embeddings ${res.status}: ${msg.slice(0, 200)}`);
  }

  const json = await res.json();
  if (!Array.isArray(json.embedding) || json.embedding.length === 0) {
    throw new Error('Ollama returned empty embedding');
  }

  // ★ Extract the array first, then null out the parsed JSON object so V8
  //   can reclaim the entire response payload immediately (Ollama response
  //   bodies can include extra metadata fields that accumulate across calls).
  const embedding = json.embedding;
  json.embedding  = null; // allow GC to collect the rest of the parsed object
  return embedding;       // number[768]
};

/* ── Reset singleton (useful for testing) ─────────────────────────── */
const resetSingletons = () => { _db = null; _table = null; };

module.exports = { connectLance, getRagTable, embedText, EMBED_DIM, TABLE_NAME, resetSingletons };
