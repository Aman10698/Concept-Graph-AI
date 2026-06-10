/**
 * visionService.js
 *
 * Sends page images to an Ollama vision model (qwen2.5-vl / llama3.2-vision / llava)
 * and returns an educational description of diagrams, tables, flowcharts and figures.
 *
 * Used by pdfExtractorService during multimodal PDF ingestion.
 */

const fs = require('fs');

const OLLAMA_BASE   = process.env.OLLAMA_URL || 'http://localhost:11434';

// Priority order — first available model wins
const VISION_MODEL_PRIORITY = [
  'qwen2.5-vl',
  'llama3.2-vision',
  'llava',
  'moondream',
];

let _cachedVisionModel = null; // resolved once per server lifecycle

/* ── Detect which vision model is available ──────────────────────── */
const detectVisionModel = async () => {
  if (_cachedVisionModel !== null) return _cachedVisionModel; // '' means none found

  try {
    const res  = await fetch(`${OLLAMA_BASE}/api/tags`);
    if (!res.ok) { _cachedVisionModel = ''; return ''; }

    const json     = await res.json();
    const available = (json.models || []).map(m => m.name.toLowerCase());

    for (const preferred of VISION_MODEL_PRIORITY) {
      const match = available.find(m => m.startsWith(preferred.split(':')[0]));
      if (match) {
        _cachedVisionModel = match;
        console.log(`[Vision] ✅ Vision model available: ${match}`);
        return match;
      }
    }

    console.warn('[Vision] ⚠️  No vision model found. Image analysis disabled.');
    _cachedVisionModel = '';
    return '';
  } catch (err) {
    console.warn('[Vision] Could not query Ollama for vision model:', err.message);
    _cachedVisionModel = '';
    return '';
  }
};

/* ── Describe an educational image ──────────────────────────────── */
/**
 * Sends an image to Ollama vision and returns educational study notes.
 *
 * @param {Buffer|string} imageInput  - Buffer or absolute file path
 * @returns {string|null}             - Description text, or null on failure
 */
const describeImage = async (imageInput) => {
  try {
    const model = await detectVisionModel();
    if (!model) return null;

    // Convert to base64
    let base64;
    if (Buffer.isBuffer(imageInput)) {
      base64 = imageInput.toString('base64');
    } else if (typeof imageInput === 'string') {
      base64 = fs.readFileSync(imageInput).toString('base64');
    } else {
      return null;
    }

    const prompt =
`You are analyzing an educational image from a student's study notes.

Extract the following:
1. All visible text, labels, and annotations
2. Concepts and topics shown in the image
3. Relationships and connections between elements
4. What type of diagram/figure this is (flowchart, table, architecture, process diagram, etc.)
5. A detailed educational explanation a student can learn from

Rules:
- Focus ONLY on educational content
- Do NOT comment on image quality or resolution
- Be specific and detailed — list every concept shown
- Use bullet points and structured text
- Return comprehensive, study-ready notes`;

    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        images:  [base64],
        stream:  false,
        options: { temperature: 0.15, num_predict: 800 },
      }),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      console.warn(`[Vision] Ollama returned ${res.status}: ${txt.slice(0, 120)}`);
      return null;
    }

    const json        = await res.json();
    const description = (json.response || '').trim();

    // Discard the parsed JSON to free heap
    json.response = null;

    return description.length > 30 ? description : null;

  } catch (err) {
    console.warn('[Vision] describeImage failed:', err.message);
    return null;
  }
};

/* ── Reset cached model (testing) ───────────────────────────────── */
const resetVisionCache = () => { _cachedVisionModel = null; };

module.exports = { describeImage, detectVisionModel, resetVisionCache };
