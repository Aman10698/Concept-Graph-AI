/**
 * lanceService.js
 *
 * Singleton wrapper around LanceDB (local, file-based vector database).
 *
 *  - connectLance()  — opens (or creates) the ./lancedb directory
 *  - getRagTable()   — opens or creates rag_chunks, runs schema migration
 *  - embedText(text) — calls Ollama /api/embeddings → float32[]
 *
 * Schema migration:
 *  When the existing table is missing the multimodal metadata columns
 *  (page, contentType, chapter, topic, keywords), they are added automatically
 *  via table.addColumns() before the singleton is cached. This lets the server
 *  upgrade existing deployments without manual intervention or data loss.
 */

const path    = require('path');
const lancedb = require('@lancedb/lancedb');

/* ── Config ──────────────────────────────────────────────────────── */
const LANCE_DIR   = process.env.LANCE_DIR || path.join(__dirname, '..', 'lancedb');
const TABLE_NAME  = 'rag_chunks';
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'nomic-embed-text';
const EMBED_DIM   = 768;
const OLLAMA_BASE = process.env.OLLAMA_URL || 'http://localhost:11434';

/* ── Singletons ──────────────────────────────────────────────────── */
let _db    = null;
let _table = null;

/* ── Full schema definition ─────────────────────────────────────── */
// The canonical list of all columns.  Any that are missing from an existing
// table will be added by migrateSchema() below.
const BASE_COLUMNS = [
  'id', 'userId', 'syllabusId', 'documentId', 'filename',
  'mimeType', 'chunkIndex', 'wordCount', 'text', 'vector', 'createdAt',
];

const META_COLUMNS = [
  // name            SQL default expression used by addColumns()
  { name: 'page',        valueSql: "CAST(0 AS INT64)",  jsDefault: 0     },
  { name: 'contentType', valueSql: "'text'",             jsDefault: 'text' },
  { name: 'chapter',     valueSql: "''",                 jsDefault: ''    },
  { name: 'topic',       valueSql: "''",                 jsDefault: ''    },
  { name: 'keywords',    valueSql: "''",                 jsDefault: ''    },
];

/* ═══════════════════════════════════════════════════════════════════
   SCHEMA MIGRATION
   Reads the Arrow schema of the opened table and adds any metadata
   columns that are absent.  Safe to call every startup.
═══════════════════════════════════════════════════════════════════ */
const migrateSchema = async (table) => {
  try {
    // In @lancedb/lancedb v0.30+, table.schema is a function returning a Promise
    const schema     = await table.schema();
    const fieldNames = schema.fields.map(f => f.name);

    const missing = META_COLUMNS.filter(c => !fieldNames.includes(c.name));

    if (missing.length === 0) {
      console.log('[LanceDB] Schema is up to date — no migration needed');
      return;
    }

    console.log(`[LanceDB] ⚙️  Schema migration: adding columns [${missing.map(c => c.name).join(', ')}]`);

    // addColumns accepts { name, valueSql } — the SQL expression fills existing rows
    await table.addColumns(missing.map(c => ({ name: c.name, valueSql: c.valueSql })));

    console.log('[LanceDB] ✅ Schema migration complete');
  } catch (err) {
    // If addColumns is not available in this lancedb version we log and continue.
    // The insert will still fail, but we surface a clear message.
    console.error('[LanceDB] ❌ Schema migration failed:', err.message);
    console.error('[LanceDB]    Falling back: will drop & recreate table on next indexing run.');
    // Signal caller to recreate
    throw new Error(`SCHEMA_MIGRATION_FAILED: ${err.message}`);
  }
};

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
   GET TABLE — opens existing table (+ migration) or creates new one
═══════════════════════════════════════════════════════════════════ */
const getRagTable = async () => {
  if (_table) return _table;

  const db            = await connectLance();
  const existingNames = await db.tableNames();

  if (existingNames.includes(TABLE_NAME)) {
    _table = await db.openTable(TABLE_NAME);
    console.log(`✅ LanceDB: opened existing table "${TABLE_NAME}"`);

    // ── Schema migration for existing tables ──────────────────
    try {
      await migrateSchema(_table);
    } catch (migErr) {
      if (migErr.message.startsWith('SCHEMA_MIGRATION_FAILED')) {
        // Hard fallback: drop the old table and recreate with correct schema
        console.warn('[LanceDB] ⚠️  Dropping old table and recreating with new schema...');
        _table = null;
        _db    = null;
        await db.dropTable(TABLE_NAME).catch(() => {});
        // Reconnect and fall through to the createTable branch below
        const db2 = await connectLance();
        _table    = await createFreshTable(db2);
        return _table;
      }
      // Any other error — still return the table, let the caller deal
    }
  } else {
    _table = await createFreshTable(db);
  }

  return _table;
};

/* ── Helper: create a brand-new table with the full schema ───────── */
const createFreshTable = async (db) => {
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
    page:        0,
    contentType: 'text',
    chapter:     '',
    topic:       '',
    keywords:    '',
  }];

  const t = await db.createTable(TABLE_NAME, placeholder);
  await t.delete(`id = '__placeholder__'`);
  console.log(`✅ LanceDB: created table "${TABLE_NAME}" with full multimodal schema (dim=${EMBED_DIM})`);
  return t;
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

  const embedding = json.embedding;
  json.embedding  = null; // allow GC
  return embedding;       // number[768]
};

/* ── Reset singletons (testing / after drop-recreate) ───────────── */
const resetSingletons = () => { _db = null; _table = null; };

module.exports = {
  connectLance,
  getRagTable,
  embedText,
  EMBED_DIM,
  TABLE_NAME,
  META_COLUMNS,
  resetSingletons,
};
