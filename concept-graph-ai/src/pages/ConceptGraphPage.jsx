import React, { useState, useEffect } from 'react';
import FileUpload from '../components/FileUpload';
import { extractTextFromFile } from '../services/textExtractionService';
import { useTextExtraction } from '../hooks/useTextExtraction';
import { useTopicExtraction } from '../hooks/useTopicExtraction';
import { useErrorHandler } from '../hooks/useErrorHandler';
import { useGraph } from '../hooks/useGraph';
import { useQuestionGeneration } from '../hooks/useQuestionGeneration';
import { useDependencyAnalysis } from '../hooks/useDependencyAnalysis';
import { useWeaknessAnalysis } from '../hooks/useWeaknessAnalysis';
import { useAuth } from '../context/AuthContext';
import MindMapViewer from '../components/MindMapViewer';
import GraphViewer from '../components/GraphViewer';
import QuestionsDisplay from '../components/QuestionsDisplay';
import QuestionPractice from '../components/QuestionPractice';
import WeaknessTraceViewer from '../components/WeaknessTraceViewer';
import DependencyViewer from '../components/DependencyViewer';
import ErrorDisplay from '../components/ErrorDisplay';
import { persistGraphData } from '../services/dataPersistence';
import { persistSessionData, persistEvaluation } from '../services/mongoProgressService';
import {
  createSession,
  updateSessionData,
  saveSessionEvaluation,
  getActiveSessionId,
} from '../services/sessionService';

/* ─── wizard step definitions ─────────────────────────────────── */
const STEPS = [
  { id: 'upload',   label: 'Upload',             desc: 'Upload your syllabus PDF or image' },
  { id: 'topics',   label: 'Topics',             desc: 'AI breaks it into topics & subtopics' },
  { id: 'mindmap',  label: 'Mind Map',           desc: 'Click any node to quiz that topic' },
  { id: 'depgraph', label: 'Prerequisite Graph', desc: 'AI shows which prerequisites you are missing per topic' },
];

/* ─── progress sidebar step item ─────────────────────────────── */
const StepItem = ({ step, index, status, isCurrent, onClick, canClick }) => {
  const colors = {
    done:    { bg: '#22c55e', text: '#fff', border: '#22c55e', labelColor: '#166534' },
    active:  { bg: '#6366f1', text: '#fff', border: '#6366f1', labelColor: '#0f172a' },
    locked:  { bg: '#f1f5f9', text: '#9ca3af', border: '#e2e8f0', labelColor: '#9ca3af' },
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
const ResultsSummary = ({ topicsData, evaluationData, onGoToRootCause }) => {
  const topics = topicsData?.topics ?? [];
  const getName = t => (typeof t === 'string' ? t : t.name);

  const rated  = topics.map(t => ({ name: getName(t), rating: evaluationData[getName(t)]?.rating }));
  const strong = rated.filter(r => r.rating === 'strong');
  const partial = rated.filter(r => r.rating === 'partial' || r.rating === 'moderate');
  const weak   = rated.filter(r => r.rating === 'weak');
  const unrated = rated.filter(r => !r.rating);

  const RATING_STYLE = {
    strong:  { bg: 'rgba(34,197,94,0.08)',  border: '#22c55e', color: '#166534', badge: 't-badge-green',  icon: '💪' },
    partial: { bg: 'rgba(245,158,11,0.08)', border: '#f59e0b', color: '#92400e', badge: 't-badge-amber',  icon: '⚡' },
    weak:    { bg: 'rgba(239,68,68,0.08)',   border: '#ef4444', color: '#991b1b', badge: 't-badge-red',    icon: '⚠️' },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* summary pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {[
  { label: 'Strong',   count: strong.length,  color: '#22c55e', bg: 'rgba(34,197,94,0.08)'   },
          { label: 'Partial',  count: partial.length, color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
          { label: 'Weak',     count: weak.length,    color: '#ef4444', bg: 'rgba(239,68,68,0.08)'   },
          { label: 'Not tried',count: unrated.length, color: '#9ca3af', bg: 'rgba(156,163,175,0.08)' },
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
        { key: 'weak',   list: weak,   label: 'Weak Topics' },
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
  const [wizardStep, setWizardStep]       = useState('upload');
  const [completedSteps, setCompletedSteps] = useState(new Set());

  // ── data state ──
  const [extractedText, setExtractedText] = useState('');
  const [topicsData, setTopicsData]       = useState(null);
  const [evaluationData, setEvaluationData] = useState({});
  const [selectedWeakTopic, setSelectedWeakTopic] = useState(null);
  const [practiceTopicId, setPracticeTopicId]     = useState(null);
  const [activeSessionId, setActiveSessionId]     = useState(() => getActiveSessionId());
  const [processing, setProcessing]       = useState(null);

  // ── on-demand question generation (when node clicked) ──
  const [onDemandQuestions, setOnDemandQuestions] = useState([]);
  const [fetchingQuestions, setFetchingQuestions] = useState(false);
  const [questionFetchKey, setQuestionFetchKey] = useState(0);

  // ── mind-map sub-tab ──
  const [mapTab, setMapTab] = useState('mindmap');

  // ── hooks ──
  const textExtraction    = useTextExtraction();
  const topicExtraction   = useTopicExtraction();
  const errorHandler      = useErrorHandler();
  const graph             = useGraph();
  const questionGeneration = useQuestionGeneration();
  const dependencyAnalysis = useDependencyAnalysis();
  const weaknessAnalysis  = useWeaknessAnalysis();
  const { user }          = useAuth();

  /* ── mark a step done and auto-advance ── */
  const completeStep = (stepId) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
  };

  const canAccess = (stepId) => {
    const idx      = STEPS.findIndex(s => s.id === stepId);
    const prevId   = idx > 0 ? STEPS[idx - 1].id : null;
    return idx === 0 || completedSteps.has(prevId);
  };

  const stepStatus = (stepId) => {
    if (completedSteps.has(stepId)) return 'done';
    if (wizardStep === stepId)       return 'active';
    return 'locked';
  };

  /* ── file upload handler ── */
  const handleFileUpload = async (responseData) => {
    const fileInfo = responseData.file || responseData;
    completeStep('upload');
    setProcessing('extracting');
    setWizardStep('topics');

    try {
      const extractResponse = await extractTextFromFile(fileInfo.filename, fileInfo.mimetype);
      const extractionData  = extractResponse.data || extractResponse;

      if (extractionData?.text) {
        setExtractedText(extractionData.text);
        setProcessing('topics');

        const topicsResult = await topicExtraction.extract(extractionData.text);
        if (topicsResult) {
          setTopicsData(topicsResult);
          completeStep('topics');
          setProcessing(null);
          setWizardStep('mindmap');

          // ── Create a new MongoDB session for this syllabus ──
          if (user) {
            // Use the extracted subject/topic name as the session title
            // Fall back to a cleaned filename (strip extension + timestamp junk)
            const rawName  = fileInfo.originalname || fileInfo.filename || ''
            const cleaned  = rawName.replace(/\.[^.]+$/, '').replace(/-\d{10,}-\d+$/, '').replace(/[-_]/g, ' ').trim()
            const sid = await createSession(user.uid, {
              title:        topicsResult.subject || topicsResult.topics?.[0]?.name || cleaned || 'Uploaded Syllabus',
              subject:      topicsResult.subject || '',
              extractedText: extractionData.text,
              topicsData:   topicsResult,
            });
            if (sid) setActiveSessionId(sid);
          }
        } else {
          errorHandler.handleError({ message: topicExtraction.error || 'Failed to extract topics' });
          setProcessing(null);
        }
      } else {
        errorHandler.handleError({ message: 'Failed to extract text from the file' });
        setProcessing(null);
      }
    } catch (err) {
      errorHandler.handleError({ message: err.message || 'Extraction failed' });
      setProcessing(null);
    }
  };

  /* ── build graph + generate questions when topics arrive ── */
  useEffect(() => {
    if (topicsData?.topics) {
      graph.convertTopicsToGraph(topicsData.topics, topicsData.subject || '');
      if (topicsData.topics.length > 0) {
        questionGeneration.generate(topicsData.topics, extractedText).then((qData) => {
          completeStep('questions');
          // Update session with generated questions
          if (activeSessionId && qData)
            updateSessionData(activeSessionId, { questionsData: qData });
        });
        dependencyAnalysis.analyze(topicsData.topics, extractedText).then((depData) => {
          if (activeSessionId && depData)
            updateSessionData(activeSessionId, { dependencyData: depData });
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicsData]);

  /* ── auto-complete mindmap step when user reaches it ── */
  useEffect(() => {
    if (wizardStep === 'mindmap' && topicsData) {
      completeStep('mindmap');
    }
  }, [wizardStep, topicsData]);

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

  useEffect(() => {
    if (topicsData && user && extractedText)
      persistGraphData(user.uid, topicsData, extractedText).catch(err => console.error(err));
  }, [topicsData, user, extractedText]);

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
    setEvaluationData(prev => {
      const merged = { ...prev, ...ev };
      // 1. localStorage
      localStorage.setItem('learningEvaluationData', JSON.stringify(merged));
      // Notify Dashboard in the same tab
      window.dispatchEvent(new StorageEvent('storage', { key: 'learningEvaluationData' }));
      // 2. MongoDB progress (legacy)
      if (user) persistEvaluation(user.uid, merged);
      // 3. Session-level evaluation (per-syllabus progress)
      if (activeSessionId) saveSessionEvaluation(activeSessionId, ev);
      return merged;
    });
    if (Object.keys(ev).length > 0) completeStep('practice');
  };

  /* ── handle practice complete ── */
  const handlePracticeComplete = () => {
    completeStep('practice');
    setPracticeTopicId(null); // return to topic grid, NOT to depgraph
  };

  /* ── go to root cause TAB (from practice / study plan) ── */
  const handleGoToRootCause = async (topic) => {
    setSelectedWeakTopic(topic);
    setWizardStep('rootcause');
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
    if (processing === 'topics')     return <ProcessingCard title="AI is analysing topics" subtitle="Breaking down your syllabus into concepts and subtopics" />;

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
            const name     = typeof t === 'string' ? t : t.name;
            const subs     = typeof t === 'string' ? [] : (t.subtopics ?? []);
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
    const allQ    = questionGeneration.questionsData?.questions ?? [];
    const getName = t => (typeof t === 'string' ? t : t.name);

    // \u2500\u2500 QUIZ VIEW when a node has been clicked \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    if (practiceTopicId) {
      const ev        = evaluationData[practiceTopicId];
      const rating    = ev?.rating;
      const nodeColor = rating === 'strong'  ? '#22c55e'
                      : rating === 'partial' || rating === 'moderate' ? '#f59e0b'
                      : rating === 'weak'    ? '#ef4444' : '#9ca3af';

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
              onWeakAnswerDetected={() => {}}
              onComplete={() => { completeStep('mindmap'); setPracticeTopicId(null); }}
            />
          ) : (
            <div className="t-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
              <p style={{ fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>Could not generate questions</p>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: 20 }}>
                Make sure Ollama is running, then try again.
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
    return (
      <>
        <SectionHeader
          title="Concept Mind Map"
          subtitle="Click any topic or subtopic node to start a quiz on it"
        />
        {/* sub-tab */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '2px solid rgba(99,102,241,0.1)', paddingBottom: -1 }}>
          {[['mindmap','Mind Map'],['graph','Graph View']].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setMapTab(key)}
              style={{
                padding: '9px 18px', border: 'none', background: 'none',
                fontFamily: 'inherit', fontWeight: 600, fontSize: '0.875rem',
                cursor: 'pointer', marginBottom: -2,
                borderBottom: `2px solid ${mapTab === key ? '#6366f1' : 'transparent'}`,
                color: mapTab === key ? '#6366f1' : 'var(--text-muted)',
                transition: 'color 0.18s, border-color 0.18s',
              }}
            >{label}</button>
          ))}
        </div>
        {mapTab === 'mindmap' && topicsData && (
          <MindMapViewer
            topics={topicsData.topics}
            subject={topicsData.subject || ''}
            evaluationData={evaluationData}
            onTopicClick={name => { setPracticeTopicId(name); }}
          />
        )}
        {mapTab === 'graph' && graph.graph && (
          <GraphViewer
            graph={graph.graph}
            stats={graph.stats}
            evaluationData={evaluationData}
            onExport={(fmt) => { if (fmt === 'json') graph.exportAsJSON(); else graph.exportAsCSV(); }}
          />
        )}
      </>
    );
  };

  const renderPractice = () => {
    const topics    = topicsData?.topics ?? [];
    const getName   = t => (typeof t === 'string' ? t : t.name);
    const allQ      = questionGeneration.questionsData?.questions ?? [];

    // ── TOPIC GRID (no topic selected) ─────────────────────────
    if (!practiceTopicId) {
      const totalTopics  = topics.length;
      const masteredCount = topics.filter(t => evaluationData[getName(t)]?.rating === 'strong').length;
      const allGreen     = masteredCount === totalTopics && totalTopics > 0;

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
              const name    = getName(t);
              const ev      = evaluationData[name];
              const rating  = ev?.rating;
              const score   = ev?.score ?? ev?.confidence ?? null;
              const qCount  = allQ.filter(q => q.topic === name || q.parentTopic === name).length;

              const nodeColor = rating === 'strong'  ? '#22c55e'
                              : rating === 'partial' || rating === 'moderate' ? '#f59e0b'
                              : rating === 'weak'    ? '#ef4444'
                              : '#9ca3af';

              const ratingLabel = rating === 'strong'  ? 'Mastered'
                                : rating === 'partial' || rating === 'moderate' ? 'In Progress'
                                : rating === 'weak'    ? 'Needs Work'
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

    const ev      = evaluationData[practiceTopicId];
    const rating  = ev?.rating;
    const nodeColor = rating === 'strong'  ? '#22c55e'
                    : rating === 'partial' || rating === 'moderate' ? '#f59e0b'
                    : rating === 'weak'    ? '#ef4444' : '#9ca3af';

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
            onWeakAnswerDetected={() => {}}
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
    const answeredEntries = Object.entries(evaluationData).filter(([, ev]) => ev?.rating);
    const answeredCount   = answeredEntries.length;

    /* colour helpers */
    const ratingColor  = r => r === 'strong' ? '#22c55e' : r === 'partial' || r === 'moderate' ? '#f59e0b' : r === 'weak' ? '#ef4444' : '#9ca3af';
    const ratingLabel  = r => r === 'strong' ? 'Strong' : r === 'partial' || r === 'moderate' ? 'Partial' : r === 'weak' ? 'Needs Work' : 'Untested';

    return (
      <>
        <SectionHeader
          title="Prerequisite Knowledge Graph"
          subtitle="For each topic you've practised, the AI identifies what foundational knowledge you're missing"
        />

        {answeredCount === 0 ? (
          <div style={{ padding: '40px 32px', textAlign: 'center', background: '#f8faff', borderRadius: 14, border: '1.5px solid #e2e8f0' }}>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginBottom: 8 }}>No quiz results yet</p>
            <p style={{ fontSize: '0.85rem', color: '#6b7280', maxWidth: 380, margin: '0 auto 20px' }}>
              Click any node in the Mind Map to take a quiz. After answering, come back here to see which prerequisite concepts you're missing.
            </p>
            <button onClick={() => setWizardStep('mindmap')} className="t-btn t-btn-primary t-btn-sm">
              Go to Mind Map →
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {answeredEntries.map(([topicName, ev]) => {
              const rating   = ev.rating;
              const score    = ev.score ?? 0;
              const missing  = ev.missingConcepts ?? [];
              const improvements = ev.improvements ?? [];
              const color    = ratingColor(rating);
              const isWeak   = rating === 'weak';
              const isPartial = rating === 'partial' || rating === 'moderate';
              const needsWork = isWeak || isPartial;

              /* Is this the one currently being deep-analysed? */
              const isSelected = selectedWeakTopic === topicName;
              const isAnalysing = isSelected && weaknessAnalysis.isAnalyzing;

              return (
                <div key={topicName} className="t-card" style={{
                  padding: '20px 22px',
                  borderLeft: `4px solid ${color}`,
                  background: isWeak ? '#fffafa' : isPartial ? '#fffdf5' : '#f9fffe',
                }}>
                  {/* ── Header row ── */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 12, height: 12, borderRadius: '50%', background: color, flexShrink: 0 }} />
                      <p style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{topicName}</p>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                        background: `${color}20`, color, textTransform: 'uppercase',
                      }}>{ratingLabel(rating)}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6366f1' }}>{score}%</span>
                    </div>
                    {needsWork && (
                      <button
                        onClick={() => handleDeepAnalyse(topicName)}
                        disabled={isAnalysing}
                        className="t-btn t-btn-danger t-btn-sm"
                      >
                        {isAnalysing
                          ? 'Analysing…'
                          : (isSelected && weaknessAnalysis.weaknessTrace)
                            ? 'Hide Analysis ✕'
                            : 'Deep Analyse with AI'}
                      </button>
                    )}
                  </div>

                  {/* ── Missing concepts as prerequisite nodes ── */}
                  {missing.length > 0 ? (
                    <div>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                        Prerequisite gaps identified by AI
                      </p>
                      {/* Visual tree: topic → missing concepts */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>
                        {/* Root node */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 120 }}>
                          <div style={{
                            padding: '8px 14px', borderRadius: 10,
                            background: `${color}15`, border: `2px solid ${color}`,
                            fontSize: '0.78rem', fontWeight: 700, color, textAlign: 'center',
                            maxWidth: 130,
                          }}>
                            {topicName}
                          </div>
                        </div>

                        {/* Arrow + prerequisites */}
                        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 12px', paddingTop: 10 }}>
                          <span style={{ fontSize: '1.1rem', color: '#94a3b8' }}>←</span>
                          <span style={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 600, whiteSpace: 'nowrap' }}>requires</span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
                          {missing.map((concept, ci) => (
                            <div key={ci} style={{
                              padding: '8px 14px', borderRadius: 10,
                              background: '#fff1f2', border: '2px solid #fca5a5',
                              fontSize: '0.78rem', fontWeight: 600, color: '#b91c1c',
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0, display: 'inline-block' }} />
                              {concept}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Improvement hints */}
                      {improvements.length > 0 && (
                        <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)' }}>
                          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6366f1', marginBottom: 6 }}>What to study next:</p>
                          <ul style={{ paddingLeft: 16, margin: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {improvements.slice(0, 3).map((tip, ti) => (
                              <li key={ti} style={{ fontSize: '0.78rem', color: '#374151' }}>{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : rating === 'strong' ? (
                    <p style={{ fontSize: '0.82rem', color: '#15803d', fontWeight: 500 }}>
                      No prerequisite gaps — you demonstrated solid understanding of this topic.
                    </p>
                  ) : (
                    <p style={{ fontSize: '0.82rem', color: '#6b7280' }}>
                      Answer the questions for this topic to see your prerequisite gaps.
                    </p>
                  )}

                  {/* ── Deep AI Analysis result (from Ollama) ── */}
                  {isSelected && !isAnalysing && weaknessAnalysis.weaknessTrace && (
                    <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1.5px solid #f1f5f9' }}>
                      <p style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                        AI Deep Analysis
                      </p>
                      <WeaknessTraceViewer
                        weaknessTrace={weaknessAnalysis.weaknessTrace}
                        isLoading={false}
                        error={weaknessAnalysis.error}
                        onSelectConcept={() => {}}
                      />
                    </div>
                  )}
                  {isSelected && isAnalysing && (
                    <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: '0.82rem' }}>
                      <div className="t-spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
                      Ollama is tracing prerequisite gaps for "{topicName}"…
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </>
    );
  };



  const renderRootCause = () => {
    const topics = topicsData?.topics ?? [];
    const getName = t => (typeof t === 'string' ? t : t.name);
    const weakTopics = topics
      .map(getName)
      .filter(name => evaluationData[name]?.rating === 'weak');

    return (
      <>
        <SectionHeader
          title="Root Cause Analysis"
          subtitle="Find which foundational concepts are causing gaps in your understanding"
        />

        {/* topic selector */}
        <div className="t-card" style={{ padding: '18px 20px', marginBottom: 20 }}>
          <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Select a topic to analyse
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {topics.map((t) => {
              const name   = getName(t);
              const rating = evaluationData[name]?.rating;
              const isWeak = rating === 'weak';
              const isSel  = selectedWeakTopic === name;
              return (
                <button
                  key={name}
                  onClick={() => handleGoToRootCause(name)}
                  style={{
                    padding: '7px 14px', borderRadius: 8, fontWeight: 600,
                    fontSize: '0.83rem', cursor: 'pointer', fontFamily: 'inherit',
                    border: `2px solid ${isWeak ? '#fca5a5' : isSel ? '#818cf8' : '#e2e8f0'}`,
                    background: isWeak ? '#fef2f2' : isSel ? '#eff6ff' : '#f8faff',
                    color: isWeak ? '#991b1b' : isSel ? '#1d4ed8' : '#374151',
                    outline: isSel ? '2px solid #6366f1' : 'none', outlineOffset: 2,
                    transition: 'all 0.18s',
                  }}
                >
                  {name}
                </button>
              );
            })}
          </div>
          {weakTopics.length === 0 && (
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 10 }}>
              No weak topics found yet — complete practice first.
            </p>
          )}
        </div>

        {/* trace result */}
        {selectedWeakTopic && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <h3 style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>
                Analysing: <span style={{ color: '#ef4444' }}>"{selectedWeakTopic}"</span>
              </h3>
            </div>
            <WeaknessTraceViewer
              weaknessTrace={weaknessAnalysis.weaknessTrace}
              isLoading={weaknessAnalysis.isAnalyzing}
              error={weaknessAnalysis.error}
              onSelectConcept={() => {}}
            />
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
  };

  const activeContent = CONTENT_MAP[wizardStep]?.() ?? null;
  const currentIdx    = STEPS.findIndex(s => s.id === wizardStep);

  /* ─── layout ────────────────────────────────────────────────── */
  return (
    <div>
      {/* page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.03em', marginBottom: 4 }}>
          Concept Visualization
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Upload your syllabus and follow the steps to master every topic
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Left: step sidebar ── */}
        <div className="t-card" style={{ padding: '12px 8px', position: 'sticky', top: 84 }}>
          {/* connector spine — only show completed + active + next step */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {(() => {
              // Determine the last completed step index
              const lastDoneIdx = STEPS.reduce((acc, s, i) =>
                completedSteps.has(s.id) ? i : acc, -1);
              // Show up to lastDoneIdx + 2 (current active + one peek ahead)
              const visibleUpTo = Math.min(lastDoneIdx + 2, STEPS.length - 1);

                return STEPS.slice(0, visibleUpTo + 1).map((step, idx) => {
                const status    = stepStatus(step.id);
                const canClick  = canAccess(step.id);
                const isCurrent = wizardStep === step.id;
                const isLast    = idx === visibleUpTo;

                return (
                  <React.Fragment key={step.id}>
                    <StepItem
                      step={step}
                      index={idx}
                      status={status}
                      isCurrent={isCurrent}
                      canClick={canClick}
                      onClick={goTo}
                    />
                    {/* connector line — only between visible steps */}
                    {!isLast && (
                      <div style={{
                        width: 2, height: 10,
                        marginLeft: 31,
                        background: completedSteps.has(step.id)
                          ? '#22c55e'
                          : 'rgba(99,102,241,0.12)',
                        borderRadius: 999,
                        transition: 'background 0.3s',
                      }} />
                    )}
                  </React.Fragment>
                );
              });
            })()}
          </div>

          {/* reset */}
          {completedSteps.size > 0 && (
            <button
              onClick={handleReset}
              className="t-btn t-btn-ghost t-btn-sm"
              style={{ width: '100%', marginTop: 16 }}
            >
              🔄 Start Over
            </button>
          )}
        </div>

        {/* ── Right: active step content ── */}
        <div>
          {/* step breadcrumb pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
            <span style={{
              padding: '4px 14px', borderRadius: 999,
              background: 'linear-gradient(135deg, #6366f1, #3b82f6)',
              color: '#fff', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.02em',
            }}>
              Step {currentIdx + 1} of {STEPS.length}
            </span>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {STEPS[currentIdx]?.desc}
            </span>
          </div>

          <div className="t-card t-animate-in" key={wizardStep} style={{ padding: '28px' }}>
            {activeContent}
          </div>

          {/* next step CTA — on mindmap only show after at least one quiz is answered */}
          {completedSteps.has(wizardStep) &&
           (wizardStep !== 'mindmap' || Object.keys(evaluationData).length > 0) &&
           STEPS[currentIdx + 1] && (
            <div style={{
              marginTop: 14, padding: '12px 18px', borderRadius: 10,
              background: 'rgba(34,197,94,0.06)', border: '1.5px solid rgba(34,197,94,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#22c55e', fontSize: '1rem' }}>✓</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#166534' }}>
                  {wizardStep === 'mindmap'
                    ? `Quiz complete! View your Prerequisite Graph.`
                    : 'This step is complete!'}
                </span>
              </div>
              <button
                onClick={() => goTo(STEPS[currentIdx + 1]?.id)}
                className="t-btn t-btn-primary t-btn-sm"
              >
                {wizardStep === 'mindmap' ? 'Prerequisite Graph' : STEPS[currentIdx + 1]?.label} →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* error display */}
      {errorHandler.error && (
        <div style={{ marginTop: 20 }}>
          <ErrorDisplay
            error={errorHandler.error}
            onDismiss={() => errorHandler.clearError()}
            onRetry={() => { if (wizardStep === 'upload') handleReset(); }}
          />
        </div>
      )}
    </div>
  );
};

export default ConceptGraphPage;
