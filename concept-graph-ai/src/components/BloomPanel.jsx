/**
 * BloomPanel.jsx
 * Shows Bloom's Taxonomy progress for a selected concept.
 * Lets the user pick a level and practice questions.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import DependencyGraph from './DependencyGraph';

const BLOOM_ORDER = ['remember','understand','apply','analyze','evaluate','create'];
const BLOOM_META  = {
  remember:  { label:'Remember',  color:'#94a3b8', desc:'Recall facts & definitions' },
  understand:{ label:'Understand',color:'#60a5fa', desc:'Explain in your own words' },
  apply:     { label:'Apply',     color:'#34d399', desc:'Solve new problems' },
  analyze:   { label:'Analyze',   color:'#f59e0b', desc:'Break down & compare' },
  evaluate:  { label:'Evaluate',  color:'#f97316', desc:'Judge & critique' },
  create:    { label:'Create',    color:'#a855f7', desc:'Design novel solutions' },
};
const API = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

/* ─── shared spinner ──────────────────────────────────────────────── */
const spinStyle = `
@keyframes bloom-spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.bloom-spinner {
  width: 28px; height: 28px;
  border: 3px solid #e2e8f0;
  border-top-color: #6366f1;
  border-radius: 50%;
  animation: bloom-spin 0.7s linear infinite;
  flex-shrink: 0;
}
`;
if (typeof document !== 'undefined' && !document.getElementById('bloom-spin-css')) {
  const s = document.createElement('style');
  s.id = 'bloom-spin-css';
  s.textContent = spinStyle;
  document.head.appendChild(s);
}

const Spinner = ({ label = 'Loading…', size = 28, color = '#6366f1' }) => (
  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'32px 0' }}>
    <div className="bloom-spinner" style={{ width:size, height:size,
      borderColor:'#e2e8f0', borderTopColor:color }} />
    <span style={{ fontSize:'0.8rem', color:'#6b7280' }}>{label}</span>
  </div>
);

/* Score → rating mapping (mirrors QuizMindMap ratingColor thresholds) */
const scoreToRating = (score) =>
  score >= 70 ? 'strong' : score >= 40 ? 'partial' : 'weak';

/* ─── Dynamic question count based on topic complexity ─────────────────
   Short topic (≤ 2 words or ≤ 15 chars) → 2 questions
   Medium topic (3-5 words or ≤ 35 chars) → 4 questions
   Long / complex topic (module with subtopics, or long name) → 6 questions
─────────────────────────────────────────────────────────────────────── */
function computeQuestionCount(concept, subtopics = []) {
  // If it's a module node (has subtopics), scale with sub-topic count
  if (subtopics.length > 0) {
    // 2 questions per subtopic, min 4, max 12
    return Math.min(12, Math.max(4, subtopics.length * 2));
  }
  const words = concept.trim().split(/\s+/).length;
  const chars = concept.trim().length;
  if (words <= 2 && chars <= 15) return 2;
  if (words <= 5 && chars <= 35) return 4;
  return 6;
}

export default function BloomPanel({ concept, parentTopic, subtopics = [], onClose, inline = false, onQuizComplete, ragDocumentId = null, syllabusId = '' }) {
  const { user } = useAuth();
  const userId   = user?.uid || user?.id || 'guest';

  const [progress,    setProgress]   = useState(null);
  const [activeLevel, setActiveLevel]= useState(null);
  const [quizType,    setQuizType]   = useState(null);
  const [pickingType, setPickingType]= useState(null);
  const [questions,   setQuestions]  = useState([]);
  const [answers,     setAnswers]    = useState({});
  const [results,     setResults]    = useState({});
  const [mcqPicked,   setMcqPicked]  = useState({});
  const [loading,     setLoading]    = useState(false);
  const [qError,      setQError]     = useState(null);
  const [evalLoading, setEvalLoading]= useState({});
  const [tab,         setTab]        = useState('progress');
  const [depIssues,   setDepIssues]  = useState(undefined); // undefined=untriggered, obj=done
  const [depLoading,  setDepLoading] = useState(false);

  /* ── load progress ── */
  const loadProgress = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/bloom/${encodeURIComponent(concept)}?userId=${userId}`);
      const j = await r.json();
      if (j.success) setProgress(j.data);
    } catch (err) { console.error(err); }
  }, [concept, userId]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  /* ── when a level row is clicked: show type picker ── */
  const handleLevelClick = (level) => {
    setPickingType(level);
    setActiveLevel(level);
    setTab('quiz');
    setQuestions([]); setAnswers({}); setResults({}); setMcqPicked({}); setQError(null);
  };

  /* ── load questions after type is chosen ── */
  const loadQuestions = async (level, type) => {
    setPickingType(null);
    setQuizType(type);
    setTab('quiz');
    setQuestions([]); setAnswers({}); setResults({}); setMcqPicked({}); setQError(null);
    setLoading(true);
    // Compute dynamic question count based on topic length / subtopic breadth
    const n = computeQuestionCount(concept, subtopics);
    try {
      const r = await fetch(`${API}/api/bloom/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          concept,
          bloomLevel: level,
          parentTopic,
          quizType: type,
          n,
          // If this is a module/topic node, pass its subtopics so the backend
          // can generate questions covering all sub-topics breadth
          subtopics: subtopics.length > 0 ? subtopics : undefined,
          // RAG params — enables content-grounded question generation
          syllabusId:    syllabusId || undefined,
          ragDocumentId: ragDocumentId || undefined,
        }),
      });
      const j = await r.json();
      if (j.success && j.questions?.length) {
        setQuestions(j.questions);
      } else {
        setQError(j.error || 'No questions returned. Make sure Ollama is running.');
      }
    } catch (err) {
      setQError('Could not reach backend. Is the server running on port 5000?');
      console.error(err);
    }
    finally { setLoading(false); }
  };

  /* ── evaluate one answer ── */
  const evaluate = async (idx) => {
    const q = questions[idx];
    const a = answers[idx];
    if (!a?.trim()) return;
    setEvalLoading(p => ({ ...p, [idx]: true }));

    // Increment the global "questions answered" counter so Dashboard updates
    const prevQ = parseInt(localStorage.getItem('answeredQuestionsCount') || '0', 10);
    localStorage.setItem('answeredQuestionsCount', String(prevQ + 1));
    window.dispatchEvent(new StorageEvent('storage', { key: 'answeredQuestionsCount' }));

    try {
      const r = await fetch(`${API}/api/bloom/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId, concept, bloomLevel: activeLevel, question: q.question, answer: a,
          // RAG params
          syllabusId:    syllabusId || undefined,
          ragDocumentId: ragDocumentId || undefined,
        }),
      });
      const j = await r.json();
      if (j.success) {
        setResults(p => {
          const next = { ...p, [idx]: j.result };
          const total = questions.length;
          if (Object.keys(next).length >= total && total > 0) {
            loadDepGraph(activeLevel, questions, next, mcqPicked);
          }
          return next;
        });
        setProgress(j.bloomProgress);
      }
    } catch (err) { console.error(err); }
    finally { setEvalLoading(p => ({ ...p, [idx]: false })); }
  };

  const loadDepGraph = async (level, qList, resMap, mcqMap) => {
    setDepLoading(true);
    setDepIssues(undefined);
    try {
      // Build quizResults from actual answers
      const quizResults = qList.map((q, i) => {
        if (q.type === 'mcq') {
          const picked = mcqMap[i];
          return { question: q.question, correct: picked === q.correct };
        } else {
          const r = resMap[i];
          return { question: q.question, score: r ? r.total : 0 };
        }
      });
      const r = await fetch(`${API}/api/bloom/analyze-deps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept, bloomLevel: level, parentTopic, quizResults }),
      });
      const j = await r.json();
      const finalScore = j.success ? (j.score ?? 0) : 0;
      const finalRating = scoreToRating(finalScore);
      const finalNodes = j.success ? (j.nodes || []) : [];
      const finalImprovements = j.success ? (j.improvements || []) : [];
      if (j.success) setDepIssues({ score: finalScore, nodes: finalNodes });
      else setDepIssues({ score: 0, nodes: [] });
      // ── Notify parent so the mind map node recolours AND dep graph is stored ──
      if (onQuizComplete) {
        onQuizComplete({
          concept,
          score: finalScore,
          rating: finalRating,
          nodes: finalNodes,
          improvements: finalImprovements,
        });
      }
    } catch (err) {
      console.error('depGraph:', err);
      setDepIssues({ score: 0, nodes: [] });
      // Still notify with a 0 score so the node shows as weak
      if (onQuizComplete) {
        onQuizComplete({ concept, score: 0, rating: 'weak', nodes: [], improvements: [] });
      }
    } finally {
      setDepLoading(false);
    }
  };

  const getNextLevel = () => {
    if (!progress) return BLOOM_ORDER[0];
    const reached = BLOOM_ORDER.indexOf(progress.bloomLevelReached);
    return BLOOM_ORDER[reached + 1] || null;
  };

  /* ── styles ── */
  const S = {
    overlay:   { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(3px)', zIndex:10000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
    modal:     { background:'#fff', borderRadius:20, width:'100%', maxWidth:680, maxHeight:'90vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'0 24px 80px rgba(0,0,0,0.22)' },
    header:    { padding:'20px 24px 16px', borderBottom:'1px solid #f1f5f9', display:'flex', alignItems:'center', justifyContent:'space-between' },
    tabs:      { display:'flex', gap:4, padding:'0 24px', borderBottom:'1px solid #f1f5f9' },
    tab:       (active) => ({ padding:'10px 16px', fontSize:'0.82rem', fontWeight:600, border:'none', background:'none', cursor:'pointer', color: active ? '#6366f1' : '#94a3b8', borderBottom: active ? '2px solid #6366f1' : '2px solid transparent' }),
    body:      { padding:24, overflowY:'auto', flex:1 },
    levelRow:  (achieved, active) => ({ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:12, marginBottom:8, background: achieved ? '#f0fdf4' : active ? '#eef2ff' : '#f8faff', border:`1.5px solid ${achieved ? '#bbf7d0' : active ? '#c7d2fe' : '#e2e8f0'}`, cursor:'pointer', transition:'all 0.15s' }),
    bar:       (color, pct) => ({ height:6, borderRadius:3, background:'#e2e8f0', overflow:'hidden', flex:1, position:'relative' }),
    barFill:   (color, pct) => ({ height:'100%', width:`${pct}%`, background:color, borderRadius:3, transition:'width 0.4s ease' }),
    badge:     (color) => ({ fontSize:'0.68rem', fontWeight:700, padding:'2px 8px', borderRadius:999, background: color+'22', color, border:`1px solid ${color}55` }),
    stepCard:  (type) => ({ padding:'14px 16px', borderRadius:12, marginBottom:10, background: type==='target' ? '#eef2ff' : type==='prerequisite' ? '#fff7ed' : '#f8faff', border:`1.5px solid ${type==='target' ? '#c7d2fe' : type==='prerequisite' ? '#fed7aa' : '#e2e8f0'}` }),
  };

  const inner = (
    <div style={inline ? { display:'flex', flexDirection:'column', height:'100%' } : S.modal}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h3 style={{ margin:0, fontSize:'1rem', fontWeight:700, color:'#1e293b' }}>{concept}</h3>
          <p style={{ margin:0, fontSize:'0.78rem', color:'#6b7280', marginTop:2 }}>
            Bloom's Taxonomy Progress
            {progress && progress.bloomLevelReached !== 'none' && (
              <span style={{ marginLeft:8, ...S.badge('#6366f1') }}>Reached: {progress.bloomLevelReached}</span>
            )}
          </p>
        </div>
        <button onClick={onClose} style={{ border:'none', background:'#f1f5f9', borderRadius:8, width:32, height:32, cursor:'pointer', fontSize:'1rem', color:'#6b7280' }}>✕</button>
      </div>

        {/* Tabs */}
        <div style={S.tabs}>
          {[['progress','Progress'],['quiz','Practice']].map(([k,l]) => (
            <button key={k} style={S.tab(tab===k)} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        <div style={S.body}>

          {/* ── PROGRESS TAB ── */}
          {tab === 'progress' && (
            <div>
              <p style={{ fontSize:'0.8rem', color:'#6b7280', marginBottom:16 }}>
                Click a level to practice questions at that level.
              </p>
              {BLOOM_ORDER.map((lvl, idx) => {
                const meta     = BLOOM_META[lvl];
                const score    = progress?.bloom?.[lvl]?.score ?? 0;
                const achieved = progress?.bloom?.[lvl]?.achieved ?? false;
                const attempts = progress?.bloom?.[lvl]?.attempts ?? 0;
                const reached  = BLOOM_ORDER.indexOf(progress?.bloomLevelReached ?? 'none');
                // unlock all levels if new user (reached=-1), otherwise unlock up to reached+1
                const locked   = reached >= 0 && idx > reached + 1;
                return (
                  <div key={lvl} style={S.levelRow(achieved, activeLevel===lvl)} onClick={() => !locked && handleLevelClick(lvl)}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background: meta.color, flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ fontSize:'0.82rem', fontWeight:700, color:'#1e293b' }}>{meta.label}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          {attempts > 0 && <span style={{ fontSize:'0.7rem', color:'#94a3b8' }}>{attempts} attempt{attempts>1?'s':''}</span>}
                          <span style={S.badge(achieved ? '#22c55e' : locked ? '#94a3b8' : meta.color)}>
                            {achieved ? `${score}%` : locked ? 'Locked' : `${score}%`}
                          </span>
                        </div>
                      </div>
                      <div style={S.bar(meta.color, score)}>
                        <div style={S.barFill(meta.color, score)} />
                      </div>
                      <p style={{ margin:'4px 0 0', fontSize:'0.72rem', color:'#6b7280' }}>{meta.desc}</p>
                    </div>
                  </div>
                );
              })}
              {getNextLevel() && (
                <div style={{ marginTop:16, padding:'12px 16px', borderRadius:12, background:'#eef2ff', border:'1.5px solid #c7d2fe', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'0.82rem', fontWeight:600, color:'#6366f1' }}>Next target: {getNextLevel()}</span>
                  <button onClick={() => handleLevelClick(getNextLevel())} style={{ padding:'6px 14px', borderRadius:8, border:'none', background:'#6366f1', color:'#fff', fontSize:'0.78rem', fontWeight:600, cursor:'pointer' }}>
                    Start →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── QUIZ TAB ── */}
          {tab === 'quiz' && (
            <div>
              {/* No level selected yet — show level picker inline */}
              {!activeLevel && !pickingType && !loading && (
                <div>
                  <p style={{ fontSize:'0.8rem', color:'#6b7280', marginBottom:16 }}>Select a level to practice:</p>
                  {BLOOM_ORDER.map((lvl) => {
                    const meta = BLOOM_META[lvl];
                    return (
                      <div key={lvl}
                        onClick={() => handleLevelClick(lvl)}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:12,
                          marginBottom:8, background:'#f8faff', border:'1.5px solid #e2e8f0', cursor:'pointer' }}>
                        <div style={{ width:10, height:10, borderRadius:'50%', background: meta.color, flexShrink:0 }} />
                        <div>
                          <p style={{ margin:0, fontSize:'0.82rem', fontWeight:700, color:'#1e293b' }}>{meta.label}</p>
                          <p style={{ margin:0, fontSize:'0.72rem', color:'#6b7280' }}>{meta.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Level + type badge */}
              {activeLevel && (
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16, flexWrap:'wrap' }}>
                  <div style={{ width:10, height:10, borderRadius:'50%', background: BLOOM_META[activeLevel]?.color }} />
                  <span style={{ fontWeight:700, color: BLOOM_META[activeLevel]?.color, fontSize:'0.9rem' }}>
                    {BLOOM_META[activeLevel]?.label} Level
                  </span>
                  <span style={{ fontSize:'0.78rem', color:'#94a3b8' }}>— {BLOOM_META[activeLevel]?.desc}</span>
                  {quizType && (
                    <span style={{ marginLeft:'auto', fontSize:'0.7rem', fontWeight:700, padding:'2px 10px', borderRadius:999,
                      background: quizType==='objective' ? '#eff6ff' : '#f0fdf4',
                      color: quizType==='objective' ? '#3b82f6' : '#16a34a',
                      border: `1px solid ${quizType==='objective' ? '#bfdbfe' : '#bbf7d0'}` }}>
                      {quizType === 'objective' ? 'MCQ' : 'Subjective'}
                    </span>
                  )}
                  <button onClick={() => handleLevelClick(activeLevel)}
                    style={{ fontSize:'0.7rem', color:'#6b7280', background:'#f1f5f9', border:'none', borderRadius:6, padding:'2px 8px', cursor:'pointer' }}>
                    Change type
                  </button>
                </div>
              )}

              {/* ── Type picker ── */}
              {pickingType && (
                <div style={{ textAlign:'center', padding:'32px 16px' }}>
                  <p style={{ fontWeight:700, fontSize:'0.95rem', color:'#1e293b', marginBottom:6 }}>Choose Quiz Type</p>
                  <p style={{ fontSize:'0.8rem', color:'#6b7280', marginBottom:24 }}>
                    <strong>{BLOOM_META[pickingType]?.label}</strong> level — {BLOOM_META[pickingType]?.desc}
                  </p>
                  <div style={{ display:'flex', gap:16, justifyContent:'center', flexWrap:'wrap' }}>
                    {[['subjective','Subjective','Open-ended written answers evaluated by AI','#6366f1'],
                      ['objective', 'Objective', 'Multiple choice (A/B/C/D) with instant feedback','#3b82f6']
                    ].map(([type, label, desc, color]) => (
                      <button key={type} onClick={() => loadQuestions(pickingType, type)}
                        style={{ padding:'18px 24px', borderRadius:14, border:`2px solid ${color}30`,
                          background:`${color}08`, cursor:'pointer', textAlign:'left', minWidth:180,
                          transition:'all 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.background=`${color}18`; e.currentTarget.style.borderColor=color; }}
                        onMouseLeave={e => { e.currentTarget.style.background=`${color}08`; e.currentTarget.style.borderColor=`${color}30`; }}>
                        <p style={{ fontWeight:700, color, fontSize:'0.9rem', margin:'0 0 4px' }}>{label}</p>
                        <p style={{ fontSize:'0.75rem', color:'#6b7280', margin:0, lineHeight:1.4 }}>{desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Loading questions ── */}
              {!pickingType && loading && (
                <Spinner label={`Generating ${quizType === 'objective' ? 'MCQ' : 'subjective'} questions with Ollama…`} />
              )}

              {/* ── Error ── */}
              {!pickingType && !loading && qError && (
                <div style={{ textAlign:'center', padding:32 }}>
                  <p style={{ color:'#ef4444', fontWeight:600, fontSize:'0.85rem', marginBottom:8 }}>Failed to generate questions</p>
                  <p style={{ color:'#6b7280', fontSize:'0.8rem', marginBottom:16 }}>{qError}</p>
                  <button onClick={() => loadQuestions(activeLevel, quizType)}
                    style={{ padding:'7px 18px', borderRadius:8, border:'none', background:'#6366f1', color:'#fff', fontWeight:600, fontSize:'0.82rem', cursor:'pointer' }}>Retry</button>
                </div>
              )}

              {/* ── Questions ── */}
              {!pickingType && !loading && !qError && questions.map((q, idx) => {
                const isMCQ = q.type === 'mcq';
                const picked = mcqPicked[idx];
                const res  = results[idx];

                return (
                  <div key={idx} style={{ marginBottom:20, padding:16, borderRadius:14, background:'#f8faff', border:'1.5px solid #e2e8f0' }}>
                    {/* Question header */}
                    <div style={{ display:'flex', gap:8, marginBottom:12, alignItems:'flex-start' }}>
                      <span style={{ background:'#6366f1', color:'#fff', borderRadius:6, padding:'2px 8px', fontSize:'0.72rem', fontWeight:700, minWidth:24, textAlign:'center', flexShrink:0 }}>{idx+1}</span>
                      <p style={{ margin:0, fontSize:'0.87rem', fontWeight:600, color:'#1e293b', lineHeight:1.5 }}>{q.question}</p>
                    </div>

                    {/* MCQ options */}
                    {isMCQ && (
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {Object.entries(q.options).map(([key, val]) => {
                          const isChosen  = picked === key;
                          const isCorrect = key === q.correct;
                          const revealed  = picked != null;
                          let bg = '#fff', border = '#e2e8f0', color = '#374151';
                          if (revealed && isCorrect)  { bg='#f0fdf4'; border='#22c55e'; color='#166534'; }
                          if (revealed && isChosen && !isCorrect) { bg='#fef2f2'; border='#ef4444'; color='#991b1b'; }
                          return (
                            <button key={key} disabled={revealed}
                              onClick={() => {
                                // Increment global question counter so Dashboard updates
                                const prevMCQ = parseInt(localStorage.getItem('answeredQuestionsCount') || '0', 10);
                                localStorage.setItem('answeredQuestionsCount', String(prevMCQ + 1));
                                window.dispatchEvent(new StorageEvent('storage', { key: 'answeredQuestionsCount' }));
                                setMcqPicked(p => {
                                  const next = { ...p, [idx]: key };
                                  if (Object.keys(next).length >= questions.length && questions.length > 0) {
                                    loadDepGraph(activeLevel, questions, results, next);
                                  }
                                  return next;
                                });
                              }}
                              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                                borderRadius:10, border:`1.5px solid ${border}`, background:bg,
                                cursor: revealed ? 'default' : 'pointer', textAlign:'left',
                                color, fontWeight: revealed && isCorrect ? 700 : 500,
                                fontSize:'0.84rem', transition:'all 0.15s' }}>
                              <span style={{ fontWeight:700, minWidth:20, color: revealed&&isCorrect?'#22c55e':revealed&&isChosen?'#ef4444':'#6366f1' }}>{key}</span>
                              {val}
                              {revealed && isCorrect && <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'#22c55e', fontWeight:700 }}>Correct</span>}
                              {revealed && isChosen && !isCorrect && <span style={{ marginLeft:'auto', fontSize:'0.75rem', color:'#ef4444', fontWeight:700 }}>Wrong</span>}
                            </button>
                          );
                        })}
                        {picked && q.explanation && (
                          <p style={{ margin:'8px 0 0', fontSize:'0.78rem', color:'#6b7280', lineHeight:1.5, padding:'10px 12px', background:'#f8faff', borderRadius:8, border:'1px solid #e2e8f0' }}>
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Subjective textarea + result */}
                    {!isMCQ && !res && (
                      <>
                        <textarea rows={4} value={answers[idx] || ''}
                          onChange={e => setAnswers(p => ({ ...p, [idx]: e.target.value }))}
                          placeholder="Type your answer here…"
                          style={{ width:'100%', borderRadius:10, border:'1.5px solid #e2e8f0', padding:'10px 12px', fontSize:'0.84rem', resize:'vertical', boxSizing:'border-box', outline:'none', fontFamily:'inherit' }} />
                        {evalLoading[idx] ? (
                          <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:8 }}>
                            <div className="bloom-spinner" style={{ width:20, height:20, borderWidth:2 }} />
                            <span style={{ fontSize:'0.78rem', color:'#6b7280' }}>Evaluating your answer with Ollama…</span>
                          </div>
                        ) : (
                          <button onClick={() => evaluate(idx)}
                            disabled={!answers[idx]?.trim()}
                            style={{ marginTop:8, padding:'7px 18px', borderRadius:8, border:'none',
                              background:'#6366f1', color:'#fff',
                              fontWeight:600, fontSize:'0.82rem', cursor:'pointer',
                              opacity: answers[idx]?.trim() ? 1 : 0.5 }}>
                            Submit Answer
                          </button>
                        )}
                      </>
                    )}
                    {!isMCQ && res && (
                      <div style={{ marginTop:8 }}>
                        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:10 }}>
                          {[['Score',`${res.total}%`,res.total>=65?'#22c55e':res.total>=45?'#f59e0b':'#ef4444'],
                            ['Bloom Reached',res.demonstratedLevel,'#6366f1'],
                            ['Accuracy',`${res.scores.accuracy}/25`,'#60a5fa'],
                            ['Depth',`${res.scores.depth}/25`,'#a855f7'],
                          ].map(([k,v,c]) => (
                            <div key={k} style={{ padding:'4px 10px', borderRadius:8, background:c+'15', border:`1px solid ${c}33` }}>
                              <span style={{ fontSize:'0.68rem', color:'#6b7280' }}>{k}: </span>
                              <span style={{ fontSize:'0.78rem', fontWeight:700, color:c }}>{v}</span>
                            </div>
                          ))}
                        </div>
                        <p style={{ fontSize:'0.82rem', color:'#374151', lineHeight:1.5, margin:'0 0 8px' }}>{res.feedback}</p>
                        {res.improvements?.length > 0 && (
                          <ul style={{ margin:0, padding:'0 0 0 16px', fontSize:'0.78rem', color:'#6b7280' }}>
                            {res.improvements.map((imp,i) => <li key={i}>{imp}</li>)}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── DEPENDENCY ANALYSIS loading ── */}
          {tab === 'quiz' && depLoading && (
            <div style={{ marginTop:24, borderTop:'1.5px solid #e2e8f0', paddingTop:20 }}>
              <Spinner label="Ollama is building dependency graph…" color="#6366f1" />
            </div>
          )}

          {/* ── DEPENDENCY ANALYSIS result ── */}
          {tab === 'quiz' && !depLoading && depIssues !== undefined && (
            <div style={{ marginTop:24, borderTop:'1.5px solid #e2e8f0', paddingTop:20 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                marginBottom:16, flexWrap:'wrap', gap:8 }}>
                <div>
                  <p style={{ fontWeight:700, fontSize:'0.88rem', color:'#1e293b', margin:'0 0 2px' }}>
                    Dependency Graph
                  </p>
                  <p style={{ fontSize:'0.74rem', color:'#6b7280', margin:0 }}>
                    AI-generated based on your quiz performance
                  </p>
                </div>
                <div style={{ padding:'6px 14px', borderRadius:10,
                  background: depIssues.score>=70?'#f0fdf4':depIssues.score>=40?'#fffbeb':'#fef2f2',
                  border:`1.5px solid ${depIssues.score>=70?'#22c55e':depIssues.score>=40?'#f59e0b':'#ef4444'}` }}>
                  <span style={{ fontSize:'0.7rem', color:'#6b7280' }}>Quiz Score </span>
                  <span style={{ fontWeight:700, fontSize:'0.9rem',
                    color: depIssues.score>=70?'#16a34a':depIssues.score>=40?'#b45309':'#dc2626' }}>
                    {depIssues.score}%
                  </span>
                </div>
              </div>
              {depIssues.nodes?.length > 0
                ? <DependencyGraph nodes={depIssues.nodes} />
                : <p style={{ textAlign:'center', color:'#6b7280', padding:24, fontSize:'0.82rem' }}>
                    No dependency data. Try re-running the quiz.
                  </p>
              }
            </div>
          )}

        </div>
      </div>
  );

  if (inline) return inner;
  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      {inner}
    </div>
  );
}
