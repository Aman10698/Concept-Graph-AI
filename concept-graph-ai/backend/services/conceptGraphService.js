'use strict';

/**
 * conceptGraphService.js
 *
 * Two-phase pipeline that turns raw chapter text into a true knowledge
 * dependency graph, called ONCE at upload time.
 *
 * Phase A — extractConcepts(text)
 *   Ollama identifies atomic learning concepts (not section headings).
 *   e.g. "Soil", "Tilling", "Seed Drill" — not "1.3 Preparation of Soil"
 *
 * Phase B — generatePrerequisiteEdges(concepts)
 *   Ollama determines which concept must be understood before another.
 *   e.g. Soil → Tilling (must understand soil before tilling makes sense)
 *   Stores confidence per edge for later filtering / visualization.
 *
 * Result is stored in session.conceptGraph and NEVER recomputed during render.
 * Graph page uses stored nodes+edges, overlaid with per-concept quiz mastery.
 */

const ollamaWorker = require('./ollamaWorkerService');

/* ─────────────────────────────────────────────────────────────────────────────
   Helper: pick the right extraction mode based on document type.
   mode = 'mindmap'  → heading-based hierarchy (NCERT chapters, school books)
   mode = 'concept'  → atomic concept graph with prerequisite edges (default)
───────────────────────────────────────────────────────────────────────────── */

/**
 * buildConceptGraph(text)
 *
 * Orchestrates Phase A + Phase B.
 *
 * @param {string} text — raw chapter text extracted from the PDF
 * @returns {{
 *   conceptGraph: { nodes[], edges[], chapterTitle, subject, generatedAt },
 *   topicsDataCompat: { chapterTitle, subject, topics[] }  // backward compat shim
 * }}
 */
const buildConceptGraph = async (text) => {
  if (!text || text.trim().length < 50) {
    console.warn('[conceptGraphService] Text too short — skipping concept graph generation');
    return { conceptGraph: null, topicsDataCompat: null };
  }

  console.log('\n🧠 [conceptGraphService] Phase A — Extracting atomic concepts...');
  let conceptData;
  try {
    conceptData = await ollamaWorker.extractConcepts(text);
  } catch (err) {
    console.error('[conceptGraphService] Phase A failed:', err.message);
    return { conceptGraph: null, topicsDataCompat: null };
  }

  const { chapterTitle, subject, concepts } = conceptData;

  if (!concepts || concepts.length < 2) {
    console.warn('[conceptGraphService] Too few concepts extracted — skipping edge generation');
    return { conceptGraph: null, topicsDataCompat: null };
  }

  console.log(`\n🔗 [conceptGraphService] Phase B — Generating prerequisite edges for ${concepts.length} concepts...`);
  let edgeData;
  try {
    edgeData = await ollamaWorker.generatePrerequisiteEdges(concepts);
  } catch (err) {
    console.warn('[conceptGraphService] Phase B failed (edges skipped):', err.message);
    edgeData = { edges: [] };
  }

  const conceptGraph = {
    nodes:        concepts,   // [{ id, name, type, difficulty, importance }]
    edges:        edgeData.edges || [], // [{ source, target, confidence }]
    chapterTitle: chapterTitle || '',
    subject:      subject      || '',
    generatedAt:  new Date().toISOString(),
  };

  // ── Backward-compat shim ──────────────────────────────────────────────────
  // Other parts of the backend (questionGenerationService, etc.) still expect
  // session.topicsData in the legacy { chapterTitle, topics: [{ name, subtopics[] }] }
  // format. Build a flat shim so those services keep working untouched.
  const topicsDataCompat = {
    chapterTitle: chapterTitle || '',
    subject:      subject || '',
    topics: concepts.map(c => ({
      name:      c.name,
      subtopics: [],           // flat — no heading hierarchy in concept mode
      conceptId: c.id,         // extra field so downstream can cross-reference
    })),
  };

  console.log(
    `✅ [conceptGraphService] Done: ${concepts.length} concepts, ${conceptGraph.edges.length} prerequisite edges`
  );

  return { conceptGraph, topicsDataCompat };
};

/**
 * buildMindMap(text)
 *
 * Alternative pipeline for chapter-based documents (NCERT, school textbooks).
 * Produces a CLEAN hierarchical mind map from section headings only—NOT from
 * paragraph content. This prevents the LLM from treating activities, dialogues,
 * exercises, and examples as concept nodes.
 *
 * Level 0 = Chapter root
 * Level 1 = Section headings
 * Level 2 = Subsection headings
 * Level 3 = Categorized list items (tools, types, methods, crops...)
 *
 * @param {string} text — raw chapter text
 * @returns {{
 *   mindMap: { nodes[], edges[], chapterTitle, subject, generatedAt } | null,
 *   topicsDataCompat: { chapterTitle, subject, topics[] } | null
 * }}
 */
const buildMindMap = async (text) => {
  if (!text || text.trim().length < 50) {
    console.warn('[conceptGraphService] Text too short — skipping mind map generation');
    return { mindMap: null, topicsDataCompat: null };
  }

  console.log('\n🗺️  [conceptGraphService] buildMindMap — Extracting heading-based hierarchy...');
  let result;
  try {
    result = await ollamaWorker.extractMindMapStructure(text);
  } catch (err) {
    console.error('[conceptGraphService] buildMindMap failed:', err.message);
    return { mindMap: null, topicsDataCompat: null };
  }

  const { nodes, edges, chapterTitle, subject } = result;

  if (!nodes || nodes.length < 2) {
    console.warn('[conceptGraphService] buildMindMap: too few nodes extracted');
    return { mindMap: null, topicsDataCompat: null };
  }

  const mindMap = {
    nodes,
    edges,
    chapterTitle: chapterTitle || '',
    subject:      subject      || '',
    mode:         'mindmap',
    generatedAt:  new Date().toISOString(),
  };

  // Backward-compat shim: expose level-1 & level-2 nodes as flat topics[]
  const topicsDataCompat = {
    chapterTitle: chapterTitle || '',
    subject:      subject || '',
    topics: nodes
      .filter(n => n.level === 1 || n.level === 2)
      .map(n => ({
        name:     n.label,
        subtopics: nodes
          .filter(child => {
            // children share the parent's id as a prefix in the id scheme
            return edges.some(e => e.source === n.id && e.target === child.id);
          })
          .map(child => ({ name: child.label, subtopics: [] })),
      })),
  };

  console.log(
    `✅ [conceptGraphService] buildMindMap done: ${nodes.length} nodes, ${edges.length} edges — "${chapterTitle}"`
  );

  return { mindMap, topicsDataCompat };
};

/**
 * updateConceptMastery(currentMastery, conceptId, isCorrect)
 *
 * Pure function — returns a new mastery entry for one concept after a quiz answer.
 * The caller is responsible for persisting to MongoDB.
 *
 * Mastery formula:
 *   mastery = (correct / total) * 100  — simple accuracy, weighted by recency
 *   status  = mastery >= 75 → 'strong' | >= 45 → 'partial' | else → 'weak'
 */
const updateConceptMastery = (currentMastery = {}, conceptId, isCorrect) => {
  const existing = currentMastery[conceptId] || { correct: 0, incorrect: 0, mastery: 0, status: 'not_started' };
  const correct   = existing.correct   + (isCorrect ? 1 : 0);
  const incorrect = existing.incorrect + (isCorrect ? 0 : 1);
  const total     = correct + incorrect;
  const mastery   = total > 0 ? Math.round((correct / total) * 100) : 0;
  const status    = mastery >= 75 ? 'strong' : mastery >= 45 ? 'partial' : 'weak';

  return {
    ...currentMastery,
    [conceptId]: {
      correct,
      incorrect,
      mastery,
      status,
      lastPracticed: new Date().toISOString(),
    },
  };
};

module.exports = { buildConceptGraph, buildMindMap, updateConceptMastery };

