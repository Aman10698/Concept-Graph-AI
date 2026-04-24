import React, { useState } from 'react';
import { useAnswerEvaluation } from '../hooks/useAnswerEvaluation';
import { useAuth } from '../context/AuthContext';
import { persistQuizResult } from '../services/dataPersistence';

/* ─── helpers ─────────────────────────────── */
const DIFFICULTY_META = {
  beginner:     { badge: 't-badge-green',  label: 'Beginner',     accent: '#22c55e' },
  intermediate: { badge: 't-badge-amber',  label: 'Intermediate', accent: '#f59e0b' },
  advanced:     { badge: 't-badge-red',    label: 'Advanced',     accent: '#ef4444' },
};

const RATING_META = {
  strong:  { color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.25)',  label: 'Strong' },
  partial: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', label: 'Partial' },
  weak:    { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  label: 'Needs Work' },
  moderate:{ color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.25)', label: 'Moderate' },
};

/* ─── component ───────────────────────────── */
const QuestionPractice = ({ questionsData, onComplete, onEvaluationUpdate, onWeakAnswerDetected }) => {
  const [currentIndex, setCurrentIndex]       = useState(0);
  const [answer, setAnswer]                   = useState('');
  const [submittedAnswers, setSubmittedAnswers] = useState({});
  const [answerEvaluations, setAnswerEvaluations] = useState({});

  const { isEvaluating, evaluate } = useAnswerEvaluation();
  const { user } = useAuth();

  if (!questionsData?.questions?.length) {
    return (
      <div className="t-card" style={{ textAlign: 'center', padding: '48px 32px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📭</div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>No questions available for practice.</p>
      </div>
    );
  }

  const questions        = questionsData.questions;
  const total            = questions.length;
  const currentQuestion  = questions[currentIndex];
  const isAnswered       = submittedAnswers.hasOwnProperty(currentIndex);
  const answeredCount    = Object.keys(submittedAnswers).length;
  const pct              = Math.round((answeredCount / total) * 100);
  const diff             = DIFFICULTY_META[currentQuestion.difficulty] ?? DIFFICULTY_META.beginner;
  const currentEval      = answerEvaluations[currentIndex];
  const ratingMeta       = currentEval ? (RATING_META[currentEval.rating] ?? RATING_META.partial) : null;

  /* ── actions ───────────────────────────── */
  const handleSubmit = async () => {
    if (!answer.trim()) return;

    setSubmittedAnswers(prev => ({ ...prev, [currentIndex]: answer }));

    // Increment the persistent "questions answered" counter for the Dashboard
    const prev = parseInt(localStorage.getItem('answeredQuestionsCount') || '0', 10);
    localStorage.setItem('answeredQuestionsCount', String(prev + 1));
    // Dispatch storage event so Dashboard updates live (same-tab)
    window.dispatchEvent(new StorageEvent('storage', { key: 'answeredQuestionsCount' }));

    const result = await evaluate(
      answer,
      currentQuestion.topic || currentQuestion.question,
      '',
      currentQuestion.question   // pass the actual question text for full context
    );

    if (result) {
      const updatedEvals = { ...answerEvaluations, [currentIndex]: result };
      setAnswerEvaluations(updatedEvals);

      // Build a topic-keyed map keyed by q.topic (which is the SUBTOPIC name
      // for subtopic questions, or the parent topic name for parent questions).
      // This means each subtopic gets its own independent color on the mind map.
      const topicKeyed = {};
      Object.entries(updatedEvals).forEach(([idx, evalResult]) => {
        const q   = questions[parseInt(idx, 10)];
        // Key = the subtopic (or topic) this question belongs to
        const key = q?.topic || `Q${parseInt(idx, 10) + 1}`;
        if (!topicKeyed[key]) {
          topicKeyed[key] = evalResult;
        } else {
          // Multiple questions for same topic/subtopic — pick worst rating
          const worst = (a, b) => {
            const order = { weak: 0, partial: 1, moderate: 1, strong: 2 };
            return (order[a.rating] ?? 1) <= (order[b.rating] ?? 1) ? a : b;
          };
          topicKeyed[key] = worst(topicKeyed[key], evalResult);
        }
      });

      // Also compute a rolled-up rating for the PARENT topic so it reflects
      // the worst subtopic result (parent stays non-green if any subtopic fails).
      const parentName = currentQuestion.parentTopic;
      if (parentName) {
        // Gather all subtopic evaluations for this parent
        const siblingEntries = Object.entries(updatedEvals).filter(([idx]) => {
          const q = questions[parseInt(idx, 10)];
          return q?.parentTopic === parentName;
        });
        if (siblingEntries.length > 0) {
          const ratings = siblingEntries.map(([, ev]) => ev.rating);
          const allStrong  = ratings.every(r => r === 'strong');
          const anyWeak    = ratings.some(r => r === 'weak');
          const parentRating = allStrong ? 'strong' : anyWeak ? 'weak' : 'partial';
          const avgScore = Math.round(
            siblingEntries.reduce((sum, [, ev]) => sum + (ev.score ?? 50), 0) / siblingEntries.length
          );
          topicKeyed[parentName] = {
            ...(topicKeyed[parentName] || {}),
            rating: parentRating,
            score:  avgScore,
            feedback: `Aggregate of ${siblingEntries.length} subtopic result(s).`,
          };
        }
      }

      if (onEvaluationUpdate) onEvaluationUpdate(topicKeyed);

      if (user) await persistQuizResult(user.uid, currentQuestion, { userAnswer: answer, ...result });
      if (result.rating === 'weak' && onWeakAnswerDetected)
        onWeakAnswerDetected(currentQuestion.topic || currentQuestion.question);
    }
  };

  const go = (dir) => {
    const next = currentIndex + dir;
    if (next < 0 || next >= total) return;
    setCurrentIndex(next);
    setAnswer(submittedAnswers[next] || '');
  };

  const handleReset = () => {
    setSubmittedAnswers({});
    setAnswerEvaluations({});
    setCurrentIndex(0);
    setAnswer('');
  };

  const handleComplete = () => onComplete?.({
    totalQuestions: total,
    answeredQuestions: answeredCount,
    answers: submittedAnswers,
  });

  /* ── dot row ────────────────────────────── */
  const DotNav = () => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
      {questions.map((_, i) => {
        const ev = answerEvaluations[i];
        const dot = i === currentIndex
          ? '#6366f1'
          : submittedAnswers.hasOwnProperty(i)
            ? (ev ? (RATING_META[ev.rating]?.color ?? '#6366f1') : '#22c55e')
            : '#e2e8f0';
        return (
          <button
            key={i}
            onClick={() => { setCurrentIndex(i); setAnswer(submittedAnswers[i] || ''); }}
            title={`Question ${i + 1}`}
            style={{
              width: 10, height: 10, borderRadius: '50%', border: 'none',
              background: dot, cursor: 'pointer', padding: 0,
              outline: i === currentIndex ? `2px solid #6366f1` : 'none',
              outlineOffset: 2,
              transition: 'background 0.2s',
            }}
          />
        );
      })}
    </div>
  );

  /* ── score bar ──────────────────────────── */
  const ScoreBar = ({ value, color, label }) => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        <span style={{ fontSize: '0.85rem', fontWeight: 700, color }}>{value}%</span>
      </div>
      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color, borderRadius: 999, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );

  /* ─────────────────────────────────────── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Header: progress + dot nav ── */}
      <div className="t-card" style={{ padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* top row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Question <span style={{ color: '#6366f1' }}>{currentIndex + 1}</span> of <span style={{ color: '#6366f1' }}>{total}</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{answeredCount} answered</span>
            <span style={{
              fontSize: '0.78rem', fontWeight: 700,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff', padding: '3px 10px', borderRadius: 999,
            }}>{pct}%</span>
          </div>
        </div>
        {/* progress track */}
        <div className="t-progress-track">
          <div className="t-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {/* dots */}
        <DotNav />
      </div>

      {/* ── Question card ── */}
      <div className="t-card" style={{
        borderLeft: `4px solid ${diff.accent}`,
        padding: '28px',
      }}>

        {/* difficulty badge — top right only */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <span className={`t-badge ${diff.badge}`}>{diff.label}</span>
        </div>

        {/* question text */}
        <div style={{
          background: 'rgba(99,102,241,0.04)',
          border: '1px solid rgba(99,102,241,0.1)',
          borderRadius: 12, padding: '18px 20px', marginBottom: 22,
        }}>
          <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.65 }}>
            {currentQuestion.question}
          </p>
        </div>

        {/* answer textarea */}
        <div style={{ marginBottom: 20 }}>
          <label className="t-label" style={{ marginBottom: 8 }}>Your Answer</label>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            rows={5}
            disabled={isAnswered}
            placeholder="Type your answer here — be as detailed and clear as possible..."
            className="t-input"
            style={{
              resize: 'vertical', lineHeight: 1.65,
              opacity: isAnswered ? 0.75 : 1,
              cursor: isAnswered ? 'not-allowed' : 'text',
            }}
          />
          {isAnswered && (
            <div className="t-alert t-alert-success" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              ✓ Answer submitted
            </div>
          )}
        </div>

        {/* evaluation result */}
        {isAnswered && (
          <div style={{ marginBottom: 20 }}>
            {isEvaluating && (
              <div className="t-alert t-alert-info" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="t-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                <span style={{ fontWeight: 600 }}>Evaluating your answer with AI…</span>
              </div>
            )}

            {currentEval && !isEvaluating && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* rating banner */}
                <div style={{
                  background: ratingMeta.bg,
                  border: `1.5px solid ${ratingMeta.border}`,
                  borderRadius: 12, padding: '16px 20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div>
                        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rating</p>
                        <p style={{ fontSize: '1.25rem', fontWeight: 800, color: ratingMeta.color }}>{ratingMeta.label}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Confidence</p>
                      <p style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>{currentEval.confidence}%</p>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic', fontWeight: 500 }}>
                    {currentEval.feedback}
                  </p>
                </div>

                {/* score bars */}
                {currentEval.scores && (
                  <div className="t-card" style={{ padding: '16px 20px' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 14 }}>
                      Score Breakdown
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <ScoreBar value={currentEval.scores.accuracy  ?? currentEval.scores.keyword      ?? 0} color="#3b82f6" label="Accuracy" />
                      <ScoreBar value={currentEval.scores.depth     ?? currentEval.scores.length       ?? 0} color="#8b5cf6" label="Depth" />
                      <ScoreBar value={currentEval.scores.examples  ?? currentEval.scores.understanding ?? 0} color="#f59e0b" label="Examples" />
                      <ScoreBar value={currentEval.scores.clarity   ?? 0}                                    color="#22c55e" label="Clarity" />
                    </div>
                  </div>
                )}

                {/* AI-generated improvements or strengths */}
                {currentEval.improvements?.length > 0 && (
                  <div className="t-alert t-alert-info" style={{ borderLeft: '4px solid #3b82f6' }}>
                    <p style={{ fontWeight: 700, marginBottom: 8 }}>Suggestions to improve</p>
                    <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem' }}>
                      {currentEval.improvements.map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentEval.strengths?.length > 0 && (
                  <div className="t-alert t-alert-success" style={{ borderLeft: '4px solid #22c55e' }}>
                    <p style={{ fontWeight: 700, marginBottom: 8 }}>What you did well</p>
                    <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem' }}>
                      {currentEval.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {currentEval.missingConcepts?.length > 0 && (
                  <div className="t-alert t-alert-warning" style={{ borderLeft: '4px solid #f59e0b' }}>
                    <p style={{ fontWeight: 700, marginBottom: 8 }}>Concepts to include next time</p>
                    <ul style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.875rem' }}>
                      {currentEval.missingConcepts.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* weak CTA */}
                {currentEval.rating === 'weak' && (
                  <div className="t-alert t-alert-error" style={{ borderLeft: '4px solid #ef4444' }}>
                    <p style={{ fontWeight: 700, marginBottom: 10 }}>🔍 Need help understanding why you struggled?</p>
                    <button
                      onClick={() => onWeakAnswerDetected?.(currentQuestion.topic || currentQuestion.question)}
                      className="t-btn t-btn-danger t-btn-sm"
                    >
                      Find Root Cause
                    </button>
                    <p style={{ fontSize: '0.78rem', marginTop: 8, opacity: 0.8 }}>
                      Analyzes your knowledge gaps and identifies the foundational concept to strengthen.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {!isAnswered ? (
            <>
              <button
                id="quiz-submit-btn"
                onClick={handleSubmit}
                disabled={!answer.trim()}
                className="t-btn t-btn-primary"
                style={{ flex: 1 }}
              >
                ✓ Submit Answer
              </button>
              <button
                onClick={() => go(1)}
                className="t-btn t-btn-ghost"
                style={{ minWidth: 90 }}
              >
                Skip →
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                setAnswer('');
                setSubmittedAnswers(prev => {
                  const n = { ...prev };
                  delete n[currentIndex];
                  return n;
                });
              }}
              className="t-btn t-btn-ghost"
              style={{ flex: 1 }}
            >
               Edit Answer
            </button>
          )}
        </div>
      </div>

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button
          onClick={() => go(-1)}
          disabled={currentIndex === 0}
          className="t-btn t-btn-ghost t-btn-sm"
          style={{ minWidth: 110 }}
        >
          ← Previous
        </button>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            {answeredCount} of {total} answered
          </p>
        </div>

        <button
          onClick={() => go(1)}
          disabled={currentIndex === total - 1}
          className="t-btn t-btn-ghost t-btn-sm"
          style={{ minWidth: 110 }}
        >
          Next →
        </button>
      </div>

      {/* ── Session summary (once started) ── */}
      {answeredCount > 0 && (
        <div className="t-card" style={{
          background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(59,130,246,0.06))',
          border: '1px solid rgba(99,102,241,0.15)',
          padding: '20px 24px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1rem' }}>
                {answeredCount === total ? '🎉 All questions answered!' : `${total - answeredCount} question${total - answeredCount !== 1 ? 's' : ''} remaining`}
              </p>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                {answeredCount} / {total} completed · {pct}% done
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleReset} className="t-btn t-btn-ghost t-btn-sm">
                Reset
              </button>
              {answeredCount === total && (
                <button onClick={handleComplete} className="t-btn t-btn-primary t-btn-sm">
                  Finish
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionPractice;
