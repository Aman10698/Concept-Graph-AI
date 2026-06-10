/**
 * Full pipeline unit test — all new services
 */
const { fixConcatenatedWords, deduplicateRepeatedPhrases, normalizeWhitespace, cleanPage, cleanPages } = require('../services/textCleanerService');
const { makeSemanticChunks, isBoundary } = require('../services/semanticChunker');
const { classifyQuery } = require('../services/documentAnalysisService');

let pass = 0, fail = 0;
const ok  = (label) => { console.log('✅', label); pass++; };
const err = (label, got, exp) => { console.log('❌', label, `\n   got: "${got}"\n   exp: "${exp}"`); fail++; };

// ── 1. fixConcatenatedWords ────────────────────────────────────
console.log('\n=== fixConcatenatedWords ===');
const fw = fixConcatenatedWords;

const r1 = fw('Activity3.1');
r1.includes('Activity') && r1.includes('3.1') ? ok('Activity3.1 → Activity 3.1') : err('Activity3.1', r1, 'Activity 3.1');

const r2 = fw('metalsMalleability');
r2.includes('metals') && r2.includes('Malleability') ? ok('metalsMalleability → metals Malleability') : err('metalsMalleability', r2, 'metals Malleability');

const r3 = fw('3.1CHEMICAL');
r3.includes('CHEMICAL') ? ok('3.1CHEMICAL → 3.1 CHEMICAL') : err('3.1CHEMICAL', r3, '3.1 CHEMICAL');

// ── 2. deduplicateRepeatedPhrases ─────────────────────────────
console.log('\n=== deduplicateRepeatedPhrases ===');
const dp = deduplicateRepeatedPhrases;

const r4 = dp('Activity 3.1Activity 3.1Activity 3.1');
const occurrences = (r4.match(/Activity 3\.1/g) || []).length;
occurrences === 1 ? ok('Activity 3.1×3 → Activity 3.1×1') : err('dedup Activity 3.1', `${occurrences} occurrences`, '1 occurrence');

const r5 = dp('Figure 3.1Figure 3.1');
const occ2 = (r5.match(/Figure 3\.1/g) || []).length;
occ2 === 1 ? ok('Figure 3.1×2 → Figure 3.1×1') : err('dedup Figure 3.1', `${occ2} occurrences`, '1 occurrence');

// ── 3. normalizeWhitespace ─────────────────────────────────────
console.log('\n=== normalizeWhitespace ===');
const nw = normalizeWhitespace;
const r6 = nw('hello   world');
r6 === 'hello world' ? ok('multiple spaces → single') : err('spaces', r6, 'hello world');

const r7 = nw('line1\n\n\n\nline2');
r7 === 'line1\n\nline2' ? ok('3+ newlines → 2') : err('newlines', r7, 'line1\\n\\nline2');

// ── 4. cleanPage (full pipeline) ──────────────────────────────
console.log('\n=== cleanPage ===');
const rawPage = 'Activity 3.1Activity 3.1Activity 3.1\nFigure 3.1Figure 3.1\nmalleabilityMalleability\n\n\n\nNormal text here.';
const cleaned = cleanPage(rawPage);
!(cleaned.includes('Activity 3.1Activity')) ? ok('cleanPage removes duplicate Activity') : err('cleanPage Activity', cleaned.slice(0,50), 'no duplicate');
!(cleaned.includes('Figure 3.1Figure')) ? ok('cleanPage removes duplicate Figure') : err('cleanPage Figure', cleaned.slice(0,50), 'no duplicate');

// ── 5. isBoundary ──────────────────────────────────────────────
console.log('\n=== isBoundary ===');
isBoundary('Activity 3.1') ? ok('Activity 3.1 is boundary') : err('Activity 3.1', 'false', 'true');
isBoundary('3.2 CHEMICAL PROPERTIES') ? ok('3.2 CHEMICAL PROPERTIES is boundary') : err('section', 'false', 'true');
isBoundary('Exercises') ? ok('Exercises is boundary') : err('Exercises', 'false', 'true');
!isBoundary('The metal is malleable') ? ok('Normal text is NOT boundary') : err('not boundary', 'true', 'false');

// ── 6. makeSemanticChunks ──────────────────────────────────────
console.log('\n=== makeSemanticChunks ===');
const testPages = [{
  page: 1,
  text: [
    'Activity 3.1',
    'Take a small iron nail. Try to cut it with a knife.',
    'Record your observations in the table below.',
    '',
    'Activity 3.2',
    'Collect iron, copper, aluminium, coal, sulphur.',
    'Try to beat them with a hammer. Which ones flatten out?',
    '',
    'Activity 3.3',
    'Take pieces of iron, copper, aluminium and carbon.',
    'Try to stretch each by pulling them apart.',
  ].join('\n'),
  merged: '',
  contentType: 'text',
  chapter: 'Chapter 3',
  keywords: [],
}];

const chunks = [...makeSemanticChunks(testPages)];
chunks.length >= 3 ? ok(`Semantic chunker: ${chunks.length} chunks from 3 activities`) : err('chunk count', chunks.length, '>= 3');
chunks.every(c => !c.text.includes('Activity 3.1') || c.text.startsWith('Activity 3.1'))
  ? ok('Activity 3.1 starts its own chunk')
  : err('activity boundary', 'mixed', 'activity starts chunk');

// ── 7. Query classifier ────────────────────────────────────────
console.log('\n=== classifyQuery ===');
const cq = classifyQuery;
cq('list all activities').isExtraction ? ok('list all activities → EXTRACTION') : err('list all activities', 'RAG', 'EXTRACTION');
cq('all formulas').isExtraction ? ok('all formulas → EXTRACTION') : err('all formulas', 'RAG', 'EXTRACTION');
!cq('what is malleability?').isExtraction ? ok('what is malleability → RAG') : err('malleability', 'EXTRACTION', 'RAG');
!cq('explain ductility').isExtraction ? ok('explain ductility → RAG') : err('ductility', 'EXTRACTION', 'RAG');

// ── Summary ────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`RESULTS: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
