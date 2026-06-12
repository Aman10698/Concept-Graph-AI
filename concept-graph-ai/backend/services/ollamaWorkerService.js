/**
 * ollamaWorkerService.js
 *
 * Thin orchestration layer — spawns ollamaWorker.js as a child process
 * for every AI task, exactly like textExtractionService does for PDF parsing.
 *
 * WHY spawn instead of direct calls:
 *   Ollama responses are large (thousands of tokens). Buffering them in the
 *   server process fills the V8 heap. Running in a worker means:
 *     • Server heap stays < 100 MB at all times.
 *     • Worker heap (up to 1536 MB) is freed by the OS on exit.
 *     • Multiple sequential requests don't accumulate — each worker is fresh.
 */

'use strict';

const { spawn } = require('child_process');
const path      = require('path');

const WORKER_PATH    = path.join(__dirname, '../workers/ollamaWorker.js');
const WORKER_TIMEOUT = 8 * 60 * 1000; // 8 minutes (LLM can be slow)

/**
 * runOllamaWorker(task, payload)
 * Spawns the worker, waits for its JSON result, returns { data }.
 */
const runOllamaWorker = (task, payload) =>
  new Promise((resolve, reject) => {
    const arg = JSON.stringify({ task, payload });

    const child = spawn(
      process.execPath,
      ['--max-old-space-size=3072', WORKER_PATH],
      {
        stdio: ['pipe', 'pipe', 'pipe'], // stdin piped so we can write the payload
        windowsHide: true,
        env: { ...process.env }, // pass .env vars through
      }
    );

    // Write payload to stdin then close it so the worker knows input is complete
    child.stdin.write(arg, 'utf8');
    child.stdin.end();

    let stdout  = '';
    let settled = false;
    const MAX_STDOUT = 50 * 1024 * 1024; // 50 MB safety cap

    const done = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const abort = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { child.kill('SIGKILL'); } catch (_) {}
      reject(err);
    };

    const timer = setTimeout(
      () => abort(new Error(`Ollama worker timed out after ${WORKER_TIMEOUT / 1000}s`)),
      WORKER_TIMEOUT
    );

    // Forward worker stderr (console output) to the server's stderr so it shows in terminal
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));

    child.stdout.on('data', (chunk) => {
      if (stdout.length < MAX_STDOUT) {
        stdout += chunk.toString();
      } else {
        // Buffer overrun — kill the worker and reject
        abort(new Error('Ollama worker stdout exceeded 50 MB safety cap'));
      }
    });

    child.stdout.on('end', () => {
      if (settled) return;
      const line = stdout.trim().split('\n').pop();
      if (!line) return abort(new Error('Ollama worker produced no output'));
      try {
        const msg = JSON.parse(line);
        if (msg.success) {
          done(msg.data);
        } else {
          abort(new Error(msg.error || 'Ollama worker reported failure'));
        }
      } catch {
        abort(new Error(`Ollama worker output is not valid JSON: ${line.slice(0, 200)}`));
      }
    });

    child.on('error', (err) => abort(new Error(`Failed to start Ollama worker: ${err.message}`)));

    child.on('exit', (code, signal) => {
      if (!settled && code !== 0) {
        abort(new Error(
          code === null
            ? `Ollama worker was killed (signal=${signal}) — likely OOM inside worker`
            : `Ollama worker exited with code ${code}`
        ));
      }
    });
  });

/* ── Public API — mirrors ollamaService exports ─────────────────── */

const extractTopicsAdvanced = async (text) => {
  console.log('🔀 [Worker] Extracting topics...');
  const result = await runOllamaWorker('extractTopics', { text });
  console.log(`✅ [Worker] Topics done: ${(result?.topics || []).length} topics`);
  return result;
};

const analyzeDependencies = async (topics, docText = '', subject = '') => {
  console.log('🔀 [Worker] Analyzing dependencies...');
  const result = await runOllamaWorker('analyzeDependencies', { topics, docText, subject });
  console.log(`✅ [Worker] Dependencies done: ${(result?.nodes || []).length} nodes, ${(result?.edges || []).length} edges`);
  return result;
};


const generateDocumentQuestions = async (topicsData, docText = '', questionsPerTopic = 3, seed = 0) => {
  console.log('🔀 [Worker] Generating questions...');
  const result = await runOllamaWorker('generateQuestions', { topicsData, docText, questionsPerTopic, seed });
  const questions = result?.questions || [];
  console.log(`✅ [Worker] Questions done: ${questions.length} questions`);
  return questions;
};

const evaluateAnswer = async (question, answer, topic) => {
  console.log('🔀 [Worker] Evaluating answer...');
  const result = await runOllamaWorker('evaluateAnswer', { question, answer, topic });
  console.log(`✅ [Worker] Evaluation done: ${result?.rating}`);
  return result;
};

const generateBloomQuestions = async (concept, bloomLevel, parentTopic = '', n = 3, ragContext = '') => {
  console.log(`🔀 [Worker] Bloom questions: ${concept} @ ${bloomLevel}`);
  const result = await runOllamaWorker('bloomQuestions', { concept, bloomLevel, parentTopic, n, ragContext, quizType: 'subjective' });
  return result?.questions || [];
};

const generateMCQQuestions = async (concept, bloomLevel, parentTopic = '', n = 3, ragContext = '') => {
  console.log(`🔀 [Worker] MCQ questions: ${concept} @ ${bloomLevel}`);
  const result = await runOllamaWorker('bloomQuestions', { concept, bloomLevel, parentTopic, n, ragContext, quizType: 'objective' });
  return result?.questions || [];
};

const evaluateBloomAnswer = async (concept, question, answer, bloomLevel, ragContext = '') => {
  console.log(`🔀 [Worker] Bloom evaluate: ${concept} @ ${bloomLevel}`);
  const result = await runOllamaWorker('bloomEvaluate', { concept, question, answer, bloomLevel, ragContext });
  return result;
};

const generateText = async (prompt, options = {}) => {
  // Direct call — only used for simple one-off prompts, not the heavy pipeline
  const ollamaService = require('./ollamaService');
  return ollamaService.generateText(prompt, options);
};

const testOllamaConnection = async () => {
  const ollamaService = require('./ollamaService');
  return ollamaService.testOllamaConnection();
};

const analyzeWeakness = async (weakTopic, weakNodes, scores) => {
  console.log(`🔀 [Worker] Analyzing weakness: ${weakTopic}`);
  const result = await runOllamaWorker('analyzeWeakness', { weakTopic, weakNodes, scores });
  return result;
};

const generateLearningPath = async (weakTopics, allTopics, dependencies, extractedText = '') => {
  console.log(`🔀 [Worker] Generating learning path for: ${weakTopics.join(', ')}`);
  const result = await runOllamaWorker('generateLearningPath', { weakTopics, allTopics, dependencies, extractedText });
  return result;
};

const extractConcepts = async (text) => {
  console.log('🔀 [Worker] Extracting concepts...');
  const result = await runOllamaWorker('extractConcepts', { text });
  console.log(`✅ [Worker] Concepts done: ${(result?.concepts || []).length} concepts`);
  return result;
};

const generatePrerequisiteEdges = async (concepts) => {
  console.log(`🔀 [Worker] Generating prerequisite edges for ${(concepts || []).length} concepts...`);
  const result = await runOllamaWorker('generatePrerequisiteEdges', { concepts });
  console.log(`✅ [Worker] Edges done: ${(result?.edges || []).length} edges`);
  return result;
};

// ── NEW: heading-based mind map extraction (NCERT / chapter-style documents) ──
const extractMindMapStructure = async (text) => {
  console.log('🔀 [Worker] Extracting mind map structure...');
  const result = await runOllamaWorker('extractMindMap', { text });
  console.log(
    `✅ [Worker] Mind map done: ${(result?.nodes || []).length} nodes, ` +
    `${(result?.edges || []).length} edges — "${result?.chapterTitle || ''}"` 
  );
  return result;
};

const extractAtomicConcepts = async (topicName) => {
  console.log(`🔀 [Worker] Extracting atomic concepts for: ${topicName}`);
  const result = await runOllamaWorker('extractAtomicConcepts', { topicName });
  return result;
};

const verifyDependencyEdge = async (source, target) => {
  console.log(`🔀 [Worker] Verifying edge: ${source} -> ${target}`);
  const result = await runOllamaWorker('verifyDependencyEdge', { source, target });
  return result;
};

const assignBloomLevel = async (topicName) => {
  console.log(`🔀 [Worker] Assigning Bloom level for: ${topicName}`);
  const result = await runOllamaWorker('assignBloomLevel', { topicName });
  return result;
};

module.exports = {
  extractTopicsAdvanced,
  extractMindMapStructure,     // ← new: NCERT/chapter heading-based mind map
  extractConcepts,
  generatePrerequisiteEdges,
  analyzeDependencies,
  generateDocumentQuestions,
  evaluateAnswer,
  generateBloomQuestions,
  generateMCQQuestions,
  evaluateBloomAnswer,
  analyzeWeakness,
  generateLearningPath,
  generateText,
  testOllamaConnection,
  extractAtomicConcepts,
  verifyDependencyEdge,
  assignBloomLevel,
};
