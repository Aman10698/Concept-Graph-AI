import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import FileUpload from '../components/FileUpload';
import { extractTextFromFile } from '../services/textExtractionService';
import { useTextExtraction } from '../hooks/useTextExtraction';
import { useTopicExtraction } from '../hooks/useTopicExtraction';
import { useErrorHandler } from '../hooks/useErrorHandler';

import { useQuestionGeneration } from '../hooks/useQuestionGeneration';
import { useDependencyAnalysis } from '../hooks/useDependencyAnalysis';
import { useWeaknessAnalysis } from '../hooks/useWeaknessAnalysis';
import { useAuth } from '../context/AuthContext';
import MindMapViewer from '../components/MindMapViewer';
// eslint-disable-next-line no-unused-vars
import QuestionsDisplay from '../components/QuestionsDisplay';
import QuestionPractice from '../components/QuestionPractice';
import WeaknessTraceViewer from '../components/WeaknessTraceViewer';
// eslint-disable-next-line no-unused-vars
import DependencyViewer from '../components/DependencyViewer';
import DependencyGraph from '../components/DependencyGraph';
import ErrorDisplay from '../components/ErrorDisplay';
import BloomPanel from '../components/BloomPanel';
import RootCauseGraph from '../components/RootCauseGraph';

// persistGraphData removed — graph data is persisted via the session flow (MongoDB)
import { persistSessionData, persistEvaluation } from '../services/mongoProgressService';
import {
  createSession,
  updateSessionData,
  saveSessionEvaluation,
  getActiveSessionId,
} from '../services/sessionService';
import { setEvalStorage } from '../utils/evalBus';


/* ─── wizard step definitions ─────────────────────────────────── */
const STEPS = [
  { id: 'upload', label: 'Upload', desc: 'Upload your syllabus PDF or image' },
  { id: 'topics', label: 'Topics', desc: 'AI breaks it into topics & subtopics' },
  { id: 'mindmap', label: 'Mind Map', desc: 'Click any node to quiz that topic' },
  { id: 'depgraph', label: 'Prerequisite Graph', desc: 'AI shows which prerequisites you are missing per topic' },
];

/* ─── progress sidebar step item ─────────────────────────────── */
const StepItem = ({ step, index, status, isCurrent, onClick, canClick }) => {
  const colors = {
    done: { bg: '#22c55e', text: '#fff', border: '#22c55e', labelColor: '#166534' },
    active: { bg: '#6366f1', text: '#fff', border: '#6366f1', labelColor: '#0f172a' },
    locked: { bg: '#f1f5f9', text: '#9ca3af', border: '#e2e8f0', labelColor: '#9ca3af' },
  };
  const c = colors[status];

  return (
    <div
      onClick={() => canClick && onClick(step.id)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '12px 14px', borderRadius: 12,
        cursor: canClick ? 'pointer' : 'default',
        background: isCurrent ? 'rgba(99,102,241,0.06)' : 'transparent',
        border: isCurrent ? '1.5px solid rgba(99,102,241,0.2)' : '1.5px solid transparent',
        transition: 'all 0.2s',
      }}
    >
      {/* step number / icon bubble */}
      <div style={{
        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: status === 'done' ? '1rem' : '0.85rem',
        fontWeight: 700,
        background: c.bg, color: c.text,
        border: `2px solid ${c.border}`,
        boxShadow: status === 'active' ? '0 4px 14px rgba(99,102,241,0.35)' : 'none',
        transition: 'all 0.25s',
        transform: status === 'active' ? 'scale(1.08)' : 'scale(1)',
      }}>
        {status === 'done' ? '✓' : index + 1}
      </div>

      {/* text */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <p style={{ fontWeight: 700, fontSize: '0.88rem', color: c.labelColor, marginBottom: 1 }}>
          {step.label}
        </p>
        <p style={{ fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.4 }}>
          {step.desc}
        </p>
      </div>
    </div>
  );
};

/* ─── processing overlay ──────────────────────────────────────── */
const ProcessingCard = ({ icon, title, subtitle }) => (
  <div style={{ textAlign: 'center', padding: '60px 32px' }}>
    <div style={{
      width: 72, height: 72, borderRadius: '50%',
      background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(59,130,246,0.12))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '2rem', margin: '0 auto 20px',
    }}>{icon}</div>
    <div className="t-spinner" style={{ margin: '0 auto 20px' }} />
    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{title}</h3>
    <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{subtitle}</p>
  </div>
);

/* ─── section header ──────────────────────────────────────────── */
const SectionHeader = ({ title, subtitle, action }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
    <div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</h2>
      {subtitle && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

/* ─── results summary ─────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
const ResultsSummary = ({ topicsData, evaluationData, onGoToRootCause }) => {
  const topics = topicsData?.topics ?? [];
  const getName = t => (typeof t === 'string' ? t : t.name);

  const rated = topics.map(t => ({ name: getName(t), rating: evaluationData[getName(t)]?.rating }));
  const strong = rated.filter(r => r.rating === 'strong');
  const partial = rated.filter(r => r.rating === 'partial' || r.rating === 'moderate');
  const weak = rated.filter(r => r.rating === 'weak');
  const unrated = rated.filter(r => !r.rating);

  const RATING_STYLE = {
    strong: { bg: 'rgba(34,197,94,0.08)', border: '#22c55e', color: '#166534', badge: 't-badge-green' },
    partial: { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', color: '#92400e', badge: 't-badge-amber' },
    weak: { bg: 'rgba(239,68,68,0.08)', border: '#ef4444', color: '#991b1b', badge: 't-badge-red' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* summary pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {[
          { label: 'Strong', count: strong.length, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
          { label: 'Partial', count: partial.length, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
          { label: 'Weak', count: weak.length, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
          { label: 'Not tried', count: unrated.length, color: '#9ca3af', bg: 'rgba(156,163,175,0.08)' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, minWidth: 90, borderRadius: 12, padding: '14px 16px',
            background: s.bg, borderLeft: `4px solid ${s.color}`,
            border: `1.5px solid ${s.color}22`, borderLeftWidth: 4,
          }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: s.color, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{s.label}</p>
            <p style={{ fontSize: '1.8rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* topic lists */}
      {[
        { key: 'strong', list: strong, label: 'Strong Topics' },
        { key: 'partial', list: partial, label: 'Needs Review' },
        { key: 'weak', list: weak, label: 'Weak Topics' },
      ].filter(g => g.list.length > 0).map(({ key, list, label }) => {
        const s = RATING_STYLE[key];
        return (
          <div key={key} style={{ background: s.bg, border: `1.5px solid ${s.border}33`, borderRadius: 12, padding: '16px 18px' }}>
            <p style={{ fontWeight: 700, fontSize: '0.88rem', color: s.color, marginBottom: 12 }}>{label}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {list.map(t => (
                <span key={t.name} className={`t-badge ${s.badge}`}>{t.name}</span>
              ))}
            </div>
            {key === 'weak' && list.length > 0 && (
              <button
                onClick={() => onGoToRootCause(list[0].name)}
                className="t-btn t-btn-danger t-btn-sm"
                style={{ marginTop: 14 }}
              >
                Find Root Cause
              </button>
            )}
          </div>
        );
      })}

      {unrated.length === topics.length && (
        <div className="t-alert t-alert-info">
          No questions answered yet. Complete the Practice step to see your results here.
        </div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
const ConceptGraphPage = () => {
  // ── wizard state ──
  const [wizardStep, setWizardStep] = useState('upload');
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // ── data state ──
  const [extractedText, setExtractedText] = useState('');
  const [topicsData, setTopicsData] = useState(null);
  const [evaluationData, setEvaluationData] = useState({});
  const [topicDepGraphs, setTopicDepGraphs] = useState(() => {
    // Prefer the per-session scoped key; fall back to the global key for backwards compat
    try {
      const sessionId = localStorage.getItem('activeSessionId');
      if (sessionId) {
        const perSession = localStorage.getItem(`topicDepGraphs_${sessionId}`);
        if (perSession) return JSON.parse(perSession);
      }
      return JSON.parse(localStorage.getItem('topicDepGraphs') || '{}');
    } catch { return {}; }
  });
  const [selectedDepTopic, setSelectedDepTopic] = useState(null);
  const [selectedWeakTopic, setSelectedWeakTopic] = useState(null);
  const [practiceTopicId, setPracticeTopicId] = useState(null);
  const [activeSessionId, setActiveSessionId] = useState(() => getActiveSessionId());
  const [processing, setProcessing] = useState(null);

  // ── on-demand question generation (when node clicked) ──
  const [onDemandQuestions, setOnDemandQuestions] = useState([]);
  const [fetchingQuestions, setFetchingQuestions] = useState(false);
  const [questionFetchKey, setQuestionFetchKey] = useState(0);

  // ── Bloom's modal (mind map node click) ──
  const [bloomTopic, setBloomTopic] = useState(null); // { name, parent }

  // ── mind map revision counter — bumped on every eval update to force canvas redraw ──
  const mapRevRef = useRef(0);
  const [mapRevision, setMapRevision] = useState(0);


  // ── hooks ──
  const textExtraction = useTextExtraction();
  const topicExtraction = useTopicExtraction();
  const errorHandler = useErrorHandler();

  const questionGeneration = useQuestionGeneration();
  const dependencyAnalysis = useDependencyAnalysis();
  const weaknessAnalysis = useWeaknessAnalysis();
  const { user } = useAuth();

  /* ── mark a step done and auto-advance ── */
  const completeStep = (stepId) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
  };

  const canAccess = (stepId) => {
    const idx = STEPS.findIndex(s => s.id === stepId);
    const prevId = idx > 0 ? STEPS[idx - 1].id : null;
    return idx === 0 || completedSteps.has(prevId);
  };

  const stepStatus = (stepId) => {
    if (completedSteps.has(stepId)) return 'done';
    if (wizardStep === stepId) return 'active';
    return 'locked';
  };

  /* ── file upload handler ──
     The /api/upload endpoint already extracts text from the file and returns it
     in response.data.extraction.extractedText — we use it directly here instead
     of making a second /api/extract call that was causing the "Network Error". */
  const handleFileUpload = async (responseData) => {
    const fileInfo = responseData.file || responseData;
    // Text is already extracted by the upload controller
    const extractedTextFromUpload = responseData.extraction?.extractedText || '';

    // ── Clear ALL stale data from the previous session immediately ──
    // This prevents old dep-graph / evaluation data bleeding into the new upload.
    [
      'learningTopicsData', 'learningQuestionsData',
      'learningEvaluationData', 'learningDependencyData',
    ].forEach(k => localStorage.removeItem(k));
    setTopicsData(null);
    setEvaluationData({});
    setSelectedDepTopic(null);
    setSelectedWeakTopic(null);
    dependencyAnalysis.clearDependencies?.();
    questionGeneration.clearQuestions?.();
    weaknessAnalysis.clearWeaknessData?.();

    completeStep('upload');
    setWizardStep('topics');

    try {
      let text = extractedTextFromUpload;

      // If for some reason the upload didn't include text (old file), fall back to /api/extract
      if (!text || text.trim().length < 20) {
        setProcessing('extracting');
        try {
          const extractResponse = await extractTextFromFile(fileInfo.filename, fileInfo.mimetype);
          text = extractResponse?.data?.text || extractResponse?.text || '';
        } catch (extErr) {
          console.warn('Fallback extraction failed:', extErr.message);
        }
      }

      if (text && text.trim().length >= 20) {
        setExtractedText(text);
        setProcessing('topics');

        const topicsResult = await topicExtraction.extract(text);
        if (topicsResult) {
          // Sanitize subject: strip course codes and fix 'Unknown' or blank subjects
          const _stripCode = (s) => (s || '').replace(/^[A-Z]{2,6}[-\s]?\d{3,6}\s*/i, '').replace(/[,;:]+$/, '').trim();
          const cleanedSubject = _stripCode(topicsResult.subject);
          if (!cleanedSubject || cleanedSubject === 'Unknown') {
            const firstTopic = topicsResult.topics?.[0];
            topicsResult.subject = typeof firstTopic === 'string'
              ? firstTopic
              : (firstTopic?.name || 'Concept Map');
          } else {
            topicsResult.subject = cleanedSubject;
          }
          setTopicsData(topicsResult);
          completeStep('topics');
          setProcessing(null);
          setWizardStep('mindmap');

          // ── Create a new MongoDB session for this syllabus ──
          if (user) {
            const rawName = fileInfo.originalname || fileInfo.filename || '';
            const cleaned = rawName
              .replace(/\.[^.]+$/, '')
              .replace(/-\d{10,}-\d+$/, '')
              .replace(/[-_]/g, ' ')
              .trim();
            const sid = await createSession(user.uid, {
              title: topicsResult.subject || topicsResult.topics?.[0]?.name || cleaned || 'Uploaded Syllabus',
              subject: topicsResult.subject || '',
              extractedText: text,
              topicsData: topicsResult,
            });
            if (sid) setActiveSessionId(sid);
          }
        } else {
          errorHandler.handleError({ message: topicExtraction.error || 'Failed to extract topics — is Ollama running?' });
          setProcessing(null);
        }
      } else {
        errorHandler.handleError({ message: 'Could not extract text from the file. Try a different PDF or image.' });
        setProcessing(null);
      }
    } catch (err) {
      errorHandler.handleError({ message: err.message || 'Something went wrong during processing' });
      setProcessing(null);
    }
  };


  /* ── build dependency graph when topics arrive ── */
  useEffect(() => {
    if (topicsData?.topics && topicsData.topics.length > 0) {
      dependencyAnalysis.analyze(topicsData.topics, extractedText).then((depData) => {
        if (activeSessionId && depData)
          updateSessionData(activeSessionId, { dependencyData: depData });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsData]);

  /* ── auto-complete mindmap step when user reaches it ── */
  useEffect(() => {
    if (wizardStep === 'mindmap' && topicsData) {
      completeStep('mindmap');
    }
  }, [wizardStep, topicsData]);

  /* ── BOOTSTRAP: restore session data from localStorage on mount ── */
  const location = useLocation();
  useEffect(() => {
    // If navigated here with ?fresh=1 (e.g. from "Upload New"), stay on the upload screen
    if (new URLSearchParams(location.search).get('fresh') === '1') return;

    const raw = localStorage.getItem('learningTopicsData');
    if (!raw) return;  // no previous data — stay on upload screen
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.topics?.length) return;

      // ── Detect keyword-fallback / bad cached data ───────────────
      // When Ollama fails, the rule-based fallback produces single keywords as
      // topics (e.g. "soil", "crop", "water") with NO subtopics.
      // NOTE: We check topic STRUCTURE only — NOT subject name, because an earlier
      // sanitization pass may have already changed 'Unknown' to a keyword.
      const allTopicsAreLeafKeywords = parsed.topics.length > 0 && parsed.topics.every(t => {
        const name = typeof t === 'string' ? t : (t?.name || '');
        const subs = typeof t === 'object' ? (t.subtopics || []) : [];
        // keyword-fallback topics: short (≤2 words), all lowercase, no subtopics
        return subs.length === 0 && name.trim().split(/\s+/).length <= 2 && name === name.toLowerCase();
      });

      if (allTopicsAreLeafKeywords) {
        console.warn('[ConceptGraphPage] Discarding stale keyword-fallback cache — please re-upload.');
        ['learningTopicsData', 'learningQuestionsData', 'learningEvaluationData', 'learningDependencyData']
          .forEach(k => localStorage.removeItem(k));
        return; // stay on upload screen
      }

      // Sanitize subject: strip course codes and fix 'Unknown' — handles already-cached data
      const _sc = (s) => (s || '').replace(/^[A-Z]{2,6}[-\s]?\d{3,6}\s*/i, '').replace(/[,;:]+$/, '').trim();
      const cleanedCachedSubject = _sc(parsed.subject);
      if (!cleanedCachedSubject || cleanedCachedSubject === 'Unknown') {
        const firstTopic = parsed.topics[0];
        parsed.subject = typeof firstTopic === 'string'
          ? firstTopic
          : (firstTopic?.name || 'Concept Map');
      } else {
        parsed.subject = cleanedCachedSubject;
      }

      // Restore topics
      setTopicsData(parsed);

      // Restore evaluation data
      const evalRaw = localStorage.getItem('learningEvaluationData');
      if (evalRaw) {
        try { setEvaluationData(JSON.parse(evalRaw)); } catch (_) { }
      }

      // Restore extracted text (needed for on-demand question gen)
      // (stored separately by the session service)
      // Jump straight to mind map — skip upload & topics steps
      setCompletedSteps(new Set(['upload', 'topics', 'mindmap']));
      setWizardStep('mindmap');
    } catch (err) {
      console.warn('[ConceptGraphPage] Failed to restore session from localStorage:', err);
    }
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── persist topics to localStorage + MongoDB ── */
  useEffect(() => {
    if (topicsData) {
      localStorage.setItem('learningTopicsData', JSON.stringify(topicsData));
      if (user) persistSessionData(user.uid, { topicsData });
    }
  }, [topicsData, user]);

  useEffect(() => {
    // evaluationData is persisted inside handleEvalUpdate
  }, [evaluationData]);

  useEffect(() => {
    if (questionGeneration.questionsData) {
      localStorage.setItem('learningQuestionsData', JSON.stringify(questionGeneration.questionsData));
      if (user) persistSessionData(user.uid, { questionsData: questionGeneration.questionsData });
    }
  }, [questionGeneration.questionsData, user]);

  useEffect(() => {
    if (dependencyAnalysis.dependencies) {
      localStorage.setItem('learningDependencyData', JSON.stringify(dependencyAnalysis.dependencies));
      if (user) persistSessionData(user.uid, { dependencyData: dependencyAnalysis.dependencies });
    }
  }, [dependencyAnalysis.dependencies, user]);

  // Graph data is persisted via the session flow (createSession + updateSessionData → MongoDB).
  // The old persistGraphData call was silently routing to Firebase (unconfigured) and losing data.

  /* ── On-demand question generation when a node is clicked ── */
  useEffect(() => {
    if (!practiceTopicId || !topicsData) return;

    // First check if we already have pre-generated questions for this topic + its subtopics
    const allQ = questionGeneration.questionsData?.questions ?? [];
    const existing = allQ.filter(q =>
      q.topic === practiceTopicId || q.parentTopic === practiceTopicId
    );
    if (existing.length > 0) {
      setOnDemandQuestions(existing);
      return;
    }

    // No pre-generated questions — fetch from AI on the spot
    setOnDemandQuestions([]);
    setFetchingQuestions(true);

    // Find the full topic object (including its subtopics array)
    const topicObj = topicsData.topics.find(t =>
      (typeof t === 'string' ? t : t.name) === practiceTopicId
    );

    // Send the FULL topic object with subtopics so the backend generates
    // questions for the parent topic AND every subtopic independently.
    const payload = topicObj
      ? topicObj   // already has { name, subtopics: [...] }
      : { name: practiceTopicId, subtopics: [] };

    fetch('http://localhost:5000/api/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topics: [payload],
        extractedText: extractedText || '',
        subject: topicsData.subject || '',
      }),
    })
      .then(r => r.json())
      .then(data => {
        // API response shape: { success, data: { questions: [...] } }
        const qs = data?.data?.questions ?? data?.questions ?? [];
        if (qs.length > 0) {
          setOnDemandQuestions(qs);
        }
      })
      .catch(err => console.error('On-demand question fetch failed:', err))
      .finally(() => setFetchingQuestions(false));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceTopicId, questionFetchKey]);

  /* ── handle evaluation update ── */
  const handleEvalUpdate = (ev) => {
    // Stamp each entry with the current time so Recent Activity shows real timestamps
    const now = Date.now()
    const stamped = Object.fromEntries(
      Object.entries(ev).map(([k, v]) => [k, { ...v, practicedAt: v.practicedAt ?? now }])
    )
    setEvaluationData(prev => {
      const merged = { ...prev, ...stamped };
      // Use setEvalStorage so Dashboard, DependencyGraphPage, etc. all update in the same tab
      setEvalStorage('learningEvaluationData', JSON.stringify(merged));
      // 2. MongoDB progress (legacy)
      if (user) persistEvaluation(user.uid, merged);
      // 3. Session-level evaluation (per-syllabus progress)
      if (activeSessionId) saveSessionEvaluation(activeSessionId, stamped);
      return merged;
    });
    // Bump revision so QuizMindMap canvas redraws immediately with new node colors
    mapRevRef.current += 1;
    setMapRevision(mapRevRef.current);
    if (Object.keys(ev).length > 0) completeStep('practice');
  };

  /* ── handle practice complete ── */
  const handlePracticeComplete = () => {
    completeStep('practice');
    setPracticeTopicId(null); // return to topic grid, NOT to depgraph
  };

  /* ── go to root cause (from practice / study plan) ── */
  const handleGoToRootCause = async (topic) => {
    setSelectedWeakTopic(topic);
    // Stay on depgraph tab and show inline weakness trace — rootcause is not a wizard step
    setWizardStep('depgraph');
    completeStep('depgraph');
    if (topicsData?.topics)
      await weaknessAnalysis.traceWeakness(topic, topicsData.topics, evaluationData);
  };

  /* ── deep-analyse INLINE on the depgraph tab (no navigation) ── */
  const handleDeepAnalyse = async (topic) => {
    // If already selected, clicking again collapses the result
    if (selectedWeakTopic === topic && weaknessAnalysis.weaknessTrace) {
      setSelectedWeakTopic(null);
      weaknessAnalysis.clearWeaknessData?.();
      return;
    }
    setSelectedWeakTopic(topic);
    if (topicsData?.topics)
      await weaknessAnalysis.traceWeakness(topic, topicsData.topics, evaluationData);
  };

  /* ── reset ── */
  const handleReset = () => {
    // Clear all cached learning data from localStorage
    [
      'activeSessionId', 'learningTopicsData', 'learningQuestionsData',
      'learningEvaluationData', 'learningDependencyData',
    ].forEach(k => localStorage.removeItem(k));

    setWizardStep('upload');
    setCompletedSteps(new Set());
    setExtractedText('');
    setTopicsData(null);
    setEvaluationData({});
    setSelectedWeakTopic(null);
    setProcessing(null);
    textExtraction.clearResults?.();
    topicExtraction.clearTopics?.();
    questionGeneration.clearQuestions?.();
    dependencyAnalysis.clearDependencies?.();
    weaknessAnalysis.clearWeaknessData?.();
    errorHandler.clearError();
  };

  /* ── nav to step ── */
  const goTo = (stepId) => {
    if (canAccess(stepId)) setWizardStep(stepId);
  };

  /* ─────────────────────────────────────────────────────────────
     STEP CONTENT RENDERERS
  ───────────────────────────────────────────────────────────── */

  const renderUpload = () => (
    <>
      <SectionHeader title="Upload Your Syllabus" subtitle="Supports PDF and image files. We'll extract the text automatically." />
      <FileUpload
        onUploadSuccess={handleFileUpload}
        onUploadError={(err) => errorHandler.handleError(err)}
      />
      {/* mini pipeline preview */}
      <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
        {STEPS.slice(1).map((s, i) => (
          <React.Fragment key={s.id}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
              borderRadius: 999, background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.1)',
              fontSize: '0.77rem', color: 'var(--text-muted)', fontWeight: 500,
            }}>
              {s.label}
            </div>
            {i < STEPS.length - 2 && <span style={{ color: 'var(--text-muted)', alignSelf: 'center', fontSize: '0.7rem' }}>→</span>}
          </React.Fragment>
        ))}
      </div>
    </>
  );

  const renderTopics = () => {
    if (processing === 'extracting') return <ProcessingCard title="Reading your document" subtitle="Extracting text from the uploaded file" />;
    if (processing === 'topics') return <ProcessingCard title="AI is analysing topics" subtitle="Breaking down your syllabus into concepts and subtopics" />;

    const topics = topicsData?.topics ?? [];
    return (
      <>
        <SectionHeader
          title="Topics & Subtopics"
          subtitle={`Found ${topics.length} main topics from your syllabus`}
          action={
            <button onClick={() => setWizardStep('mindmap')} className="t-btn t-btn-primary t-btn-sm">
              View Mind Map →
            </button>
          }
        />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {topics.map((t, i) => {
            const name = typeof t === 'string' ? t : t.name;
            const subs = typeof t === 'string' ? [] : (t.subtopics ?? []);
            return (
              <div key={i} className="t-card" style={{ padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: subs.length ? 10 : 0 }}>
                  <span style={{
                    width: 28, height: 28, borderRadius: 8, background: 'rgba(99,102,241,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.75rem', fontWeight: 800, color: '#6366f1',
                  }}>{i + 1}</span>
                  <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{name}</p>
                  {subs.length > 0 && <span className="t-badge t-badge-blue" style={{ marginLeft: 'auto' }}>{subs.length} subtopics</span>}
                </div>
                {subs.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 38 }}>
                    {subs.map((s, si) => (
                      <span key={si} className="t-badge t-badge-gray">
                        {typeof s === 'string' ? s : s.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderMindMap = () => {
    const allQ = questionGeneration.questionsData?.questions ?? [];
    const getName = t => (typeof t === 'string' ? t : t.name);

    // \u2500\u2500 QUIZ VIEW when a node has been clicked \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    if (practiceTopicId) {
      const ev = evaluationData[practiceTopicId];
      const rating = ev?.rating;
      const nodeColor = rating === 'strong' ? '#22c55e'
        : rating === 'partial' || rating === 'moderate' ? '#f59e0b'
          : rating === 'weak' ? '#ef4444' : '#9ca3af';

      return (
        <>
          {/* Back + topic header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <button onClick={() => setPracticeTopicId(null)} className="t-btn t-btn-ghost t-btn-sm">
              ← Back to Mind Map
            </button>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              flex: 1, padding: '8px 14px', borderRadius: 10,
              background: `${nodeColor}10`, border: `1.5px solid ${nodeColor}30`,
              borderLeft: `4px solid ${nodeColor}`,
            }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: nodeColor, flexShrink: 0 }} />
              <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{practiceTopicId}</p>
              {rating && (
                <span style={{
                  marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700,
                  padding: '2px 8px', borderRadius: 999,
                  background: `${nodeColor}20`, color: nodeColor, textTransform: 'uppercase',
                }}>{rating}</span>
              )}
            </div>
          </div>

          {/* Loading spinner while AI generates */}
          {fetchingQuestions ? (
            <div className="t-card" style={{ textAlign: 'center', padding: '56px 32px' }}>
              <div className="t-spinner" style={{ margin: '0 auto 18px' }} />
              <p style={{ fontWeight: 700, color: '#0f172a', fontSize: '1rem', marginBottom: 6 }}>
                Generating questions for "{practiceTopicId}"…
              </p>
              <p style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                Ollama is crafting questions based on your syllabus (~15–30 s)
              </p>
            </div>
          ) : onDemandQuestions.length > 0 ? (
            <QuestionPractice
              key={practiceTopicId}
              questionsData={{ questions: onDemandQuestions }}
              onEvaluationUpdate={handleEvalUpdate}
              onWeakAnswerDetected={() => { }}
              onComplete={() => { completeStep('mindmap'); setPracticeTopicId(null); }}
            />
          ) : (
            <div className="t-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
              <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Could not generate questions</p>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 20 }}>
                Make sure Ollama is running locally, then try again.
              </p>
              <button onClick={() => { setOnDemandQuestions([]); setQuestionFetchKey(k => k + 1); }} className="t-btn t-btn-primary t-btn-sm" style={{ marginRight: 10 }}>
                Retry
              </button>
              <button onClick={() => setPracticeTopicId(null)} className="t-btn t-btn-ghost t-btn-sm">← Back to Mind Map</button>
            </div>
          )}
        </>
      );
    }

    // ── MIND MAP VIEW ────────────────────────────────────────────
    // Detect if loaded data is stale keyword-fallback (all topics have no subtopics)
    const hasFallbackData = topicsData?.topics?.length > 0 &&
      topicsData.topics.every(t => {
        const subs = typeof t === 'object' ? (t.subtopics || []) : [];
        const name = typeof t === 'string' ? t : (t?.name || '');
        return subs.length === 0 && name.trim().split(/\s+/).length <= 2 && name === name.toLowerCase();
      });

    return (
      <>
        <SectionHeader
          title="Concept Mind Map"
          subtitle="Click any topic or subtopic node to start a quiz on it"
        />

        {/* ── Stale data warning ── */}
        {hasFallbackData && (
          <div style={{
            marginBottom: 16, padding: '14px 18px', borderRadius: 12,
            background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.25)',
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '1.2rem' }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#b91c1c', marginBottom: 2 }}>
                Incomplete extraction — AI could not process this document
              </p>
              <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                The mind map shows keyword fallback data. Re-upload your document to get the full hierarchical mind map.
              </p>
            </div>
            <button
              className="t-btn t-btn-primary t-btn-sm"
              onClick={() => {
                ['learningTopicsData','learningQuestionsData','learningEvaluationData','learningDependencyData']
                  .forEach(k => localStorage.removeItem(k));
                setTopicsData(null);
                setEvaluationData({});
                setWizardStep('upload');
                setCompletedSteps(new Set());
              }}
            >
              Re-upload Document
            </button>
          </div>
        )}

        {topicsData && (
          <MindMapViewer
            key="mindmap"
            topics={topicsData.topics}
            subject={topicsData.subject || ''}
            evaluationData={evaluationData}
            revision={mapRevision}
            onTopicClick={(name, parent) => {
              // Find parent topic name if the clicked node is a subtopic
              const parentTopicObj = topicsData.topics.find(t =>
                (t.subtopics || []).some(s =>
                  (typeof s === 'string' ? s : s.name) === name
                )
              );
              const parentName = parent || parentTopicObj?.name || null;

              // Resolve subtopics if this is a topic-level node (not a subtopic)
              const selfTopicObj = topicsData.topics.find(t =>
                (typeof t === 'string' ? t : t.name) === name
              );
              const subs = selfTopicObj?.subtopics
                ? selfTopicObj.subtopics.map(s => typeof s === 'string' ? s : s.name).filter(Boolean)
                : [];

              setBloomTopic({ name, parent: parentName, subtopics: subs });
            }}
          />
        )}
      </>
    );
  };

  const renderPractice = () => {
    const topics = topicsData?.topics ?? [];
    const getName = t => (typeof t === 'string' ? t : t.name);
    const allQ = questionGeneration.questionsData?.questions ?? [];

    // ── TOPIC GRID (no topic selected) ─────────────────────────
    if (!practiceTopicId) {
      const totalTopics = topics.length;
      const masteredCount = topics.filter(t => evaluationData[getName(t)]?.rating === 'strong').length;
      const allGreen = masteredCount === totalTopics && totalTopics > 0;

      return (
        <>
          <SectionHeader
            title="Choose a Topic to Practise"
            subtitle={allGreen
              ? 'All topics mastered! You can still retake any topic or view your dependency graph.'
              : `${masteredCount} / ${totalTopics} topics mastered — keep going until all nodes turn green!`
            }
            action={
              <button
                onClick={() => { completeStep('practice'); setWizardStep('depgraph'); }}
                className={`t-btn t-btn-sm ${allGreen ? 't-btn-primary' : 't-btn-ghost'}`}
              >
                {allGreen ? 'View Prerequisite Graph →' : 'Skip to Prerequisite Graph →'}
              </button>
            }
          />

          {/* Progress bar */}
          {totalTopics > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280' }}>Overall Progress</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6366f1' }}>
                  {masteredCount}/{totalTopics} Mastered
                </span>
              </div>
              <div style={{ height: 8, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${totalTopics > 0 ? (masteredCount / totalTopics) * 100 : 0}%`,
                  background: 'linear-gradient(90deg, #6366f1, #22c55e)',
                  borderRadius: 999, transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          )}

          {/* Questions still generating notice */}
          {questionGeneration.isGenerating && (
            <div className="t-alert t-alert-info" style={{ marginBottom: 16 }}>
              <div className="t-spinner" style={{ width: 14, height: 14, borderWidth: 2, display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
              AI is generating questions in the background. You can start practising and more will appear.
            </div>
          )}

          {/* Topic grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 14 }}>
            {topics.map(t => {
              const name = getName(t);
              const ev = evaluationData[name];
              const rating = ev?.rating;
              const score = ev?.score ?? ev?.confidence ?? null;
              const qCount = allQ.filter(q => q.topic === name || q.parentTopic === name).length;

              const nodeColor = rating === 'strong' ? '#22c55e'
                : rating === 'partial' || rating === 'moderate' ? '#f59e0b'
                  : rating === 'weak' ? '#ef4444'
                    : '#9ca3af';

              const ratingLabel = rating === 'strong' ? 'Mastered'
                : rating === 'partial' || rating === 'moderate' ? 'In Progress'
                  : rating === 'weak' ? 'Needs Work'
                    : 'Not Started';

              const pct = rating === 'strong' ? 100 : rating === 'partial' || rating === 'moderate' ? 55 : rating === 'weak' ? 20 : 0;

              return (
                <div
                  key={name}
                  onClick={() => { setPracticeTopicId(name); completeStep('mindmap'); }}
                  style={{
                    cursor: 'pointer',
                    border: `2px solid ${nodeColor}33`,
                    borderLeft: `4px solid ${nodeColor}`,
                    borderRadius: 12,
                    padding: '16px 18px',
                    background: `${nodeColor}08`,
                    transition: 'all 0.18s',
                    outline: 'none',
                  }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = `0 4px 16px ${nodeColor}30`}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.4, flex: 1, paddingRight: 8 }}>{name}</p>
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px', borderRadius: 999, flexShrink: 0,
                      background: `${nodeColor}20`, color: nodeColor, textTransform: 'uppercase', letterSpacing: '0.04em',
                    }}>{ratingLabel}</span>
                  </div>

                  {/* Progress bar */}
                  <div style={{ height: 5, background: 'rgba(0,0,0,0.08)', borderRadius: 999, overflow: 'hidden', marginBottom: 10 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: nodeColor, borderRadius: 999, transition: 'width 0.5s ease' }} />
                  </div>

                  {/* Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.73rem', color: '#9ca3af' }}>
                      {qCount > 0 ? `${qCount} question${qCount !== 1 ? 's' : ''}` : 'Questions loading…'}
                    </span>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700,
                      color: nodeColor, padding: '3px 10px',
                      background: `${nodeColor}15`, borderRadius: 999,
                    }}>
                      {rating ? 'Retake' : 'Start'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      );
    }

    // ── QUIZ VIEW (topic selected) ──────────────────────────────
    const topicQuestions = allQ.filter(q =>
      q.topic === practiceTopicId || q.parentTopic === practiceTopicId
    );

    const ev = evaluationData[practiceTopicId];
    const rating = ev?.rating;
    const nodeColor = rating === 'strong' ? '#22c55e'
      : rating === 'partial' || rating === 'moderate' ? '#f59e0b'
        : rating === 'weak' ? '#ef4444' : '#9ca3af';

    return (
      <>
        {/* Back + topic header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          <button
            onClick={() => setPracticeTopicId(null)}
            className="t-btn t-btn-ghost t-btn-sm"
          >
            ← All Topics
          </button>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            flex: 1, padding: '8px 14px', borderRadius: 10,
            background: `${nodeColor}10`, border: `1.5px solid ${nodeColor}30`,
            borderLeft: `4px solid ${nodeColor}`,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: nodeColor, flexShrink: 0 }} />
            <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{practiceTopicId}</p>
            {rating && (
              <span style={{
                marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px',
                borderRadius: 999, background: `${nodeColor}20`, color: nodeColor,
                textTransform: 'uppercase',
              }}>{rating}</span>
            )}
          </div>
        </div>

        {/* Quiz or empty */}
        {topicQuestions.length === 0 ? (
          <div className="t-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
            {questionGeneration.isGenerating ? (
              <>
                <div className="t-spinner" style={{ margin: '0 auto 14px' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Generating questions for "{practiceTopicId}"…
                </p>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>No questions for this topic yet</p>
                <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 20 }}>
                  Questions are generated for all topics. This topic may not have matched the AI output.
                </p>
                <button onClick={() => setPracticeTopicId(null)} className="t-btn t-btn-ghost t-btn-sm">
                  ← Back to topic list
                </button>
              </>
            )}
          </div>
        ) : (
          <QuestionPractice
            key={practiceTopicId}  /* remount when topic changes to reset state */
            questionsData={{ ...questionGeneration.questionsData, questions: topicQuestions }}
            onEvaluationUpdate={handleEvalUpdate}
            onWeakAnswerDetected={() => { }}
            onComplete={() => {
              completeStep('practice');
              setPracticeTopicId(null); // return to grid after finishing
            }}
          />
        )}
      </>
    );
  };

  const renderDepGraph = () => {
    /* colour helpers */
    const ratingColor = r =>
      r === 'strong' ? '#22c55e' : r === 'partial' || r === 'moderate' ? '#f59e0b' : r === 'weak' ? '#ef4444' : '#9ca3af';
    const ratingLabel = r =>
      r === 'strong' ? 'Strong' : r === 'partial' || r === 'moderate' ? 'Partial' : r === 'weak' ? 'Needs Work' : 'Not Tested';

    // Topics that have been quizzed (exist in topicDepGraphs)
    const testedTopics = Object.entries(topicDepGraphs);

    // Currently selected topic's dep graph
    const selected = selectedDepTopic ? topicDepGraphs[selectedDepTopic] : null;

    return (
      <>
        <SectionHeader
          title="Prerequisite Graph"
          subtitle="AI-powered map of what you need to master — weak topics are highlighted automatically"
        />

        {/* ── Full course React Flow graph (always shown if topics exist) ── */}
        {topicsData?.topics?.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <RootCauseGraph
              key={`${topicsData.subject || 'session'}-${topicsData.topics.length}`}
              topics={topicsData.topics}
              evalData={evaluationData}
              courseTitle={topicsData.subject || ''}
              onPractice={(topicName) => {
                setPracticeTopicId(topicName);
                setWizardStep('mindmap');
              }}
            />
          </div>
        )}

        {/* ── BloomPanel quiz results section ── */}
        {testedTopics.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Topic picker grid */}
            <div className="t-card" style={{ padding: '20px 22px' }}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                Quiz Results — click to analyse weak topic in detail
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {testedTopics.map(([name, data]) => {
                  const color = ratingColor(data.rating);
                  const isSel = selectedDepTopic === name;
                  return (
                    <button
                      key={name}
                      onClick={() => {
                        setSelectedDepTopic(isSel ? null : name);
                        if (!isSel) handleGoToRootCause(name);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '9px 16px', borderRadius: 10, fontFamily: 'inherit',
                        fontWeight: 600, fontSize: '0.84rem', cursor: 'pointer',
                        background: isSel ? `${color}18` : '#f8faff',
                        border: `2px solid ${isSel ? color : '#e2e8f0'}`,
                        color: isSel ? color : '#374151',
                        boxShadow: isSel ? `0 0 0 3px ${color}22` : 'none',
                        transition: 'all 0.18s',
                      }}
                    >
                      <div style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      {name}
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700,
                        padding: '1px 7px', borderRadius: 999,
                        background: `${color}20`, color,
                      }}>
                        {data.score}%
                      </span>
                      <span style={{ fontSize: '0.65rem', color: '#9ca3af' }}>
                        {ratingLabel(data.rating)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* dep graph detail for selected topic */}
            {selectedDepTopic && selected && (
              <div className="t-card" style={{
                padding: '22px 24px',
                borderLeft: `4px solid ${ratingColor(selected.rating)}`,
                background: selected.rating === 'weak' ? '#fffafa' : selected.rating === 'partial' ? '#fffdf5' : '#f9fffe',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                  <div style={{ width: 12, height: 12, borderRadius: '50%', background: ratingColor(selected.rating), flexShrink: 0 }} />
                  <p style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>{selectedDepTopic}</p>
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                    background: `${ratingColor(selected.rating)}20`, color: ratingColor(selected.rating),
                    textTransform: 'uppercase'
                  }}>{ratingLabel(selected.rating)}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#6366f1', marginLeft: 4 }}>{selected.score}%</span>
                </div>
                {selected.nodes && selected.nodes.length > 0 ? (
                  <div>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
                      Prerequisite dependency graph — from your quiz
                    </p>
                    <DependencyGraph nodes={selected.nodes} onQuizTopic={(topicName) => {
                      setBloomTopic({ name: topicName, parent: selectedDepTopic });
                    }} />
                    {selected.improvements && selected.improvements.length > 0 && (
                      <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.14)' }}>
                        <p style={{ fontSize: '0.73rem', fontWeight: 700, color: '#6366f1', marginBottom: 8 }}>What to study next:</p>
                        <ul style={{ paddingLeft: 18, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {selected.improvements.slice(0, 4).map((tip, ti) => (
                            <li key={ti} style={{ fontSize: '0.8rem', color: '#374151' }}>{tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : selected.rating === 'strong' ? (
                  <div style={{ textAlign: 'center', padding: '20px 0' }}>
                    <p style={{ fontWeight: 700, color: '#15803d', fontSize: '0.95rem', marginBottom: 4 }}>No prerequisite gaps!</p>
                    <p style={{ fontSize: '0.82rem', color: '#6b7280' }}>You demonstrated solid understanding of this topic.</p>
                  </div>
                ) : (
                  <p style={{ fontSize: '0.82rem', color: '#6b7280' }}>No dependency data yet — the AI graph above shows your full prerequisite map.</p>
                )}
              </div>
            )}

            {/* Inline weakness trace (shown when handleGoToRootCause is called) */}
            {selectedWeakTopic && (
              <div className="t-card" style={{ padding: '22px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <h3 style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>
                    Root Cause: <span style={{ color: '#ef4444' }}>"{selectedWeakTopic}"</span>
                  </h3>
                  <button onClick={() => setSelectedWeakTopic(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}>✕</button>
                </div>
                <WeaknessTraceViewer
                  weaknessTrace={weaknessAnalysis.weaknessTrace}
                  isLoading={weaknessAnalysis.isAnalyzing}
                  error={weaknessAnalysis.error}
                  onSelectConcept={() => {}}
                />
              </div>
            )}
          </div>
        )}

        {/* Empty state when no quizzes taken */}
        {testedTopics.length === 0 && !topicsData?.topics?.length && (
          <div style={{ padding: '40px 32px', textAlign: 'center', background: '#f8faff', borderRadius: 14, border: '1.5px solid #e2e8f0' }}>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginBottom: 8 }}>Upload a syllabus first</p>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', maxWidth: 380, margin: '0 auto 20px' }}>
              Go to the Upload step, then come back here to see your prerequisite dependency graph.
            </p>
            <button onClick={() => setWizardStep('upload')} className="t-btn t-btn-primary t-btn-sm">
              Upload Syllabus →
            </button>
          </div>
        )}
      </>
    );
  };

  /* ─── render active step content ───────────────────────────── */

  const CONTENT_MAP = {
    upload:   renderUpload,
    topics:   renderTopics,
    mindmap:  renderMindMap,
    practice: renderPractice,
    depgraph: renderDepGraph,
    // rootcause is rendered INLINE inside depgraph tab — not a standalone wizard step
  };

  const activeContent = CONTENT_MAP[wizardStep]?.() ?? null;
  const currentIdx = STEPS.findIndex(s => s.id === wizardStep);

  /* ─── layout ────────────────────────────────────────────────── */



  /* ── All other wizard steps: classic scrollable wizard layout ── */
  return (
    <div style={{ padding: '28px', maxWidth: 900, margin: '0 auto' }}>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e1b4b', letterSpacing: '-0.03em', marginBottom: 4 }}>
          Concept Visualization
        </h1>
        <p style={{ color: '#9ca3af', fontSize: '0.88rem' }}>
          Upload your syllabus and follow the steps to master every topic
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Step content ── */}
        <div>
          <div className="t-card t-animate-in" key={wizardStep} style={{ padding: '28px' }}>
            {activeContent}
          </div>

          {/* Next step CTA */}
          {completedSteps.has(wizardStep) &&
            (wizardStep !== 'mindmap' || Object.keys(evaluationData).length > 0) &&
            STEPS[currentIdx + 1] && (
              <div style={{
                marginTop: 14, padding: '12px 18px', borderRadius: 10,
                background: 'rgba(34,197,94,0.06)', border: '1.5px solid rgba(34,197,94,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: '#22c55e', fontSize: '1rem' }}>✓</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>
                    {wizardStep === 'mindmap' ? 'Quiz complete! View your Prerequisite Graph.' : 'This step is complete!'}
                  </span>
                </div>
                <button onClick={() => goTo(STEPS[currentIdx + 1]?.id)} className="t-btn t-btn-primary t-btn-sm">
                  {wizardStep === 'mindmap' ? 'Prerequisite Graph' : STEPS[currentIdx + 1]?.label} →
                </button>
              </div>
            )}
        </div>
      </div>

      {/* Error display */}
      {errorHandler.error && (
        <div style={{ marginTop: 20 }}>
          <ErrorDisplay error={errorHandler.error} onDismiss={() => errorHandler.clearError()}
            onRetry={() => { if (wizardStep === 'upload') handleReset(); }} />
        </div>
      )}

      {/* Bloom modal */}
      {bloomTopic && (
        <BloomPanel
          concept={bloomTopic.name}
          parentTopic={bloomTopic.parent}
          subtopics={bloomTopic.subtopics || []}
          onQuizComplete={({ concept, score, rating, nodes = [], improvements = [] }) => {
            handleEvalUpdate({ [concept]: { score, rating } });
            setTopicDepGraphs(prev => {
              const updated = { ...prev, [concept]: { score, rating, nodes, improvements, testedAt: Date.now() } };

              // GRAPH EXPANSION LOGIC
              // If the user was viewing a parent topic's dep graph, and they just took a quiz on a prerequisite node:
              if (selectedDepTopic && selectedDepTopic !== concept) {
                const parentData = prev[selectedDepTopic];
                if (parentData && parentData.nodes) {
                  // Check if the concept exists in the parent's graph
                  const existingNode = parentData.nodes.find(n => n.name === concept);
                  if (existingNode && (rating === 'weak' || rating === 'partial' || rating === 'moderate')) {
                    // Update the status of the prerequisite node
                    const mergedNodes = parentData.nodes.map(n => 
                      n.name === concept ? { ...n, status: rating, score } : n
                    );
                    
                    // The new 'nodes' generated by analyze-deps for this sub-concept
                    // should be appended, but we need to link them.
                    const newChildren = nodes.filter(n => n.name !== concept);
                    
                    // Ensure the new children have a parent linking to 'concept'
                    const mappedNewChildren = newChildren.map(n => {
                       const p = (!n.parent || n.parent.toLowerCase() === 'none' || n.parent === nodes.find(r=>r.isRoot)?.name) ? concept : n.parent;
                       return { ...n, parent: p };
                    });

                    // Add new children only if they don't already exist
                    mappedNewChildren.forEach(nc => {
                      if (!mergedNodes.some(existing => existing.name === nc.name)) {
                        mergedNodes.push(nc);
                      }
                    });

                    // Update parentData
                    updated[selectedDepTopic] = { ...parentData, nodes: mergedNodes };
                  } else if (existingNode) {
                    // Just update its score/status (e.g. they passed)
                    const mergedNodes = parentData.nodes.map(n => 
                      n.name === concept ? { ...n, status: rating, score } : n
                    );
                    updated[selectedDepTopic] = { ...parentData, nodes: mergedNodes };
                  }
                }
              }

              localStorage.setItem('topicDepGraphs', JSON.stringify(updated));
              // Also write session-scoped key so DepGraphPage can load per-syllabus data
              if (activeSessionId) {
                localStorage.setItem(`topicDepGraphs_${activeSessionId}`, JSON.stringify(updated));
                updateSessionData(activeSessionId, { topicDepGraphs: updated });
              }
              return updated;
            });
          }}
          onClose={() => { setBloomTopic(null); completeStep('mindmap'); }}
        />
      )}
    </div>
  );
};

export default ConceptGraphPage;
