/**
 * documentAnalysisService.js
 *
 * Deterministic Document Analysis Engine — NO LLM, NO VECTORS.
 *
 * Provides reliable, regex-based extraction for:
 *   - Activities   (NCERT-style: Activity 3.1, Activity 3.2, ...)
 *   - Definitions  (is called, is known as, is defined as, means)
 *   - Formulas     (chemical equations, math expressions)
 *   - Questions    (numbered questions and exercise items)
 *   - Exercises    (exercise blocks)
 *   - Summary      (chapter structure overview)
 *
 * This service is called when the query router detects an EXTRACTION
 * query (e.g. "list all activities", "all definitions", etc.).
 *
 * These queries should NOT use RAG / vector search because:
 *   1. Vector search returns semantically similar chunks, not ALL items
 *   2. Chunk boundaries can split a single activity across two chunks
 *   3. The LLM cannot reliably enumerate items it hasn't seen in context
 *
 * This service reads from MongoDB RagRawDocument.fullText — the complete
 * document text stored at upload time.
 */

/* ═══════════════════════════════════════════════════════════════════
   ACTIVITY EXTRACTION
   Supports NCERT-style patterns:
     Activity 3.1, Activity 3.12, ACTIVITY 3.1
     Activity I, Activity II (Roman numerals)
     Activity A, Activity B (letter variants)
═══════════════════════════════════════════════════════════════════ */

/**
 * Split the full text into named activity blocks.
 * @param {string} text
 * @param {Array<{page,text}>} pages
 * @returns {Array<{label, content, page}>}
 */
const extractActivities = (text, pages = []) => {
  if (!text) return [];

  // Build a page-lookup: for each character offset, which page is it on?
  // We'll use a simple approach: find each activity in fullText, then find
  // which page's text contains the same content.
  const buildPageIndex = () => {
    const index = [];
    let offset = 0;
    for (const p of pages) {
      index.push({ page: p.page, start: offset, end: offset + p.text.length });
      offset += p.text.length + 2; // +2 for '\n\n' join
    }
    return index;
  };

  const pageIndex = pages.length ? buildPageIndex() : [];

  const guessPage = (charOffset) => {
    for (const entry of pageIndex) {
      if (charOffset >= entry.start && charOffset <= entry.end) return entry.page;
    }
    return null;
  };

  // Activity header patterns (case-insensitive)
  // Matches: Activity 3.1, Activity 3.12, ACTIVITY 1, Activity I, Activity A
  const ACTIVITY_HEADER = /\bActivity\s+(\d+[\.\d]*|[IVXLC]+|[A-Z])\b/gi;

  const matches = [];
  let m;
  while ((m = ACTIVITY_HEADER.exec(text)) !== null) {
    matches.push({ index: m.index, label: m[0].trim(), id: m[1] });
  }

  if (!matches.length) return [];

  // Slice content between consecutive activity headers
  const activities = [];
  for (let i = 0; i < matches.length; i++) {
    const start   = matches[i].index;
    const end     = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const content = text.slice(start, end).trim();
    const page    = guessPage(start);

    activities.push({
      label:   matches[i].label,
      id:      matches[i].id,
      content: content.slice(0, 2000), // cap at 2000 chars per activity
      page,
    });
  }

  return activities;
};

/* ═══════════════════════════════════════════════════════════════════
   DEFINITION EXTRACTION
   Patterns:
     "<term> is called <definition>"
     "<term> is known as <definition>"
     "<term> is defined as <definition>"
     "<term> means <definition>"
     "Definition: <text>"
     "<term>: <definition>" (short inline definitions)
═══════════════════════════════════════════════════════════════════ */

const extractDefinitions = (text, pages = []) => {
  if (!text) return [];

  const definitions = [];
  const seen = new Set();

  // Pattern 1: "X is called / known as / defined as Y"
  const IS_CALLED = /([A-Z][a-z][^\n.]{2,60}?)\s+(?:is\s+called|is\s+known\s+as|is\s+defined\s+as|refers\s+to)\s+([^.]{10,200}\.)/gi;
  let m;
  while ((m = IS_CALLED.exec(text)) !== null) {
    const term = m[1].trim().replace(/^[^a-zA-Z]+/, '');
    const def  = m[2].trim();
    if (term.length < 3 || term.length > 80) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    definitions.push({ term, definition: def, source: 'is_called', page: guessPageFromOffset(m.index, pages) });
  }

  // Pattern 2: "X means Y"
  const MEANS = /\b([A-Z][a-z][^\n]{2,50}?)\s+means\s+([^.]{10,200}\.)/g;
  while ((m = MEANS.exec(text)) !== null) {
    const term = m[1].trim();
    const def  = m[2].trim();
    if (term.length < 3 || term.length > 80) continue;
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    definitions.push({ term, definition: def, source: 'means', page: guessPageFromOffset(m.index, pages) });
  }

  // Pattern 3: Explicit "Definition:" blocks
  const DEF_BLOCK = /\bDefinition\s*:\s*([^\n]{10,300})/gi;
  while ((m = DEF_BLOCK.exec(text)) !== null) {
    const def = m[1].trim();
    const key = def.slice(0, 40).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    definitions.push({ term: 'Definition', definition: def, source: 'block', page: guessPageFromOffset(m.index, pages) });
  }

  return definitions;
};

/* ═══════════════════════════════════════════════════════════════════
   FORMULA EXTRACTION
   Patterns:
     Chemical equations: Fe + S → FeS, 2H₂ + O₂ → 2H₂O
     Math: E = mc², F = ma, v = u + at
     Symbolic: contains =, →, ⟶, +, ×, ÷
═══════════════════════════════════════════════════════════════════ */

const extractFormulas = (text, pages = []) => {
  if (!text) return [];

  const formulas = [];
  const seen = new Set();

  // Chemical / mathematical equations
  // Must contain an equals or arrow and some alphanumeric on both sides
  const EQUATION = /[A-Za-z0-9₀-₉⁰-⁹\(\)]+\s*(?:=|→|⟶|⇌|⟵|\+\s*\w+\s*→)[^\n]{2,150}/g;
  let m;
  while ((m = EQUATION.exec(text)) !== null) {
    const formula = m[0].trim();
    if (formula.length < 5) continue;
    const key = formula.slice(0, 40).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Get surrounding context (50 chars before)
    const contextStart = Math.max(0, m.index - 60);
    const context = text.slice(contextStart, m.index).replace(/\n/g, ' ').trim();

    formulas.push({
      formula,
      context: context.slice(-60) || '',
      page: guessPageFromOffset(m.index, pages),
    });
  }

  // Numbered equations like (1), (2) — grab the line
  const NUMBERED_EQ = /^\s*\(?\d+\)?\s+[A-Za-z\d\+\-\=\→\(\)]{5,100}\s*$/gm;
  while ((m = NUMBERED_EQ.exec(text)) !== null) {
    const formula = m[0].trim();
    if (formula.length < 5) continue;
    const key = formula.slice(0, 40).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    formulas.push({
      formula,
      context: '',
      page: guessPageFromOffset(m.index, pages),
    });
  }

  return formulas;
};

/* ═══════════════════════════════════════════════════════════════════
   QUESTION EXTRACTION
   Patterns:
     1. What is ...?
     Q1. / Q.1 / Q 1.
     (a) / (i) at start of line
     Intext Questions / Exercises
═══════════════════════════════════════════════════════════════════ */

const extractQuestions = (text, pages = []) => {
  if (!text) return [];

  const questions = [];
  const seen = new Set();

  // Pattern 1: Numbered questions "1. Question text?"
  const NUMBERED = /^(\d+)\.\s+([^\n]{10,300}\?)/gm;
  let m;
  while ((m = NUMBERED.exec(text)) !== null) {
    const num = m[1];
    const q   = m[2].trim();
    const key = q.slice(0, 40).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push({ number: num, question: q, page: guessPageFromOffset(m.index, pages) });
  }

  // Pattern 2: Q1. / Q.1 style
  const Q_STYLE = /\bQ\.?\s*(\d+)\.?\s+([^\n]{10,300}[?.!])/g;
  while ((m = Q_STYLE.exec(text)) !== null) {
    const num = m[1];
    const q   = m[2].trim();
    const key = q.slice(0, 40).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push({ number: `Q${num}`, question: q, page: guessPageFromOffset(m.index, pages) });
  }

  // Pattern 3: Lettered sub-questions "(a) text?"
  const LETTERED = /^\(([a-z])\)\s+([^\n]{10,250}\?)/gm;
  while ((m = LETTERED.exec(text)) !== null) {
    const label = m[1];
    const q     = m[2].trim();
    const key   = q.slice(0, 40).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    questions.push({ number: `(${label})`, question: q, page: guessPageFromOffset(m.index, pages) });
  }

  return questions;
};

/* ═══════════════════════════════════════════════════════════════════
   EXERCISE EXTRACTION
   Finds named exercise / in-text question blocks.
   Returns the full block content for each.
═══════════════════════════════════════════════════════════════════ */

const extractExercises = (text, pages = []) => {
  if (!text) return [];

  const exercises = [];

  // Block headers: "Exercises", "In-text Questions", "Exercise 3.1"
  const EXERCISE_HEADER = /\b(Exercise(?:s)?(?:\s+[\d.]+)?|In[\s-]?text\s+Questions?|Practice\s+Questions?|Try\s+These|Think\s+and\s+Discuss)\b/gi;

  const matches = [];
  let m;
  while ((m = EXERCISE_HEADER.exec(text)) !== null) {
    matches.push({ index: m.index, label: m[0].trim() });
  }

  for (let i = 0; i < matches.length; i++) {
    const start   = matches[i].index;
    const end     = i + 1 < matches.length ? matches[i + 1].index : Math.min(start + 3000, text.length);
    const content = text.slice(start, end).trim();

    exercises.push({
      label:   matches[i].label,
      content: content.slice(0, 3000),
      page:    guessPageFromOffset(start, pages),
    });
  }

  return exercises;
};

/* ═══════════════════════════════════════════════════════════════════
   HELPER — page number from character offset
═══════════════════════════════════════════════════════════════════ */

const guessPageFromOffset = (charOffset, pages) => {
  if (!pages || !pages.length) return null;
  let pos = 0;
  for (const p of pages) {
    const len = (p.text || '').length + 2; // +2 for '\n\n' join
    if (charOffset <= pos + len) return p.page;
    pos += len;
  }
  return pages[pages.length - 1]?.page || null;
};

/* ═══════════════════════════════════════════════════════════════════
   DOCUMENT SUMMARY
   Builds a structural overview of the document:
     - Chapter/section headings
     - Page count
     - Detected content types
═══════════════════════════════════════════════════════════════════ */

const buildDocumentSummary = (text, pages = []) => {
  if (!text) return { headings: [], pageCount: 0, wordCount: 0 };

  // Detect headings (ALL CAPS lines, or "Chapter X" lines)
  const headings = [];
  const lines = text.split('\n');
  for (const line of lines) {
    const t = line.trim();
    if (!t || t.length < 4 || t.length > 120) continue;
    if (/^(chapter|unit|module|section)\s+[\dIVXLivxl]+/i.test(t)) {
      headings.push(t);
    } else if (/^[A-Z][A-Z\s\-]{5,60}$/.test(t) && !/^\d/.test(t)) {
      headings.push(t);
    }
  }

  const wordCount  = text.split(/\s+/).filter(Boolean).length;
  const pageCount  = pages.length;

  return { headings: [...new Set(headings)].slice(0, 20), pageCount, wordCount };
};

/* ═══════════════════════════════════════════════════════════════════
   MAIN ENTRY POINT — analyzeDocument
   Called by the chat route when an extraction query is detected.

   @param {string} fullText   — complete joined text
   @param {Array}  pages      — [{page, text}] array
   @param {string} queryType  — 'activities'|'definitions'|'formulas'|
                                'questions'|'exercises'|'summary'|'all'
   @returns {object} structured extraction results
═══════════════════════════════════════════════════════════════════ */

const analyzeDocument = (fullText, pages = [], queryType = 'all') => {
  if (!fullText) return { error: 'No document text available' };

  const result = {
    queryType,
    pageCount:   pages.length,
    wordCount:   fullText.split(/\s+/).filter(Boolean).length,
  };

  const want = (type) =>
    queryType === 'all' || queryType === type;

  if (want('activities')) {
    result.activities = extractActivities(fullText, pages);
    result.activityCount = result.activities.length;
  }
  if (want('definitions')) {
    result.definitions = extractDefinitions(fullText, pages);
    result.definitionCount = result.definitions.length;
  }
  if (want('formulas')) {
    result.formulas = extractFormulas(fullText, pages);
    result.formulaCount = result.formulas.length;
  }
  if (want('questions')) {
    result.questions = extractQuestions(fullText, pages);
    result.questionCount = result.questions.length;
  }
  if (want('exercises')) {
    result.exercises = extractExercises(fullText, pages);
    result.exerciseCount = result.exercises.length;
  }
  if (want('summary')) {
    result.summary = buildDocumentSummary(fullText, pages);
  }

  return result;
};

/* ═══════════════════════════════════════════════════════════════════
   QUERY TYPE DETECTOR
   Maps a user query string to the appropriate extraction type.
═══════════════════════════════════════════════════════════════════ */

const EXTRACTION_QUERY_MAP = [
  { patterns: ['activit'],              type: 'activities'  },
  { patterns: ['definition', 'define', 'meaning', 'means'],  type: 'definitions' },
  { patterns: ['formula', 'equation', 'chemical', 'math'],   type: 'formulas'    },
  { patterns: ['question', 'intext', 'in-text'],             type: 'questions'   },
  { patterns: ['exercise', 'practice'],                      type: 'exercises'   },
  { patterns: ['experiment'],                                type: 'activities'  }, // experiments are listed like activities
  { patterns: ['example'],                                   type: 'questions'   },
  { patterns: ['summarize', 'summary', 'chapter summary', 'summarise'], type: 'summary' },
];

const EXTRACTION_TRIGGER_PHRASES = [
  'list all', 'list the', 'list every', 'all activities', 'all experiments',
  'all questions', 'all formulas', 'all definitions', 'all exercises',
  'all examples', 'every activity', 'every experiment', 'give all',
  'extract all', 'find all', 'how many activities', 'how many questions',
  'summarize chapter', 'chapter summary', 'summarise chapter',
  'what are all', 'show all', 'enumerate',
];

/**
 * Returns { isExtraction: bool, queryType: string } for a user query.
 */
const classifyQuery = (query) => {
  const q = (query || '').toLowerCase();

  const isExtractionTrigger = EXTRACTION_TRIGGER_PHRASES.some(p => q.includes(p));
  if (!isExtractionTrigger) {
    return { isExtraction: false, queryType: null };
  }

  // Map to the most specific type
  for (const { patterns, type } of EXTRACTION_QUERY_MAP) {
    if (patterns.some(p => q.includes(p))) {
      return { isExtraction: true, queryType: type };
    }
  }

  // Generic extraction — return 'all'
  return { isExtraction: true, queryType: 'all' };
};

/* ═══════════════════════════════════════════════════════════════════
   FORMAT RESULTS → Markdown string for Ollama
   Converts structured extraction results into clean markdown
   that the chat stream can return directly.
═══════════════════════════════════════════════════════════════════ */

const formatResultsAsMarkdown = (analysis, originalQuery) => {
  const lines = [];

  if (analysis.activities && analysis.activities.length) {
    lines.push(`## Activities Found (${analysis.activities.length} total)\n`);
    for (const act of analysis.activities) {
      const pageTag = act.page ? ` *(Page ${act.page})*` : '';
      lines.push(`### ${act.label}${pageTag}`);
      // Show first ~500 chars of content, clean whitespace
      const preview = act.content
        .replace(/^Activity\s+[\d.]+\s*/i, '')
        .replace(/\n{3,}/g, '\n\n')
        .slice(0, 600)
        .trim();
      lines.push(preview);
      lines.push('');
    }
  }

  if (analysis.definitions && analysis.definitions.length) {
    lines.push(`## Definitions Found (${analysis.definitions.length} total)\n`);
    for (const d of analysis.definitions) {
      const pageTag = d.page ? ` *(Page ${d.page})*` : '';
      if (d.term === 'Definition') {
        lines.push(`- ${d.definition}${pageTag}`);
      } else {
        lines.push(`- **${d.term}**: ${d.definition}${pageTag}`);
      }
    }
    lines.push('');
  }

  if (analysis.formulas && analysis.formulas.length) {
    lines.push(`## Formulas / Equations Found (${analysis.formulas.length} total)\n`);
    for (const f of analysis.formulas) {
      const pageTag = f.page ? ` *(Page ${f.page})*` : '';
      const ctx     = f.context ? `*${f.context.trim()}*: ` : '';
      lines.push(`- ${ctx}\`${f.formula}\`${pageTag}`);
    }
    lines.push('');
  }

  if (analysis.questions && analysis.questions.length) {
    lines.push(`## Questions Found (${analysis.questions.length} total)\n`);
    for (const q of analysis.questions) {
      const pageTag = q.page ? ` *(Page ${q.page})*` : '';
      lines.push(`${q.number}. ${q.question}${pageTag}`);
    }
    lines.push('');
  }

  if (analysis.exercises && analysis.exercises.length) {
    lines.push(`## Exercise Blocks Found (${analysis.exercises.length} total)\n`);
    for (const ex of analysis.exercises) {
      const pageTag = ex.page ? ` *(Page ${ex.page})*` : '';
      lines.push(`### ${ex.label}${pageTag}`);
      lines.push(ex.content.replace(/\n{3,}/g, '\n\n').slice(0, 800).trim());
      lines.push('');
    }
  }

  if (analysis.summary) {
    const s = analysis.summary;
    lines.push(`## Document Overview\n`);
    lines.push(`- **Pages**: ${s.pageCount}`);
    lines.push(`- **Words**: ${s.wordCount.toLocaleString()}`);
    if (s.headings.length) {
      lines.push(`- **Sections/Chapters**:`);
      for (const h of s.headings) lines.push(`  - ${h}`);
    }
    lines.push('');
  }

  if (!lines.length) {
    return `I searched the full document for "${originalQuery}" but could not find any matching structured content.\n\n` +
           `The document contains ${analysis.wordCount?.toLocaleString() || 0} words across ${analysis.pageCount || 0} pages. ` +
           `Try rephrasing, or ask a specific knowledge question about the content.`;
  }

  return lines.join('\n');
};

module.exports = {
  analyzeDocument,
  classifyQuery,
  formatResultsAsMarkdown,
  extractActivities,
  extractDefinitions,
  extractFormulas,
  extractQuestions,
  extractExercises,
  buildDocumentSummary,
  EXTRACTION_TRIGGER_PHRASES,
};
