/**
 * MongoDB progress persistence service.
 * Saves/loads topics, questions, evaluations, and dependency data
 * to/from the backend (MongoDB via the /api/progress routes).
 *
 * Falls back gracefully if the backend is unavailable.
 */
import { setEvalStorage } from '../utils/evalBus';

const API_BASE = 'http://localhost:5000/api';


/* ─── save full session data ─────────────────────────────────── */
export const saveProgressToMongo = async (userId, data = {}) => {
  if (!userId) return { success: false, error: 'No userId' };
  try {
    const res = await fetch(`${API_BASE}/progress/${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.warn('[MongoDB] saveProgressToMongo failed (backend down?):', err.message);
    return { success: false, error: err.message };
  }
};

/* ─── load full session data ─────────────────────────────────── */
export const loadProgressFromMongo = async (userId) => {
  if (!userId) return null;
  try {
    const res  = await fetch(`${API_BASE}/progress/${encodeURIComponent(userId)}`);
    const json = await res.json();
    if (json.success && json.data) return json.data;
    return null;
  } catch (err) {
    console.warn('[MongoDB] loadProgressFromMongo failed (backend down?):', err.message);
    return null;
  }
};

/* ─── merge evaluation data only ─────────────────────────────── */
export const mergeEvaluationToMongo = async (userId, evaluationData) => {
  if (!userId || !evaluationData) return { success: false };
  try {
    const res = await fetch(
      `${API_BASE}/progress/${encodeURIComponent(userId)}/evaluation`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evaluationData }),
      }
    );
    return await res.json();
  } catch (err) {
    console.warn('[MongoDB] mergeEvaluationToMongo failed:', err.message);
    return { success: false, error: err.message };
  }
};

/* ─── helpers that write to both localStorage AND MongoDB ─────── */

/**
 * Persist topics + questions + dependencies (called after AI processing).
 */
export const persistSessionData = async (userId, { topicsData, questionsData, dependencyData } = {}) => {
  // 1. Always write to localStorage (instant, offline)
  if (topicsData)    localStorage.setItem('learningTopicsData',    JSON.stringify(topicsData));
  if (questionsData) localStorage.setItem('learningQuestionsData', JSON.stringify(questionsData));
  if (dependencyData)localStorage.setItem('learningDependencyData',JSON.stringify(dependencyData));

  // 2. Write to MongoDB asynchronously (don't block UI)
  if (userId) {
    saveProgressToMongo(userId, { topicsData, questionsData, dependencyData })
      .then(r => { if (!r.success) console.warn('[MongoDB] session save failed:', r.error); })
      .catch(() => {});
  }
};

/**
 * Persist evaluation data (called after every quiz answer).
 */
export const persistEvaluation = async (userId, evaluationData) => {
  // 1. localStorage via evalBus so all same-tab listeners are notified
  setEvalStorage('learningEvaluationData', JSON.stringify(evaluationData));

  // 2. MongoDB (merge, don't replace)
  if (userId) {
    mergeEvaluationToMongo(userId, evaluationData)
      .catch(() => {});
  }
};


/**
 * Load session data on app start.
 * Strategy: use localStorage immediately (fast), then check MongoDB.
 * If MongoDB has newer data, update localStorage and return it.
 */
export const loadSessionData = async (userId) => {
  // Always start with localStorage (instant)
  const local = {
    topicsData:     tryParse('learningTopicsData'),
    questionsData:  tryParse('learningQuestionsData'),
    evaluationData: tryParse('learningEvaluationData') || {},
    dependencyData: tryParse('learningDependencyData'),
  };

  if (!userId) return local; // not logged in — localStorage only

  // Try MongoDB in background
  const remote = await loadProgressFromMongo(userId);
  if (!remote) return local;

  // Merge: prefer MongoDB data (more authoritative)
  const merged = {
    topicsData:     remote.topicsData     || local.topicsData,
    questionsData:  remote.questionsData  || local.questionsData,
    evaluationData: Object.keys(remote.evaluationData || {}).length
                     ? remote.evaluationData
                     : local.evaluationData,
    dependencyData: remote.dependencyData || local.dependencyData,
  };

  // Back-fill localStorage from MongoDB
  if (merged.topicsData)    localStorage.setItem('learningTopicsData',    JSON.stringify(merged.topicsData));
  if (merged.questionsData) localStorage.setItem('learningQuestionsData', JSON.stringify(merged.questionsData));
  if (merged.evaluationData && Object.keys(merged.evaluationData).length)
    setEvalStorage('learningEvaluationData', JSON.stringify(merged.evaluationData));
  if (merged.dependencyData)localStorage.setItem('learningDependencyData',JSON.stringify(merged.dependencyData));

  return merged;
};

function tryParse(key) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
  catch { return null; }
}
