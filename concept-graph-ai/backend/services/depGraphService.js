'use strict';

/**
 * depGraphService.js
 *
 * Builds a multi-level prerequisite dependency graph from:
 *   1. session.topicsData  — hierarchy extracted from the PDF
 *   2. session.evaluationData (merged with topicDepGraphs) — real quiz scores
 *   3. session.topicDepGraphs[topic].nodes — previously-analyzed prerequisites stored per quiz
 *
 * Ollama is NOT used here for graph structure.
 * Depth 2 prerequisites come from: stored quiz nodes > topicsData multi-level > cross-topic deps.
 */

/* ── score → status ─────────────────────────────────────────────── */
const scoreToStatus = (score) => {
  if (score === null || score === undefined) return 'not_started';
  if (score >= 75) return 'strong';
  if (score >= 45) return 'partial';
  return 'weak';
};

/* ── icon assignment (keyword-based) ────────────────────────────── */
const ICON_MAP = [
  { keys: ['data', 'database', 'storage', 'sql', 'nosql'], icon: 'database' },
  { keys: ['network', 'protocol', 'tcp', 'http', 'socket', 'api'], icon: 'layers' },
  { keys: ['math', 'calculus', 'algebra', 'statistic', 'probability', 'linear'], icon: 'chart' },
  { keys: ['hardware', 'cpu', 'processor', 'circuit', 'chip', 'memory'], icon: 'cpu' },
  { keys: ['chem', 'molecule', 'element', 'reaction', 'lab', 'flask'], icon: 'flask' },
  { keys: ['physics', 'quantum', 'atom', 'particle', 'nuclear'], icon: 'atom' },
  { keys: ['system', 'architecture', 'design', 'pattern', 'model'], icon: 'cube' },
];
const ICON_FALLBACKS = ['book', 'cube', 'chart', 'layers', 'database', 'cpu'];

const getIcon = (name, index = 0) => {
  if (!name) return ICON_FALLBACKS[index % ICON_FALLBACKS.length];
  const lower = name.toLowerCase();
  for (const { keys, icon } of ICON_MAP) {
    if (keys.some(k => lower.includes(k))) return icon;
  }
  return ICON_FALLBACKS[index % ICON_FALLBACKS.length];
};

const getDescription = (name, status, evalData = {}, isUntestedGap = false) => {
  // Use stored AI feedback if available
  const feedback = evalData?.feedback || evalData?.improvements?.[0];
  if (feedback && typeof feedback === 'string' && feedback.length > 10) {
    return feedback.length > 90 ? feedback.slice(0, 87) + '…' : feedback;
  }
  // Untested subtopics of a weak parent — explain the gap
  if (isUntestedGap) {
    return `"${name}" has not been individually quizzed yet — it may be contributing to your gap in the parent topic.`;
  }
  // Fallback descriptions by status
  switch (status) {
    case 'weak':    return `"${name}" needs focused revision — key concepts are unclear.`;
    case 'partial': return `"${name}" is partially understood — some important gaps remain.`;
    case 'strong':  return `"${name}" is well understood. Keep practising to maintain mastery.`;
    default:        return `Complete a quiz on "${name}" to measure your current understanding.`;
  }
};

/**
 * Normalise topicsData to a flat array of { name, subtopics[] }.
 * Handles both raw Ollama output shape ({ topics: [...] }) and plain arrays.
 */
const normaliseTopics = (topicsData) => {
  if (!topicsData) return [];
  if (Array.isArray(topicsData)) return topicsData;
  if (Array.isArray(topicsData.topics)) return topicsData.topics;
  return [];
};

/**
 * Clean a topic name from PDF extraction artifacts:
 *  - Strip leading bullets/numbers: "1.", "•", "-"
 *  - Strip trailing colon, dash, or parenthetical
 *  - Collapse internal newlines to spaces
 *  - Cap at 55 chars so nodes don't overflow
 */
const cleanName = (raw) => {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw
    .replace(/\n/g, ' ')                     // newlines → spaces
    .replace(/^\s*[\d]+[.)]\s*/, '')          // leading "1." / "1)"
    .replace(/^\s*[•\-*]\s*/, '')             // leading bullet
    .replace(/:\s*$/, '')                     // trailing colon
    .replace(/\s*[-–]\s*$/, '')               // trailing dash
    .trim();
  // If a dash or colon appears and everything after is a list, keep only the prefix
  const colonIdx = s.indexOf(':');
  if (colonIdx > 4 && colonIdx < s.length - 2) {
    // "Types of hardware virtualization: full, partial, para" → just keep the prefix
    s = s.slice(0, colonIdx).trim();
  }
  // Cap length
  return s.length > 55 ? s.slice(0, 53) + '…' : s;
};

/** Build a name→topic lookup map (case-insensitive) — shallow, top-level only */
const buildTopicMap = (topics) => {
  const map = new Map();
  topics.forEach(t => {
    const name = cleanName(typeof t === 'string' ? t : t.name);
    if (name) map.set(name.toLowerCase(), t);
  });
  return map;
};

/**
 * Build a RECURSIVE name→topic lookup map.
 * Walks the full hierarchy at all depths so nested subtopics can be found.
 */
const buildRecursiveTopicMap = (topics) => {
  const map = new Map();
  const walk = (items) => {
    if (!Array.isArray(items)) return;
    items.forEach(t => {
      if (!t || typeof t === 'string') {
        const name = cleanName(t || '');
        if (name) map.set(name.toLowerCase(), { name, subtopics: [] });
        return;
      }
      const name = cleanName(t.name || '');
      if (name) map.set(name.toLowerCase(), t);
      walk(t.subtopics || []);
    });
  };
  walk(topics);
  return map;
};

/** Look up a topic object by name (case-insensitive, substring match) */
const findTopic = (topicMap, name) => {
  if (!name) return null;
  const lower = name.toLowerCase();
  // exact first
  if (topicMap.has(lower)) return topicMap.get(lower);
  // partial match
  for (const [key, val] of topicMap) {
    if (key.includes(lower) || lower.includes(key)) return val;
  }
  return null;
};

/** Get subtopic names from a topic object */
const getSubtopics = (topicObj) => {
  if (!topicObj) return [];
  const raw = topicObj.subtopics || [];
  return raw
    .map(s => cleanName(typeof s === 'string' ? s : s?.name))
    .filter(Boolean);
};

/** Get eval for a name from mergedEval (exact + case-insensitive fallback) */
const getEval = (mergedEval, name) => {
  if (mergedEval[name]) return mergedEval[name];
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(mergedEval)) {
    if (k.toLowerCase() === lower) return v;
  }
  return {};
};

/**
 * buildDepGraph
 *
 * @param {string} topicName      - The topic the user clicked ("View Graph")
 * @param {*}      topicsData     - From session.topicsData (PDF hierarchy)
 * @param {object} mergedEval     - Merged evaluationData + topicDepGraphs scores
 * @param {object} topicDepGraphs - Full topicDepGraphs from session (for stored nodes)
 */
const buildDepGraph = (topicName, topicsData, mergedEval = {}, topicDepGraphs = {}) => {
  const topics   = normaliseTopics(topicsData);
  const topicMap = buildTopicMap(topics);

  /* ── Find root topic in hierarchy ── */
  const topicObj  = findTopic(topicMap, topicName);
  const l1Subtopics = getSubtopics(topicObj);

  /* ── Root node score ── */
  const rootEvalDirect = getEval(mergedEval, topicName);
  let rootScore  = rootEvalDirect.score  ?? null;
  let rootRating = rootEvalDirect.rating || null;

  const nodes = [];
  const addedNames = new Set();

  const addNode = (node) => {
    if (addedNames.has(node.name.toLowerCase())) return;
    addedNames.add(node.name.toLowerCase());
    const nodeIndex = nodes.length;
    // Enrich with description and icon if not already provided
    if (!node.icon)        node.icon        = getIcon(node.name, nodeIndex);
    if (!node.description) node.description = getDescription(
      node.name,
      node.status,
      getEval(mergedEval, node.name),
      node.isUntestedGap
    );
    nodes.push(node);
  };

  /* ── Level 1: direct subtopics ── */
  const l1Names = [];

  // Use syllabus subtopics if available
  if (l1Subtopics.length > 0) {
    // Determine if the parent (root) topic is weak or partial
    const parentIsWeak = rootRating === 'weak' || rootRating === 'partial' ||
      (rootEvalDirect.score != null && rootEvalDirect.score < 75);

    l1Subtopics.forEach(subName => {
      const ev     = getEval(mergedEval, subName);
      const score  = ev.score ?? null;
      // If the parent is weak and this subtopic has NEVER been individually quizzed,
      // mark it as 'partial' (untested gap) so the graph shows it as a potential cause.
      const hasIndividualScore = score !== null;
      const status = ev.rating
        ? ev.rating
        : hasIndividualScore
          ? scoreToStatus(score)
          : parentIsWeak ? 'partial' : 'not_started';
      addNode({
        name:  subName,
        status,
        score,
        parent:        topicName,
        isUntestedGap: !hasIndividualScore && parentIsWeak,
      });
      l1Names.push(subName);
    });
  } else {
    // Fallback A: other MAIN topics that have quiz scores, sorted weakest first
    const allTopicNames = topics.map(t => (typeof t === 'string' ? t : t.name)).filter(Boolean);
    const others = Object.entries(mergedEval)
      .filter(([name]) => name !== topicName && allTopicNames.includes(name))
      .sort(([, a], [, b]) => (a.score ?? 0) - (b.score ?? 0))
      .slice(0, 6);

    if (others.length > 0) {
      others.forEach(([name, ev]) => {
        addNode({ name, status: ev.rating || scoreToStatus(ev.score), score: ev.score ?? null, parent: topicName });
        l1Names.push(name);
      });
    } else {
      // Fallback B: topic is a subtopic (e.g. from a BloomPanel quiz) and has stored
      // prerequisite nodes in topicDepGraphs[topicName].nodes — use those directly.
      const stored = topicDepGraphs[topicName];
      const storedNodes = stored?.nodes?.length ? stored.nodes : [];

      if (storedNodes.length > 0) {
        storedNodes
          .filter(n =>
            n.name &&
            n.name.toLowerCase() !== topicName.toLowerCase() && // exclude root by name
            !/^none$/i.test(n.parent || '')                     // exclude orphan roots
          )
          .slice(0, 8)
          .forEach(n => {
            const ev     = getEval(mergedEval, n.name);
            const score  = ev.score ?? n.score ?? null;
            const status = ev.rating || n.status || scoreToStatus(score);
            addNode({ name: n.name, status, score, parent: topicName, isPrerequisite: true });
            l1Names.push(n.name);
          });
      }
      // If storedNodes is also empty → only 1 root node, "No prerequisite connections" shown.
      // This is intentional — the user needs to quiz more subtopics.
    }
  }

  /* ── Derive root score from children if no direct score ── */
  const l1Scored = l1Names
    .map(n => getEval(mergedEval, n))
    .filter(e => e.score != null);

  if (rootScore === null && l1Scored.length > 0) {
    const avg = Math.round(l1Scored.reduce((s, e) => s + e.score, 0) / l1Scored.length);
    rootScore  = avg;
    rootRating = scoreToStatus(avg);
  } else if (rootRating === null) {
    rootRating = scoreToStatus(rootScore);
  }

  /* ── Root node (pushed AFTER computing score from children) ── */
  addNode({
    name:   topicName,
    status: rootRating || 'not_started',
    score:  rootScore,
    parent: 'none',
    isRoot: true,
  });

  /* ── Level 2: prerequisites for each L1 node ── */
  l1Names.forEach(l1Name => {
    const l1Ev     = getEval(mergedEval, l1Name);
    const l1Status = l1Ev.rating || scoreToStatus(l1Ev.score ?? null);

    // Source A: Previously stored prerequisite nodes from a BloomPanel quiz
    const storedNodes = _getStoredNodes(topicDepGraphs, l1Name, mergedEval);
    if (storedNodes.length > 0) {
      storedNodes.forEach(n => {
        if (!addedNames.has(n.name.toLowerCase()) && n.name !== topicName) {
          addNode({ name: n.name, status: n.status, score: n.score, parent: l1Name, isPrerequisite: true });
        }
      });
      return; // stored nodes are most authoritative — don't also add syllabus L2
    }

    // Source B: The L1 node's own subtopics in the syllabus hierarchy
    const l1Obj    = findTopic(topicMap, l1Name);
    const l2Subs   = getSubtopics(l1Obj);
    if (l2Subs.length > 0) {
      const l1IsWeak = l1Status === 'weak' || l1Status === 'partial';
      l2Subs.slice(0, 4).forEach(subName => {
        if (addedNames.has(subName.toLowerCase()) || subName === topicName) return;
        const ev     = getEval(mergedEval, subName);
        const score  = ev.score ?? null;
        const hasIndividualScore = score !== null;
        const status = ev.rating
          ? ev.rating
          : hasIndividualScore
            ? scoreToStatus(score)
            : l1IsWeak ? 'partial' : 'not_started';
        addNode({
          name:  subName,
          status,
          score,
          parent:        l1Name,
          isUntestedGap: !hasIndividualScore && l1IsWeak,
        });
      });
      return;
    }

    // Source C: For WEAK/PARTIAL L1 nodes with no L2 data, show sibling topics
    // that are known to be prerequisites (other scored topics with lower names)
    if (l1Status === 'weak' || l1Status === 'partial') {
      const crossPreqs = _findCrossPrerequisites(l1Name, topicMap, mergedEval, addedNames, topicName, 3);
      crossPreqs.forEach(n => addNode({ ...n, parent: l1Name, isPrerequisite: true }));
    }
  });

  /* ── Level 3: subtopics of each L2 node ── */
  const l2Names = nodes
    .filter(n => n.parent !== topicName && !n.isRoot)
    .map(n => n.name);

  l2Names.forEach(l2Name => {
    const l2Obj  = findTopic(topicMap, l2Name);
    const l3Subs = getSubtopics(l2Obj);
    l3Subs.slice(0, 3).forEach(subName => {
      if (addedNames.has(subName.toLowerCase()) || subName === topicName) return;
      const ev     = getEval(mergedEval, subName);
      const score  = ev.score ?? null;
      const status = ev.rating || scoreToStatus(score);
      addNode({ name: subName, status, score, parent: l2Name });
    });
  });

  /* ── scores map ── */
  const scores = {};
  nodes.forEach(n => { if (n.score !== null && n.score !== undefined) scores[n.name] = n.score; });

  /* ── weak nodes (for Ollama prompt) ── */
  const weakNodes = nodes.filter(n => n.status === 'weak' || n.status === 'partial');

  /* ── prerequisiteEdges: cross-topic dashed lines ── */
  const prerequisiteEdges = nodes
    .filter(n => n.isPrerequisite && n.parent && n.name !== n.parent)
    .map(n => ({ source: n.name, target: n.parent }));

  /* ── recommended learning path: richest shape {topic, score, status} ── */
  const scoredNonRoot = nodes
    .filter(n => !n.isRoot && n.score !== null)
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  const notScored = nodes.filter(n => !n.isRoot && n.score === null);
  const recommendedPath = [
    ...scoredNonRoot.map(n => ({ topic: n.name, score: n.score, status: n.status })),
    ...notScored.map(n    => ({ topic: n.name, score: null,    status: n.status })),
    { topic: topicName, score: rootScore, status: rootRating || 'not_started' },
  ];

  return { nodes, scores, weakNodes, rootScore, rootRating, recommendedPath, prerequisiteEdges };
};

/* ── Helpers ─────────────────────────────────────────────────────── */

/**
 * Extract prerequisite nodes stored in topicDepGraphs[l1Name].nodes
 * and enrich with current eval scores.
 */
function _getStoredNodes(topicDepGraphs, l1Name, mergedEval) {
  // Try exact match then case-insensitive
  let entry = topicDepGraphs[l1Name];
  if (!entry) {
    const lower = l1Name.toLowerCase();
    for (const [k, v] of Object.entries(topicDepGraphs)) {
      if (k.toLowerCase() === lower) { entry = v; break; }
    }
  }
  if (!entry?.nodes?.length) return [];

  return entry.nodes
    .filter(n => n.name && n.name.toLowerCase() !== l1Name.toLowerCase())
    .slice(0, 8)
    .map(n => {
      const ev     = getEval(mergedEval, n.name);
      const score  = ev.score ?? n.score ?? null;
      const status = ev.rating || n.status || scoreToStatus(score);
      return { name: n.name, status, score };
    });
}

/**
 * Find cross-topic prerequisites for a weak L1 node from other scored topics.
 * Returns up to `limit` nodes that are likely foundational (low scores = gaps).
 */
function _findCrossPrerequisites(l1Name, topicMap, mergedEval, addedNames, rootName, limit) {
  const results = [];
  // Only include topics that exist in this syllabus's topicMap to prevent
  // cross-syllabus contamination (e.g. "Closure Property" from another session)
  for (const [name, ev] of Object.entries(mergedEval)) {
    if (name === l1Name || name === rootName) continue;
    if (addedNames.has(name.toLowerCase())) continue;
    if (ev.score == null) continue;
    // Guard: topic must exist in the current syllabus hierarchy
    if (!findTopic(topicMap, name)) continue;
    // Only include weak/partial topics as prerequisite gaps
    const status = ev.rating || scoreToStatus(ev.score);
    if (status === 'weak' || status === 'partial') {
      results.push({ name, status, score: ev.score });
    }
    if (results.length >= limit) break;
  }
  return results;
}

/**
 * buildModuleDepGraph
 *
 * Builds ONE comprehensive dependency graph for an entire module / chapter.
 * Every subtopic of the module is a node — quizzed or not.
 *
 * @param {string} moduleName     - Top-level topic (e.g. "Crop Production and Management")
 * @param {*}      topicsData     - From session.topicsData
 * @param {object} mergedEval     - Merged evaluationData + topicDepGraphs scores
 * @param {object} topicDepGraphs - Full topicDepGraphs from session
 *
 * Returns: { nodes, scores, weakNodes, moduleName, totalCount, quizzedCount, avgScore, prerequisiteEdges }
 */
const buildModuleDepGraph = (moduleName, topicsData, mergedEval = {}, topicDepGraphs = {}) => {
  const topics   = normaliseTopics(topicsData);
  // Use the recursive map so findTopic can resolve subtopics at any depth
  const topicMap = buildRecursiveTopicMap(topics);

  // ── Find the module in the hierarchy ──
  const moduleObj     = findTopic(topicMap, moduleName);
  const directSubs    = getSubtopics(moduleObj); // L1 subtopics

  const nodes     = [];
  const addedNames = new Set();

  const addNode = (node) => {
    const key = node.name.toLowerCase();
    if (addedNames.has(key)) return;
    addedNames.add(key);
    const idx = nodes.length;
    if (!node.icon)        node.icon        = getIcon(node.name, idx);
    if (!node.description) node.description = getDescription(
      node.name, node.status, getEval(mergedEval, node.name), false
    );
    nodes.push(node);
  };

  // ── Module root node ──
  // Score = average of all quizzed subtopics
  const allEvals  = Object.values(mergedEval);
  const rootEval  = getEval(mergedEval, moduleName);
  let   rootScore = rootEval.score ?? null;
  let   rootRating= rootEval.rating ?? null;

  // ── L1: direct subtopics ──
  const l1Names = [];
  if (directSubs.length > 0) {
    directSubs.forEach((subName, i) => {
      const ev     = getEval(mergedEval, subName);
      const score  = ev.score ?? null;
      const status = ev.rating
        ? ev.rating
        : score !== null
          ? scoreToStatus(score)
          : 'not_started';
      addNode({
        name:   subName,
        status,
        score,
        parent: moduleName,
        order:  i,
      });
      l1Names.push(subName);
    });
  } else {
    // Module has no subtopics in hierarchy — fall back to showing
    // every quizzed topic in mergedEval as a direct child
    Object.entries(mergedEval)
      .filter(([n]) => n !== moduleName)
      .slice(0, 10)
      .forEach(([name, ev], i) => {
        const score  = ev.score ?? null;
        const status = ev.rating || scoreToStatus(score);
        addNode({ name, status, score, parent: moduleName, order: i });
        l1Names.push(name);
      });
  }

  // ── L2: sub-subtopics of each L1 node ──
  // Priority 1: AI-generated nodes from a previous quiz on that l1 node
  // Priority 2: Syllabus hierarchy subtopics
  l1Names.forEach(l1Name => {
    // Check stored quiz nodes first
    const storedL2 = _getStoredNodes(topicDepGraphs, l1Name, mergedEval);
    if (storedL2.length > 0) {
      storedL2.forEach((n, i) => {
        if (addedNames.has(n.name.toLowerCase()) || n.name === moduleName) return;
        addNode({ name: n.name, status: n.status, score: n.score, parent: l1Name, order: i, isPrerequisite: true });
      });
      return; // stored nodes are most authoritative — skip syllabus fallback
    }

    // Fallback: syllabus hierarchy subtopics
    const l1Obj  = findTopic(topicMap, l1Name);
    const l2Subs = getSubtopics(l1Obj);
    l2Subs.slice(0, 5).forEach((subName, i) => {
      if (addedNames.has(subName.toLowerCase()) || subName === moduleName) return;
      const ev     = getEval(mergedEval, subName);
      const score  = ev.score ?? null;
      const status = ev.rating
        ? ev.rating
        : score !== null
          ? scoreToStatus(score)
          : 'not_started';
      addNode({ name: subName, status, score, parent: l1Name, order: i });
    });
  });

  // ── L3: sub-sub-subtopics of each L2 node ──
  const l2Names = nodes
    .filter(n => !n.isRoot && n.parent !== moduleName)
    .map(n => n.name);

  l2Names.forEach(l2Name => {
    const l2Obj  = findTopic(topicMap, l2Name);
    const l3Subs = getSubtopics(l2Obj);
    l3Subs.slice(0, 4).forEach((subName, i) => {
      if (addedNames.has(subName.toLowerCase()) || subName === moduleName) return;
      const ev     = getEval(mergedEval, subName);
      const score  = ev.score ?? null;
      const status = ev.rating
        ? ev.rating
        : score !== null
          ? scoreToStatus(score)
          : 'not_started';
      addNode({
        name:   subName,
        status,
        score,
        parent: l2Name,
        order:  i,
      });
    });
  });


  const scored = nodes.filter(n => n.score !== null);
  if (rootScore === null && scored.length > 0) {
    rootScore  = Math.round(scored.reduce((s, n) => s + n.score, 0) / scored.length);
    rootRating = scoreToStatus(rootScore);
  }

  // ── Root node (pushed after computing score) ──
  addNode({
    name:   moduleName,
    status: rootRating || 'not_started',
    score:  rootScore,
    parent: 'none',
    isRoot: true,
  });

  // ── Progress stats ──
  const nonRootNodes  = nodes.filter(n => !n.isRoot);
  const totalCount    = nonRootNodes.length;
  const quizzedNodes  = nonRootNodes.filter(n => n.score !== null);
  const quizzedCount  = quizzedNodes.length;
  const avgScore      = quizzedCount > 0
    ? Math.round(quizzedNodes.reduce((s, n) => s + n.score, 0) / quizzedCount)
    : null;

  // ── Scores map ──
  const scores = {};
  nodes.forEach(n => { if (n.score !== null && n.score !== undefined) scores[n.name] = n.score; });

  // ── Weak nodes ──
  const weakNodes = nodes.filter(n => n.status === 'weak' || n.status === 'partial');

  // ── Prerequisite edges (sequential order between siblings) ──
  const prerequisiteEdges = [];
  // Group siblings by parent and connect in order
  const byParent = {};
  nodes.forEach(n => {
    if (!n.isRoot) {
      if (!byParent[n.parent]) byParent[n.parent] = [];
      byParent[n.parent].push(n);
    }
  });
  Object.values(byParent).forEach(siblings => {
    const sorted = siblings.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (let i = 0; i < sorted.length - 1; i++) {
      prerequisiteEdges.push({ source: sorted[i].name, target: sorted[i + 1].name });
    }
  });

  return {
    nodes,
    scores,
    weakNodes,
    moduleName,
    rootScore,
    rootRating,
    totalCount,
    quizzedCount,
    avgScore,
    prerequisiteEdges,
  };
};

module.exports = { buildDepGraph, buildModuleDepGraph, buildConceptDepGraph, scoreToStatus, normaliseTopics };

/* ════════════════════════════════════════════════════════════════════════════
   TRUE PREREQUISITE GRAPH BUILDER  (new sessions only)
   Uses session.conceptGraph (Ollama-generated nodes + edges at upload time)
   overlaid with session.conceptMastery (live quiz scores).
   Ollama is NOT called here — this is 100% deterministic from stored data.
════════════════════════════════════════════════════════════════════════════ */

/**
 * buildConceptDepGraph(conceptGraph, conceptMastery)
 *
 * @param {{ nodes[], edges[] }} conceptGraph
 *   nodes: [{ id, name, type, difficulty, importance }]
 *   edges: [{ source, target, confidence }]
 * @param {object} conceptMastery
 *   { "concept_id": { correct, incorrect, mastery, status, lastPracticed } }
 *
 * @returns {{
 *   nodes: Array — enriched nodes with status, score, parent (for DependencyGraph compat)
 *   edges: Array — original edges passed through for DAG renderer
 *   scores: object  — conceptId → mastery score
 *   weakNodes: Array
 *   rootCauses: string[] — concept NAMES of upstream root causes
 *   recommendedPath: Array — topological order, weak/not_started first
 *   totalCount: number
 *   quizzedCount: number
 * }}
 */
function buildConceptDepGraph(conceptGraph, conceptMastery = {}) {
  const { nodes: rawNodes = [], edges = [] } = conceptGraph || {};
  if (!rawNodes.length) return _emptyConceptResult();

  // ── Build adjacency maps ─────────────────────────────────────────
  const outEdges = {}; // source_id → [target_id, ...]
  const inEdges  = {}; // target_id → [source_id, ...]
  for (const e of edges) {
    if (!outEdges[e.source]) outEdges[e.source] = [];
    outEdges[e.source].push(e.target);
    if (!inEdges[e.target]) inEdges[e.target] = [];
    inEdges[e.target].push(e.source);
  }

  // ── Id → name map ────────────────────────────────────────────────
  const idToName = {};
  rawNodes.forEach(n => { idToName[n.id] = n.name; });

  // ── Enrich nodes with mastery data ───────────────────────────────
  const enriched = rawNodes.map(n => {
    const m       = conceptMastery[n.id] || {};
    const mastery = m.mastery ?? null;
    const status  = mastery === null
      ? 'not_started'
      : mastery >= 75 ? 'strong'
      : mastery >= 45 ? 'partial'
      : 'weak';

    // Compute a "parent" for backward compat with the tree-based DependencyGraph.
    // For DAG nodes with multiple parents, pick the first. The new DAG renderer
    // will use the edges[] array directly and ignore this field.
    const parents = inEdges[n.id] || [];
    const parentName = parents.length > 0 ? idToName[parents[0]] || 'none' : 'none';
    const isRoot   = parents.length === 0;

    return {
      // Core fields (match DependencyGraph.jsx expectations)
      name:        n.name,
      status,
      score:       mastery,
      parent:      parentName,
      isRoot,
      // Concept metadata (new)
      conceptId:   n.id,
      type:        n.type       || 'Concept',
      difficulty:  n.difficulty || 2,
      importance:  n.importance || 3,
      // description for Detail Panel
      description: _conceptDescription(n.name, status, m),
    };
  });

  // ── Upstream weakness propagation ────────────────────────────────
  // For each weak/partial node, walk backwards through prerequisites.
  // Stop at the FIRST weak ancestor (not the absolute root).
  const weakSet = new Set(
    enriched.filter(n => n.status === 'weak' || n.status === 'partial').map(n => n.conceptId)
  );

  const rootCauseIds = new Set();
  for (const wId of weakSet) {
    const found = _findNearestWeakAncestor(wId, inEdges, weakSet);
    if (found && found !== wId) {
      // Check that the found ancestor has no weaker prerequisite of its own
      // (stop at first, don't cascade all the way to "Soil")
      const grandparent = _findNearestWeakAncestor(found, inEdges, weakSet);
      if (!grandparent || grandparent === found) {
        rootCauseIds.add(found);
      }
    }
  }

  // Mark root-cause nodes
  enriched.forEach(n => {
    n.isRootCause = rootCauseIds.has(n.conceptId);
  });

  // ── Topological sort for learning path ───────────────────────────
  const topoOrder   = _topoSort(rawNodes.map(n => n.id), outEdges);
  const recommended = topoOrder
    .map(id => enriched.find(n => n.conceptId === id))
    .filter(n => n && (n.status === 'weak' || n.status === 'not_started' || n.status === 'partial'))
    .map(n => ({ topic: n.name, conceptId: n.conceptId, score: n.score, status: n.status }));

  // ── Scores map ───────────────────────────────────────────────────
  const scores = {};
  enriched.forEach(n => { if (n.score !== null) scores[n.name] = n.score; });

  const nonRoot    = enriched.filter(n => !n.isRoot);
  const totalCount = enriched.length;
  const quizzedCount = enriched.filter(n => n.score !== null).length;

  return {
    nodes:           enriched,
    edges,
    scores,
    weakNodes:       enriched.filter(n => n.status === 'weak' || n.status === 'partial'),
    rootCauses:      [...rootCauseIds].map(id => idToName[id]).filter(Boolean),
    recommendedPath: recommended,
    totalCount,
    quizzedCount,
    avgScore: quizzedCount > 0
      ? Math.round(enriched.filter(n=>n.score!==null).reduce((s,n)=>s+n.score,0)/quizzedCount)
      : null,
  };
}

/* ── Private helpers ────────────────────────────────────────────────── */

/** Walk inEdges backward from `startId`, return nearest weak ancestor id or null */
function _findNearestWeakAncestor(startId, inEdges, weakSet) {
  const prereqs = inEdges[startId] || [];
  for (const pid of prereqs) {
    if (weakSet.has(pid)) return pid;
  }
  // One level deeper — breadth-first, stop at first hit
  for (const pid of prereqs) {
    const grandPrereqs = inEdges[pid] || [];
    for (const gid of grandPrereqs) {
      if (weakSet.has(gid)) return gid;
    }
  }
  return null;
}

/** Kahn's algorithm topological sort — returns [id, ...] in prerequisite order */
function _topoSort(ids, outEdges) {
  // Count in-degrees
  const inDeg = {};
  ids.forEach(id => { inDeg[id] = 0; });
  ids.forEach(id => {
    for (const t of (outEdges[id] || [])) {
      if (ids.includes(t)) inDeg[t] = (inDeg[t] || 0) + 1;
    }
  });
  const queue  = ids.filter(id => inDeg[id] === 0);
  const result = [];
  while (queue.length) {
    const cur = queue.shift();
    result.push(cur);
    for (const next of (outEdges[cur] || [])) {
      inDeg[next]--;
      if (inDeg[next] === 0) queue.push(next);
    }
  }
  // Append any remaining (cycle leftovers)
  ids.forEach(id => { if (!result.includes(id)) result.push(id); });
  return result;
}

function _conceptDescription(name, status, masteryEntry = {}) {
  const { correct = 0, incorrect = 0 } = masteryEntry;
  const total = correct + incorrect;
  if (status === 'strong')      return `"${name}" is well understood. Keep practising to maintain mastery.`;
  if (status === 'partial')     return `"${name}" is partially understood (${correct}/${total} correct). Focus on the gaps.`;
  if (status === 'weak')        return `"${name}" needs focused revision — ${incorrect} incorrect answer${incorrect !== 1 ? 's' : ''} recorded.`;
  return `Complete a quiz on "${name}" to measure your understanding.`;
}

function _emptyConceptResult() {
  return { nodes: [], edges: [], scores: {}, weakNodes: [], rootCauses: [], recommendedPath: [], totalCount: 0, quizzedCount: 0, avgScore: null };
}

