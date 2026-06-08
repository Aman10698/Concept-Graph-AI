/**
 * textExtractionService.js
 *
 * Thin orchestration layer — delegates all extraction work to a
 * CHILD PROCESS (workers/extractWorker.js) via child_process.spawn().
 *
 * Why spawn() instead of fork()?
 *   fork() uses an IPC channel. On Windows, when the child crashes with
 *   a FATAL OOM error, the broken IPC channel can kill the parent too.
 *   spawn() communicates via stdout (plain JSON line) — if the child
 *   crashes, the pipe simply closes and we get a non-zero exit code.
 *   Zero shared state, zero risk of cascading crash.
 *
 * Why a child process at all?
 *   pdfjs-dist builds huge in-memory structures when parsing PDFs.
 *   Even with page.cleanup() the process still grows over time because
 *   Node/V8 may not return memory to the OS between requests.
 *   Running in a child process guarantees that ALL memory is freed
 *   by the OS on process exit — regardless of GC behaviour.
 */

'use strict';

const { spawn } = require('child_process');
const fs        = require('fs');
const path      = require('path');

const WORKER_PATH    = path.join(__dirname, '../workers/extractWorker.js');
const WORKER_TIMEOUT = 4 * 60 * 1000; // 4 minute hard ceiling

/* ═══════════════════════════════════════════════════════════════════
   runExtractionWorker
   Spawns the worker, collects its stdout, parses one JSON line.
═══════════════════════════════════════════════════════════════════ */
const runExtractionWorker = (filePath, mimeType) =>
  new Promise((resolve, reject) => {
    const arg = JSON.stringify({ filePath, mimeType });

    // Give the worker its own 1.5 GB heap — completely isolated from the server.
    // OCR is now one page at a time so peak usage is ~200-300 MB; 1536 is generous.
    const child = spawn(
      process.execPath, // same `node` binary
      ['--max-old-space-size=1536', WORKER_PATH, arg],
      {
        stdio: ['ignore', 'pipe', 'pipe'], // both stdout and stderr piped
        windowsHide: true,
      }
    );

    let stdout   = '';
    let settled  = false;
    const MAX_STDOUT = 10 * 1024 * 1024; // 10 MB cap (extracted text shouldn't exceed this)

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
      try { child.kill('SIGKILL'); } catch {}
      reject(err);
    };

    const timer = setTimeout(
      () => abort(new Error(`Extraction worker timed out after ${WORKER_TIMEOUT / 1000}s`)),
      WORKER_TIMEOUT
    );

    // Forward worker stderr (pdfjs/tesseract logs) to server's terminal
    child.stderr.on('data', (chunk) => process.stderr.write(chunk));

    child.stdout.on('data', (chunk) => {
      if (stdout.length < MAX_STDOUT) {
        stdout += chunk.toString();
      } else {
        abort(new Error('Extraction worker stdout exceeded 10 MB safety cap'));
      }
    });

    child.stdout.on('end', () => {
      if (settled) return;
      const line = stdout.trim().split('\n').pop(); // last JSON line
      if (!line) return abort(new Error('Worker produced no output'));
      try {
        const msg = JSON.parse(line);
        if (msg.success) {
          done(msg);
        } else {
          abort(new Error(msg.error || 'Worker reported failure'));
        }
      } catch {
        abort(new Error(`Worker output is not valid JSON: ${line.slice(0, 200)}`));
      }
    });

    child.on('error', (err) => abort(new Error(`Failed to start worker: ${err.message}`)));

    child.on('exit', (code, signal) => {
      if (!settled && code !== 0) {
        abort(new Error(
          code === null
            ? `Worker was killed (signal=${signal}) — likely ran out of memory`
            : `Worker exited with code ${code}`
        ));
      }
    });
  });

/* ═══════════════════════════════════════════════════════════════════
   Public API
═══════════════════════════════════════════════════════════════════ */

/**
 * extractText(filePath, mimeType)
 * Returns { success, text, pages?, ocrFallback? }
 */
const extractText = async (filePath, mimeType) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  console.log(`\n📥 Starting extraction`);
  console.log(`   Path: ${filePath}`);
  console.log(`   Type: ${mimeType}`);
  console.log(`   Spawning isolated extraction worker…`);

  const result = await runExtractionWorker(filePath, mimeType);

  const label = result.ocrFallback ? 'OCR extraction' : 'Extraction';
  const extra = result.pages ? ` from ${result.pages} pages` : '';
  console.log(`✅ ${label} complete: ${result.text.length} chars${extra}`);

  return result;
};

/* Backwards-compat stubs */
const extractTextFromPDF       = (fp) => extractText(fp, 'application/pdf');
const extractTextFromImage     = (fp) => extractText(fp, 'image/jpeg');
const extractTextFromPlainText = (fp) => extractText(fp, 'text/plain');
const cleanupTesseract         = async () => { /* noop — worker self-cleans */ };
const initTesseract            = async () => { /* noop — worker self-inits  */ };

module.exports = {
  extractText,
  extractTextFromPDF,
  extractTextFromImage,
  extractTextFromPlainText,
  cleanupTesseract,
  initTesseract,
};