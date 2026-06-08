/**
 * Session Service — frontend
 * One Session = one uploaded syllabus with its own topics, questions, and progress.
 */

const API_BASE = 'http://localhost:5000/api';

/* ─── create a new session (called when syllabus is uploaded) ── */
export const createSession = async (userId, { title, subject, extractedText, topicsData }) => {
  if (!userId) return null;
  try {
    const res  = await fetch(`${API_BASE}/sessions/${encodeURIComponent(userId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, subject, extractedText, topicsData }),
    });
    const json = await res.json();
    if (json.success) {
      // Store active session ID in localStorage for quick lookups
      localStorage.setItem('activeSessionId', json.sessionId);
      return json.sessionId;
    }
    return null;
  } catch (err) {
    console.warn('[Session] createSession failed:', err.message);
    return null;
  }
};

/* ─── update AI-generated data after questions/deps are ready ── */
export const updateSessionData = async (sessionId, { questionsData, dependencyData, topicDepGraphs } = {}) => {
  if (!sessionId) return;
  try {
    await fetch(`${API_BASE}/sessions/${sessionId}/data`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionsData, dependencyData, topicDepGraphs }),
    });
  } catch (err) {
    console.warn('[Session] updateSessionData failed:', err.message);
  }
};

/* ─── merge evaluation scores for a session ──────────────────── */
export const saveSessionEvaluation = async (sessionId, evaluationData) => {
  if (!sessionId || !evaluationData) return;
  try {
    await fetch(`${API_BASE}/sessions/${sessionId}/evaluation`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ evaluationData }),
    });
  } catch (err) {
    console.warn('[Session] saveSessionEvaluation failed:', err.message);
  }
};

/* ─── list all sessions for a user ────────────────────────── */
export const getUserSessions = async (userId) => {
  if (!userId) return [];
  const res  = await fetch(`${API_BASE}/sessions/user/${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error(`Server returned ${res.status} for sessions list`);
  const json = await res.json();
  if (!json.success) throw new Error(json.message || 'Failed to load sessions');
  return json.sessions ?? [];
};

/* ─── load full session data ──────────────────────────────────── */
export const loadSession = async (sessionId) => {
  if (!sessionId) return null;
  try {
    const res  = await fetch(`${API_BASE}/sessions/${sessionId}`);
    const json = await res.json();
    return json.success ? json.data : null;
  } catch (err) {
    console.warn('[Session] loadSession failed:', err.message);
    return null;
  }
};

/* ─── delete a session ───────────────────────────────────────── */
export const deleteSession = async (sessionId) => {
  if (!sessionId) return;
  try {
    await fetch(`${API_BASE}/sessions/${sessionId}`, { method: 'DELETE' });
  } catch (err) {
    console.warn('[Session] deleteSession failed:', err.message);
  }
};

/* ─── set active session in localStorage + optionally load data ─ */
export const activateSession = async (sessionId) => {
  localStorage.setItem('activeSessionId', sessionId);
  const data = await loadSession(sessionId);
  if (!data) return null;

  // Write all session data to localStorage so existing hooks still work
  if (data.topicsData)     localStorage.setItem('learningTopicsData',    JSON.stringify(data.topicsData));
  if (data.questionsData)  localStorage.setItem('learningQuestionsData', JSON.stringify(data.questionsData));
  if (data.dependencyData) localStorage.setItem('learningDependencyData',JSON.stringify(data.dependencyData));
  if (data.evaluationData) localStorage.setItem('learningEvaluationData',JSON.stringify(data.evaluationData));
  // Restore per-session dep graphs so DepGraphPage can show them
  localStorage.setItem(`topicDepGraphs_${data.sessionId}`, JSON.stringify(data.topicDepGraphs || {}));
  // Keep a global copy for backwards compat (ConceptGraphPage reads this)
  if (Object.keys(data.topicDepGraphs || {}).length > 0) {
    localStorage.setItem('topicDepGraphs', JSON.stringify(data.topicDepGraphs));
  }

  return data;
};

export const getActiveSessionId = () => localStorage.getItem('activeSessionId');
