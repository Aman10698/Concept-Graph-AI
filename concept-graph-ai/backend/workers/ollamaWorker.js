/**
 * ollamaWorker.js
 *
 * Runs the ENTIRE Ollama AI pipeline in an isolated child process.
 * Input  : JSON via process.argv[2] → { task, payload }
 * Output : ONE JSON line on stdout, then process exits.
 *
 * Why a worker?
 *   Each Ollama call (extractTopics, analyzeDependencies, generateQuestions)
 *   buffers the full LLM response string plus all intermediate JS objects in the
 *   V8 heap. For a real document these accumulate to 1-2 GB in the server
 *   process. Running inside a worker means:
 *     • The server heap stays < 100 MB at idle.
 *     • When this worker exits the OS reclaims ALL its memory immediately —
 *       no reliance on V8 GC or heap fragmentation.
 *
 * Supported tasks:
 *   extractTopics        → { text }
 *   extractMindMap       → { text }   ← NEW: heading-based mind map (NCERT chapters)
 *   analyzeDependencies  → { topics, docText }
 *   generateQuestions    → { topicsData, docText }
 *   evaluateAnswer       → { question, answer, topic }
 *   analyzeWeaknesses    → { evaluation, allTopics }
 *   bloomQuestions       → { concept, bloomLevel, parentTopic, n, ragContext, quizType }
 *   bloomEvaluate        → { concept, question, answer, bloomLevel, ragContext }
 *   extractConcepts      → { text }
 *   generatePrerequisiteEdges → { concepts }
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// ⚠️  CRITICAL: Redirect ALL console output to stderr.
// This worker communicates with the server via stdout (a pipe).
// Any console.log/warn/error that goes to stdout would be captured by the
// server's `stdout += chunk` buffer, growing it to GB for large topic lists.
// Redirecting to stderr keeps the pipe clean and the server heap tiny.
const _stderr = (...args) => process.stderr.write(args.join(' ') + '\n');
console.log   = _stderr;
console.warn  = _stderr;
console.error = _stderr;
console.info  = _stderr;

const ollamaService = require('../services/ollamaService');

/* ── stdout helpers ─────────────────────────────────────────────── */
const succeed = (data) => {
  process.stdout.write(JSON.stringify({ success: true, data }) + '\n');
  process.exit(0);
};
const fail = (msg) => {
  process.stdout.write(JSON.stringify({ success: false, error: String(msg) }) + '\n');
  process.exit(1);
};

/* ── parse input: stdin (primary) or process.argv[2] (legacy fallback) ──── */
// Primary path: JSON payload written to stdin by ollamaWorkerService.
// argv[2] fallback: handles any legacy/edge-case invocation.
const _runWithInput = (rawJson) => {
  let input;
  try {
    input = JSON.parse(rawJson || '{}');
  } catch (e) {
    fail('Invalid JSON input: ' + e.message);
    return;
  }

  const { task, payload = {} } = input;

  /* ── dispatch ───────────────────────────────────────────────────── */
  (async () => {
  try {
    switch (task) {

      case 'extractTopics': {
        const result = await ollamaService.extractTopicsAdvanced(payload.text);
        succeed(result);
        break;
      }

      case 'analyzeDependencies': {
        const result = await ollamaService.analyzeDependencies(
          payload.topics,
          payload.docText || '',
          payload.subject || ''
        );
        succeed(result);
        break;
      }

      case 'generateQuestions': {
        const topicObjects = (payload.topicsData || []).map(t =>
          typeof t === 'string' ? { name: t } : t
        );
        const questions = await ollamaService.generateDocumentQuestions(
          topicObjects,
          (payload.docText || '').slice(0, 2000),
          payload.questionsPerTopic || 3,
          payload.seed || 0
        );
        succeed({ questions });
        break;
      }

      case 'evaluateAnswer': {
        // Inline evaluation — use a simple prompt rather than importing the full service
        const prompt = `You are a strict academic evaluator.
Question: "${payload.question}"
Topic: "${payload.topic}"
Student answer: "${payload.answer}"

Rate this answer as exactly one of: strong / partial / weak
Then give 2-3 sentences of specific feedback.

Respond in this exact JSON format:
{"rating":"strong|partial|weak","score":0-100,"feedback":"...","confidence":0-100}`;

        const raw = await ollamaService.generateText(prompt, { temperature: 0.2, numPredict: 300 });

        // Try to parse JSON from response
        let evaluation;
        try {
          const m = raw.match(/\{[\s\S]*\}/);
          evaluation = m ? JSON.parse(m[0]) : null;
        } catch (_) { evaluation = null; }

        if (!evaluation) {
          // Fallback: keyword detection
          const lower = raw.toLowerCase();
          const rating = lower.includes('strong') ? 'strong' : lower.includes('partial') ? 'partial' : 'weak';
          evaluation = { rating, score: rating === 'strong' ? 85 : rating === 'partial' ? 55 : 30, feedback: raw.slice(0, 300), confidence: 70 };
        }

        succeed(evaluation);
        break;
      }

      case 'bloomQuestions': {
        const { generateBloomQuestions, generateMCQQuestions } = require('../services/bloomService');
        const fn = payload.quizType === 'objective' ? generateMCQQuestions : generateBloomQuestions;
        const questions = await fn(
          payload.concept,
          payload.bloomLevel,
          payload.parentTopic || '',
          payload.n || 3,
          payload.ragContext || ''
        );
        succeed({ questions });
        break;
      }

      case 'bloomEvaluate': {
        const { evaluateBloomAnswer } = require('../services/bloomService');
        const result = await evaluateBloomAnswer(
          payload.concept,
          payload.question,
          payload.answer,
          payload.bloomLevel,
          payload.ragContext || ''
        );
        succeed(result);
        break;
      }

      case 'analyzeWeakness': {
        // payload.weakNodes and payload.scores come from depGraphService (deterministic)
        // Ollama only explains — never invents graph structure
        const result = await ollamaService.analyzeWeakness(
          payload.weakTopic,
          payload.weakNodes  || [],
          payload.scores     || {}
        );
        succeed(result);
        break;
      }

      case 'generateLearningPath': {
        const result = await ollamaService.generateLearningPath(
          payload.weakTopics || [],
          payload.allTopics || [],
          payload.dependencies || [],
          payload.extractedText || ''
        );
        succeed(result);
        break;
      }

      case 'extractConcepts': {
        const result = await ollamaService.extractConcepts(payload.text);
        succeed(result);
        break;
      }

      case 'generatePrerequisiteEdges': {
        const result = await ollamaService.generatePrerequisiteEdges(payload.concepts);
        succeed(result);
        break;
      }

      // ── NEW: heading-based mind map for NCERT / chapter-style documents ──
      case 'extractMindMap': {
        const result = await ollamaService.extractMindMapStructure(payload.text);
        succeed(result);
        break;
      }

      default:
        fail(`Unknown task: "${task}"`);
    }
  } catch (err) {
    fail(err.message || String(err));
  }
  })();
}; // end _runWithInput

/* ── Read payload from stdin, fall back to argv[2] ─────────────── */
// stdin is preferred (no size limit). argv[2] is kept for safety.
if (process.argv[2]) {
  // Legacy / direct invocation — use argv[2] immediately
  _runWithInput(process.argv[2]);
} else {
  // Normal path: read JSON payload from stdin (written by ollamaWorkerService)
  let rawInput = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { rawInput += chunk; });
  process.stdin.on('end', () => { _runWithInput(rawInput); });
}
