/**
 * Quick smoke test for documentAnalysisService
 */
const {
  classifyQuery,
  extractActivities,
  extractDefinitions,
  extractFormulas,
  extractQuestions,
} = require('../services/documentAnalysisService');

// ── Query classifier tests ──────────────────────────────────────
const tests = [
  { q: 'list all activities',           expectExtract: true,  expectType: 'activities'  },
  { q: 'all activities in chapter 3',   expectExtract: true,  expectType: 'activities'  },
  { q: 'list all definitions',          expectExtract: true,  expectType: 'definitions' },
  { q: 'all formulas in the chapter',   expectExtract: true,  expectType: 'formulas'    },
  { q: 'list all questions',            expectExtract: true,  expectType: 'questions'   },
  { q: 'summarize chapter',             expectExtract: true,  expectType: 'summary'     },
  { q: 'every experiment',              expectExtract: true,  expectType: 'activities'  },
  { q: 'what is malleability?',         expectExtract: false, expectType: null          },
  { q: 'explain ductility',             expectExtract: false, expectType: null          },
  { q: 'why are metals sonorous?',      expectExtract: false, expectType: null          },
];

let passed = 0, failed = 0;
console.log('\n=== QUERY CLASSIFIER ===');
for (const { q, expectExtract, expectType } of tests) {
  const r = classifyQuery(q);
  const ok = r.isExtraction === expectExtract && r.queryType === expectType;
  console.log(ok ? '✅' : '❌', `[${r.isExtraction ? 'EXTRACT' : 'RAG    '}] ${r.queryType || '-'} | ${q}`);
  ok ? passed++ : failed++;
}

// ── Extraction tests ───────────────────────────────────────────
const sampleText = [
  '',
  'Activity 3.1',
  'Take a small iron nail, a coal piece and a piece of copper wire.',
  'Try to cut them with a knife. Also try to break them by hammering.',
  '',
  'Activity 3.2',
  'Collect the following samples: iron, copper, aluminium, coal, sulphur.',
  'Try to beat them with a hammer. Which ones flatten out?',
  '',
  'Activity 3.3',
  'Take pieces of iron, copper, aluminium and carbon (coal).',
  'Try to stretch each of these by pulling them apart.',
  '',
  'Malleability is called the property by which metals can be beaten into thin sheets.',
  '',
  'Ductility means the ability of a metal to be drawn into wires.',
  '',
  'Definition: Conductivity is the ability of a material to conduct electricity.',
  '',
  'Fe + S → FeS',
  '2H₂ + O₂ → 2H₂O',
  '',
  '1. What are metals? What are their properties?',
  '2. Why are metals good conductors of electricity?',
].join('\n');

console.log('\n=== ACTIVITY EXTRACTION ===');
const activities = extractActivities(sampleText);
console.log(`Found: ${activities.length} (expected 3)`);
activities.forEach(a => console.log('  -', a.label));
if (activities.length === 3) { console.log('✅ PASS'); passed++; } else { console.log('❌ FAIL'); failed++; }

console.log('\n=== DEFINITION EXTRACTION ===');
const defs = extractDefinitions(sampleText);
console.log(`Found: ${defs.length} (expected >= 2)`);
defs.forEach(d => console.log('  -', `"${d.term}": ${d.definition.slice(0, 60)}`));
if (defs.length >= 2) { console.log('✅ PASS'); passed++; } else { console.log('❌ FAIL'); failed++; }

console.log('\n=== FORMULA EXTRACTION ===');
const formulas = extractFormulas(sampleText);
console.log(`Found: ${formulas.length} (expected >= 1)`);
formulas.forEach(f => console.log('  -', f.formula));
if (formulas.length >= 1) { console.log('✅ PASS'); passed++; } else { console.log('❌ FAIL'); failed++; }

console.log('\n=== QUESTION EXTRACTION ===');
const questions = extractQuestions(sampleText);
console.log(`Found: ${questions.length} (expected 2)`);
questions.forEach(q => console.log('  -', q.number + '.', q.question.slice(0, 60)));
if (questions.length >= 2) { console.log('✅ PASS'); passed++; } else { console.log('❌ FAIL'); failed++; }

console.log(`\n===========================`);
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
