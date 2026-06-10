/**
 * hybridSearchService.js
 *
 * Phase 4 — Hybrid Retrieval Engine
 *
 * Combines three retrieval signals:
 *   1. Vector Search  — LanceDB ANN (semantic similarity)
 *   2. BM25           — keyword frequency scoring on vector candidates
 *   3. Metadata Match — exact page / table / activity / figure references
 *
 * Merges all signals via Reciprocal Rank Fusion (RRF) and returns
 * the top-K reranked chunks with page citations.
 */

/* ═══════════════════════════════════════════════════════════════════
   BM25 — Lightweight implementation
   Runs in-memory on the vector candidates (no pre-built index needed).
═══════════════════════════════════════════════════════════════════ */

const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could','should',
  'may','might','must','can','this','that','these','those','it','its',
  'of','in','on','at','to','for','with','by','from','and','or','but',
  'not','no','so','if','as','up','out','into','than','then','when',
  'which','who','what','how','where','why','each','some','any',
]);

const tokenize = (text) =>
  (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

class BM25 {
  /**
   * @param {Array<{text: string}>} docs
   * @param {number} k1 - term frequency saturation (1.2–2.0)
   * @param {number} b  - length normalisation (0–1)
   */
  constructor(docs, k1 = 1.5, b = 0.75) {
    this.k1   = k1;
    this.b    = b;
    this.docs = docs;
    this.tf   = [];
    this.df   = {};
    this.docLengths = [];

    let totalLen = 0;

    for (const doc of docs) {
      const tokens = tokenize(doc.text || '');
      const freq   = {};
      for (const t of tokens) {
        freq[t] = (freq[t] || 0) + 1;
      }
      // Document-frequency count
      for (const t of Object.keys(freq)) {
        this.df[t] = (this.df[t] || 0) + 1;
      }
      this.tf.push(freq);
      this.docLengths.push(tokens.length);
      totalLen += tokens.length;
    }

    this.avgLen = totalLen / (docs.length || 1);
    this.N      = docs.length;
  }

  /** Robertson–Sparck Jones IDF */
  _idf(term) {
    const n = this.df[term] || 0;
    return Math.log((this.N - n + 0.5) / (n + 0.5) + 1);
  }

  _score(docIdx, queryTerms) {
    let total = 0;
    const tf  = this.tf[docIdx];
    const dl  = this.docLengths[docIdx];

    for (const term of queryTerms) {
      const f = tf[term] || 0;
      if (!f) continue;
      const idf   = this._idf(term);
      const num   = f * (this.k1 + 1);
      const denom = f + this.k1 * (1 - this.b + this.b * dl / this.avgLen);
      total += idf * (num / denom);
    }
    return total;
  }

  /**
   * Score all docs against query, return sorted array.
   * @param {string} query
   * @param {number} topK
   */
  search(query, topK = 20) {
    const terms = tokenize(query);
    if (!terms.length) return this.docs.slice(0, topK);

    return this.docs
      .map((doc, i) => ({ ...doc, _bm25: this._score(i, terms) }))
      .sort((a, b) => b._bm25 - a._bm25)
      .slice(0, topK);
  }
}

/* ═══════════════════════════════════════════════════════════════════
   RECIPROCAL RANK FUSION
   Merges multiple ranked lists without needing normalised scores.
   RRF(d) = Σ  1 / (k + rank_i(d))
═══════════════════════════════════════════════════════════════════ */
const reciprocalRankFusion = (lists, k = 60) => {
  const scores = new Map(); // id → { doc, rrfScore }

  for (const list of lists) {
    list.forEach((doc, rank) => {
      const id = doc.id || `${doc.chunkIndex}`;
      if (!scores.has(id)) scores.set(id, { doc, rrfScore: 0 });
      scores.get(id).rrfScore += 1 / (k + rank + 1);
    });
  }

  return [...scores.values()]
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .map(({ doc }) => doc);
};

/* ═══════════════════════════════════════════════════════════════════
   QUERY METADATA PARSER
   Detects exact references like "page 12", "Table 2.1", "Activity 3.4"
   so we can boost those chunks to the top.
═══════════════════════════════════════════════════════════════════ */
const parseQueryMetadata = (query) => {
  const q = (query || '').toLowerCase();

  const pageMatch     = q.match(/\bpage\s*(\d+)\b/i);
  const tableMatch    = q.match(/\btable\s*[\d.]+/i);
  const activityMatch = q.match(/\bactivity\s*[\d.]+/i);
  const figureMatch   = q.match(/\b(?:figure|fig)\s*[\d.]+/i);
  const diagramMatch  = q.match(/\bdiagram\b/i);
  const formulaMatch  = q.match(/\bformula\b/i);

  return {
    page:          pageMatch     ? parseInt(pageMatch[1], 10) : null,
    exactRef:      tableMatch?.[0] || activityMatch?.[0] || figureMatch?.[0] || null,
    wantsDiagram:  !!diagramMatch,
    wantsFormula:  !!formulaMatch,
    wantsTable:    !!tableMatch,
    wantsActivity: !!activityMatch,
  };
};

/* ═══════════════════════════════════════════════════════════════════
   HYBRID SEARCH  (main export)

   @param {object} params
     .table           LanceDB table object
     .queryVector     float32[768] query embedding
     .query           raw query string
     .whereClause     LanceDB filter string
     .topK            number of final results (default 15)
     .vectorK         vector candidates to fetch before reranking (default 40)

   @returns {Array<chunk>}  Reranked, deduplicated chunks with page metadata
═══════════════════════════════════════════════════════════════════ */
const hybridSearch = async ({
  table,
  queryVector,
  query,
  whereClause,
  topK   = 15,
  vectorK = 40,
}) => {
  const meta = parseQueryMetadata(query);

  // ── 1. Vector search for semantic candidates ──────────────────
  let vectorHits = [];
  try {
    // Always try to select the new metadata columns; handle missing gracefully
    const selectCols = ['text', 'chunkIndex', 'id', 'page', 'contentType', 'chapter', 'keywords'];

    const raw = await table
      .vectorSearch(queryVector)
      .where(whereClause)
      .select(selectCols)
      .limit(vectorK)
      .toArray();

    vectorHits = raw || [];
  } catch (errWithMeta) {
    // Fallback: the table schema predates metadata columns — select only base cols
    try {
      const raw = await table
        .vectorSearch(queryVector)
        .where(whereClause)
        .select(['text', 'chunkIndex', 'id'])
        .limit(vectorK)
        .toArray();
      vectorHits = raw || [];
    } catch (err) {
      console.warn('[HybridSearch] Vector search failed:', err.message);
    }
  }

  console.log(`[HybridSearch] Vector hits     : ${vectorHits.length}`);
  if (!vectorHits.length) return [];

  // ── 2. BM25 scoring on vector candidates ─────────────────────
  const bm25    = new BM25(vectorHits);
  const bm25Hits = bm25.search(query, vectorK);

  console.log(`[HybridSearch] BM25 top score  : ${(bm25Hits[0]?._bm25 ?? 0).toFixed(3)}`);

  // ── 3. Metadata / exact-reference boost ──────────────────────
  let metaBoost = [];

  if (meta.page !== null) {
    // Exact page match
    metaBoost = vectorHits.filter(r => r.page === meta.page);
    console.log(`[HybridSearch] Page ${meta.page} boost  : ${metaBoost.length} chunks`);
  } else if (meta.exactRef) {
    // Text contains e.g. "Activity 3.4"
    const ref = meta.exactRef.toLowerCase();
    metaBoost = vectorHits.filter(r => (r.text || '').toLowerCase().includes(ref));
    console.log(`[HybridSearch] Ref "${meta.exactRef}" boost: ${metaBoost.length} chunks`);
  } else if (meta.wantsDiagram) {
    // Prefer image/merged content type chunks
    metaBoost = vectorHits.filter(r => r.contentType === 'image' || r.contentType === 'merged');
    console.log(`[HybridSearch] Diagram boost   : ${metaBoost.length} chunks`);
  } else if (meta.wantsTable) {
    metaBoost = vectorHits.filter(r => r.contentType === 'table' || r.contentType === 'merged');
    console.log(`[HybridSearch] Table boost     : ${metaBoost.length} chunks`);
  }

  // ── 4. RRF fusion ─────────────────────────────────────────────
  const lists = [vectorHits, bm25Hits];
  let fused   = reciprocalRankFusion(lists);

  // ── 5. Prepend metadata-boosted chunks (highest priority) ─────
  if (metaBoost.length) {
    const boostIds = new Set(metaBoost.map(r => r.id || `${r.chunkIndex}`));
    fused = [
      ...metaBoost,
      ...fused.filter(r => !boostIds.has(r.id || `${r.chunkIndex}`)),
    ];
  }

  const final = fused.slice(0, topK);
  console.log(`[HybridSearch] Final chunks    : ${final.length}`);

  return final;
};

/* ── Format context string with page citations ───────────────────── */
/**
 * Turns an array of chunks into a context string that cites page numbers.
 *
 * @param {Array<{text, page, contentType}>} chunks
 * @param {number} maxChars
 * @returns {string}
 */
const formatContextWithCitations = (chunks, maxChars = 30000) => {
  if (!chunks.length) return '';

  let context     = '';
  let charsUsed   = 0;

  for (const chunk of chunks) {
    const pageLabel     = chunk.page     ? `[Page ${chunk.page}]` : '';
    const typeLabel     = chunk.contentType && chunk.contentType !== 'text'
                          ? ` [${chunk.contentType.toUpperCase()}]`
                          : '';
    const header        = (pageLabel || typeLabel) ? `${pageLabel}${typeLabel}\n` : '';
    const block         = `${header}${chunk.text}\n\n---\n\n`;

    if (charsUsed + block.length > maxChars) break;
    context   += block;
    charsUsed += block.length;
  }

  return context.trim();
};

module.exports = {
  hybridSearch,
  formatContextWithCitations,
  parseQueryMetadata,
  BM25,
  tokenize,
};
