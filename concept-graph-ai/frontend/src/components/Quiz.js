import React, { useState, useEffect } from 'react';
import { usePipeline } from '../hooks/usePipeline';
import './Quiz.css';

/**
 * Quiz Component - Light Theme
 * 
 * Handles the complete quiz workflow with professional design
 * Shows:
 * - Quiz questions from extracted topics
 * - Answer submission with confidence level
 * - AI evaluation and feedback
 * - Progress updates
 * - Learning recommendations
 */
const Quiz = ({ userId, graphId = null, onAnswerSubmitted }) => {
  const [quizState, setQuizState] = useState('idle'); // idle, loading, active, complete
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [confidence, setConfidence] = useState(50);
  const [answeredQuestions, setAnsweredQuestions] = useState([]);
  const [feedbackMessage, setFeedbackMessage] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const {
    generateQuiz,
    submitAnswer,
    loading,
    error,
    clearError,
    currentQuiz,
  } = usePipeline();

  // Initialize quiz
  useEffect(() => {
    if (quizState === 'idle' && userId) {
      loadQuiz();
    }
  }, [userId, quizState]);

  const loadQuiz = async () => {
    try {
      setQuizState('loading');
      const result = await generateQuiz(userId, graphId);

      if (result.success && result.data.questions) {
        setQuestions(result.data.questions);
        setQuizState('active');
      }
    } catch (err) {
      console.error('Error loading quiz:', err);
      setQuizState('idle');
    }
  };

  if (quizState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="card rounded-2xl border border-gray-200 bg-white p-8 shadow-lg max-w-2xl mx-auto">
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <span className="text-6xl animate-spin">⚡</span>
            <p className="text-2xl text-gray-900 font-bold text-center">
              Generating quiz questions...
            </p>
            <p className="text-gray-600 font-medium text-center max-w-xs">
              🔍 Our AI is creating personalized questions based on your concepts
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (quizState === 'idle' && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="card rounded-2xl border border-gray-200 bg-white p-8 shadow-lg max-w-2xl mx-auto">
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-3xl font-bold text-gray-900 text-center">No quiz available</p>
            <p className="text-gray-600 font-medium text-center max-w-xs mb-6">
              Upload a document first to generate quiz questions
            </p>
            <button
              onClick={loadQuiz}
              className="rounded-lg bg-green-600 hover:bg-green-700 px-6 py-3 font-semibold text-white transition-colors hover:shadow-lg hover:shadow-green-600/30"
            >
              Try Again ↻
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (quizState !== 'active' || questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progressPercent = ((currentQuestionIndex + 1) / questions.length) * 100;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;

  const handleAnswerChange = (e) => {
    setUserAnswer(e.target.value);
  };

  const handleConfidenceChange = (e) => {
    setConfidence(parseInt(e.target.value));
  };

  const handleSubmitAnswer = async () => {
    if (!userAnswer.trim()) {
      alert('Please provide an answer');
      return;
    }

    try {
      const result = await submitAnswer(
        userId,
        currentQuestion.question,
        userAnswer,
        currentQuestion.topic || 'General',
        confidence
      );

      if (result.success) {
        // Add to answered questions
        const answeredData = {
          question: currentQuestion.question,
          userAnswer,
          evaluation: result.data,
        };
        setAnsweredQuestions([...answeredQuestions, answeredData]);

        // Show feedback
        setFeedbackMessage(result.data);
        setShowFeedback(true);

        // Callback to parent
        if (onAnswerSubmitted) {
          onAnswerSubmitted(result.data);
        }

        // Move to next question or complete quiz
        setTimeout(() => {
          if (isLastQuestion) {
            setQuizState('complete');
          } else {
            setCurrentQuestionIndex(currentQuestionIndex + 1);
            setUserAnswer('');
            setConfidence(50);
            setShowFeedback(false);
          }
        }, 3000);
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
    }
  };

  const handleSkipQuestion = () => {
    if (isLastQuestion) {
      setQuizState('complete');
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setUserAnswer('');
      setConfidence(50);
      setShowFeedback(false);
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setUserAnswer('');
    setConfidence(50);
    setAnsweredQuestions([]);
    setShowFeedback(false);
    loadQuiz();
  };

  // Quiz Complete View
  if (quizState === 'complete') {
    const correctCount = answeredQuestions.filter(
      (q) => q.evaluation?.rating === 'strong'
    ).length;
    const partialCount = answeredQuestions.filter(
      (q) => q.evaluation?.rating === 'partial'
    ).length;
    const wrongCount = answeredQuestions.filter(
      (q) => q.evaluation?.rating === 'weak'
    ).length;
    const accuracy = ((correctCount / answeredQuestions.length) * 100).toFixed(1);

    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="text-7xl mb-4 inline-block">🏆</div>
            <h2 className="text-5xl font-bold text-gray-900">Quiz Complete!</h2>
            <p className="text-gray-600 mt-2 font-medium">Great job! Check your results below</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="card border-l-4 border-green-500">
              <div className="text-center">
                <p className="text-5xl font-bold text-gray-900 mb-2">{accuracy}%</p>
                <p className="text-gray-600 font-medium">🎯 Accuracy</p>
              </div>
            </div>
            <div className="card border-l-4 border-green-600">
              <div className="text-center">
                <p className="text-5xl font-bold text-green-700 mb-2">{correctCount}/{answeredQuestions.length}</p>
                <p className="text-gray-600 font-medium">✅ Correct Answers</p>
              </div>
            </div>
            <div className="card border-l-4 border-blue-500">
              <div className="text-center">
                <p className="text-5xl font-bold text-blue-700 mb-2">{answeredQuestions.length}</p>
                <p className="text-gray-600 font-medium">📝 Total Questions</p>
              </div>
            </div>
          </div>

          {/* Detailed Summary */}
          <div className="card mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📊 Detailed Summary</h3>
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center p-6 rounded-lg bg-green-50 border border-green-200">
                <p className="text-4xl font-bold text-green-700">{correctCount}</p>
                <p className="text-gray-600 mt-2 font-medium">Strong Answers</p>
              </div>
              <div className="text-center p-6 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-4xl font-bold text-amber-700">{partialCount}</p>
                <p className="text-gray-600 mt-2 font-medium">Partial Answers</p>
              </div>
              <div className="text-center p-6 rounded-lg bg-red-50 border border-red-200">
                <p className="text-4xl font-bold text-red-700">{wrongCount}</p>
                <p className="text-gray-600 mt-2 font-medium">Needs Improvement</p>
              </div>
            </div>
          </div>

          {/* Review Answers */}
          <div className="card mb-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">📋 Review Your Answers</h3>
            <div className="space-y-4">
              {answeredQuestions.map((item, idx) => (
                <div
                  key={idx}
                  className={`rounded-lg border-l-4 p-4 ${
                    item.evaluation?.rating === 'strong'
                      ? 'border-l-green-500 bg-green-50 border border-green-200'
                      : item.evaluation?.rating === 'partial'
                        ? 'border-l-amber-500 bg-amber-50 border border-amber-200'
                        : 'border-l-red-500 bg-red-50 border border-red-200'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    <span className="text-lg mt-1">
                      {item.evaluation?.rating === 'strong' ? '✅' : item.evaluation?.rating === 'partial' ? '⚠️' : '❌'}
                    </span>
                    <p className="font-semibold text-gray-900 flex-1">{item.question}</p>
                  </div>
                  <p className="text-gray-700 mb-1 text-sm">
                    <strong>Your Answer:</strong> {item.userAnswer}
                  </p>
                  {item.evaluation?.correctAnswer && (
                    <p className="text-gray-700 mb-1 text-sm">
                      <strong>Correct Answer:</strong> {item.evaluation.correctAnswer}
                    </p>
                  )}
                  {item.evaluation?.feedback && (
                    <p className="text-gray-600 text-sm italic">{item.evaluation.feedback}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Retry Button */}
          <div className="flex justify-center">
            <button
              onClick={handleRestartQuiz}
              className="rounded-lg bg-green-600 hover:bg-green-700 px-8 py-3 font-bold text-lg text-white transition-colors hover:shadow-lg hover:shadow-green-600/30"
            >
              🔄 Retake Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active Quiz View
  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center justify-between">
            <span className="text-red-700 font-medium">❌ {error}</span>
            <button onClick={clearError} className="text-red-600 hover:text-red-700 text-xl font-bold transition-colors">
              ×
            </button>
          </div>
        )}

        {/* Progress Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-900 font-bold">
              📝 Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <span className="text-gray-600 text-sm font-medium">
              {Math.round(progressPercent)}% Complete
            </span>
          </div>
          <div className="rounded-full bg-gray-300 h-2 overflow-hidden border border-gray-400">
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-green-500 to-cyan-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="card mb-8">
          {/* Topic Badge */}
          <div className="mb-6">
            <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
              🏷️ {currentQuestion.topic || 'General'}
            </span>
          </div>

          {/* Question Text */}
          <h3 className="text-3xl font-bold text-gray-900 mb-8 leading-tight">
            {currentQuestion.question}
          </h3>

          {/* Answer Options or Text Input */}
          {currentQuestion.options && currentQuestion.options.length > 0 ? (
            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => (
                <label
                  key={idx}
                  className="flex items-center gap-4 rounded-lg border-2 border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-green-400 p-4 cursor-pointer transition-all"
                >
                  <input
                    type="radio"
                    name="answer"
                    value={option}
                    checked={userAnswer === option}
                    onChange={handleAnswerChange}
                    disabled={loading || showFeedback}
                    className="w-5 h-5 cursor-pointer accent-green-600"
                  />
                  <span className="text-gray-900 font-medium text-lg">{option}</span>
                </label>
              ))}
            </div>
          ) : (
            /* Text Answer Input */
            <div>
              <textarea
                value={userAnswer}
                onChange={handleAnswerChange}
                placeholder="Type your detailed answer here..."
                disabled={loading || showFeedback}
                rows={5}
                className="w-full rounded-lg border-2 border-gray-300 bg-white p-4 text-gray-900 placeholder-gray-500 focus:outline-none focus:border-green-500 focus:bg-white focus:shadow-lg focus:shadow-green-500/20 transition-all font-medium text-base leading-relaxed resize-none"
              />
              <p className="text-gray-600 text-xs mt-2 font-medium">
                💡 Be thorough and detailed in your response for better feedback.
              </p>
            </div>
          )}
        </div>

        {/* Confidence Slider */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <label htmlFor="confidence" className="text-gray-900 font-bold">
              🎯 How confident are you?
            </label>
            <span className="text-2xl font-bold text-green-600">{confidence}%</span>
          </div>
          <input
            id="confidence"
            type="range"
            min="0"
            max="100"
            step="10"
            value={confidence}
            onChange={handleConfidenceChange}
            disabled={loading || showFeedback}
            className="w-full h-2 bg-gray-300 rounded-full appearance-none cursor-pointer accent-green-600 transition-all"
          />
          <div className="flex justify-between text-xs text-gray-600 mt-3 font-medium">
            <span>🤷 Not Sure</span>
            <span>✅ Very Confident</span>
          </div>
        </div>

        {/* Feedback Message */}
        {showFeedback && feedbackMessage && (
          <div
            className={`mb-8 rounded-lg border overflow-hidden ${
              feedbackMessage.rating === 'strong'
                ? 'border-green-200 bg-green-50'
                : feedbackMessage.rating === 'partial'
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-red-200 bg-red-50'
            }`}
          >
            <div
              className={`px-4 py-3 border-b font-bold text-lg flex items-center gap-2 ${
                feedbackMessage.rating === 'strong'
                  ? 'border-green-200 bg-green-100 text-green-700'
                  : feedbackMessage.rating === 'partial'
                    ? 'border-amber-200 bg-amber-100 text-amber-700'
                    : 'border-red-200 bg-red-100 text-red-700'
              }`}
            >
              <span>
                {feedbackMessage.rating === 'strong'
                  ? '✅'
                  : feedbackMessage.rating === 'partial'
                    ? '⚠️'
                    : '❌'}
              </span>
              {feedbackMessage.ratingLabel || feedbackMessage.rating}
            </div>
            <div className="p-4 space-y-2">
              {feedbackMessage.feedback && (
                <p className="text-gray-700 font-medium">{feedbackMessage.feedback}</p>
              )}
              {feedbackMessage.correctAnswer && (
                <p className="text-gray-700">
                  <strong>Expected Answer:</strong> {feedbackMessage.correctAnswer}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleSkipQuestion}
            disabled={loading}
            className="flex-1 rounded-lg border border-gray-400 bg-white text-gray-900 px-4 py-3 font-bold hover:bg-gray-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⏭️ Skip
          </button>
          <button
            onClick={handleSubmitAnswer}
            disabled={loading || !userAnswer.trim() || showFeedback}
            className="flex-1 rounded-lg bg-green-600 hover:bg-green-700 text-white px-4 py-3 font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="inline-block animate-spin">🔄</span> Evaluating...
              </>
            ) : showFeedback ? (
              isLastQuestion ? (
                <>✅ Finish</>
              ) : (
                <>➡️ Next Question</>
              )
            ) : (
              <>✓ Submit Answer</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Quiz;
          }
        }, 3000);
      }
    } catch (err) {
      console.error('Error submitting answer:', err);
    }
  };

  const handleSkipQuestion = () => {
    if (isLastQuestion) {
      setQuizState('complete');
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setUserAnswer('');
      setConfidence(50);
      setShowFeedback(false);
    }
  };

  const handleRestartQuiz = () => {
    setCurrentQuestionIndex(0);
    setUserAnswer('');
    setConfidence(50);
    setAnsweredQuestions([]);
    setShowFeedback(false);
    loadQuiz();
  };

  // Quiz Complete View
  if (quizState === 'complete') {
    const correctCount = answeredQuestions.filter(
      (q) => q.evaluation?.rating === 'strong'
    ).length;
    const accuracy = ((correctCount / answeredQuestions.length) * 100).toFixed(1);

    return (
      <div className="quiz-container rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/3 backdrop-blur-lg p-8 shadow-xl max-w-4xl mx-auto animate-fade-in-scale">
        <div className="mb-12 text-center">
          <div className="text-7xl mb-6 inline-block animate-bounce" style={{ animationDuration: '1s' }}>🏆</div>
          <h2 className="text-5xl font-extrabold text-white bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
            Quiz Complete!
          </h2>
          <p className="text-white/60 mt-3 font-light">Great job! Check your results below</p>
        </div>

        <div className="mb-12 grid grid-cols-1 md:grid-cols-3 gap-6 stagger-children">
          <div className="stat-card rounded-2xl bg-gradient-to-br from-green-500/15 to-green-500/5 border border-green-500/30 p-8 text-center hover-lift">
            <p className="text-6xl font-extrabold stat-value mb-2">{accuracy}%</p>
            <p className="text-white/70 font-light">🎯 Accuracy</p>
          </div>
          <div className="stat-card rounded-2xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-500/30 p-8 text-center hover-lift">
            <p className="text-5xl font-extrabold text-blue-300 mb-2">{correctCount}/{answeredQuestions.length}</p>
            <p className="text-white/70 font-light">✅ Correct Answers</p>
          </div>
          <div className="stat-card rounded-2xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 border border-purple-500/30 p-8 text-center hover-lift">
            <p className="text-5xl font-extrabold text-purple-300 mb-2">{answeredQuestions.length}</p>
            <p className="text-white/70 font-light">📝 Questions Asked</p>
          </div>
        </div>

        <div className="mb-12 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-lg p-8">
          <h3 className="text-2xl font-bold text-white mb-6">📊 Detailed Summary</h3>
          <div className="grid grid-cols-3 gap-6 stagger-children">
            <div className="recommendation-card">
              <p className="text-4xl font-bold text-green-300">{correctCount}</p>
              <p className="text-white/70 font-light">Strong Answers</p>
            </div>
            <div className="recommendation-card">
              <p className="text-4xl font-bold text-yellow-300">
                {answeredQuestions.filter((q) => q.evaluation?.rating === 'partial').length}
              </p>
              <p className="text-white/70 font-light">Partial Answers</p>
            </div>
            <div className="recommendation-card">
              <p className="text-4xl font-bold text-red-300">
                {answeredQuestions.filter((q) => q.evaluation?.rating === 'weak').length}
              </p>
              <p className="text-white/70 font-light">Needs Improvement</p>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h3 className="text-2xl font-bold text-white mb-6">📋 Review Your Answers</h3>
          <div className="space-y-4 stagger-children">
            {answeredQuestions.map((item, idx) => (
              <div
                key={idx}
                className={`quiz-answer rounded-xl backdrop-blur-lg p-5 border-l-4 transition-all duration-300 hover-lift ${
                  item.evaluation?.rating === 'strong'
                    ? 'border-l-green-500 bg-green-500/10 border border-green-500/20'
                    : item.evaluation?.rating === 'partial'
                      ? 'border-l-yellow-500 bg-yellow-500/10 border border-yellow-500/20'
                      : 'border-l-red-500 bg-red-500/10 border border-red-500/20'
                }`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xl">
                    {item.evaluation?.rating === 'strong' ? '✅' : item.evaluation?.rating === 'partial' ? '⚠️' : '❌'}
                  </span>
                  <p className="font-semibold text-white flex-1">{item.question}</p>
                </div>
                <p className="text-white/80 mb-2">
                  <strong>Your Answer:</strong> {item.userAnswer}
                </p>
                {item.evaluation?.correctAnswer && (
                  <p className="text-white/80 mb-2">
                    <strong>Correct Answer:</strong> {item.evaluation.correctAnswer}
                  </p>
                )}
                {item.evaluation?.feedback && (
                  <p className="text-white/70 text-sm italic">{item.evaluation.feedback}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={handleRestartQuiz}
            className="rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 px-10 py-4 font-bold text-lg text-white hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-105 active:scale-95 btn-primary-enhanced"
          >
            🔄 Retake Quiz
          </button>
        </div>
      </div>
    );
  }

  // Active Quiz View
  return (
    <div className="quiz-container rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/3 backdrop-blur-lg p-8 shadow-xl max-w-3xl mx-auto animate-fade-in-scale">
      {/* Error Message */}
      {error && (
        <div className="mb-8 rounded-lg border border-red-500/20 bg-red-500/10 backdrop-blur-lg p-4 flex items-center justify-between error-shake">
          <span className="text-red-400">❌ {error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-300 text-xl font-bold transition-colors">
            ×
          </button>
        </div>
      )}

      {/* Progress Indicator Section */}
      <div className="mb-8 stagger-children">
        <div className="flex items-center justify-between mb-4">
          <span className="text-white font-bold text-lg">
            📝 Question {currentQuestionIndex + 1} of {questions.length}
          </span>
          <span className="text-white/60 text-sm font-light">
            {Math.round(progressPercent)}% Complete
          </span>
        </div>
        <div className="rounded-full bg-white/10 h-3 overflow-hidden border border-white/10 shadow-lg shadow-blue-500/30">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 via-purple-500 to-cyan-500 shadow-lg shadow-blue-500/50"
            style={{ width: `${progressPercent}%` }}
          ></div>
        </div>
      </div>

      {/* Question Card */}
      <div className="mb-8 quiz-question rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 to-white/5 backdrop-blur-lg p-8 shadow-lg">
        
        {/* Topic Badge */}
        <div className="mb-6">
          <span className="topic-pill inline-block">
            🏷️ {currentQuestion.topic || 'General'}
          </span>
        </div>

        {/* Large Question Text */}
        <h3 className="text-4xl font-extrabold text-white mb-8 leading-tight animate-slide-in-left">
          {currentQuestion.question}
        </h3>

        {/* Question Options (if multiple choice) */}
        {currentQuestion.options && currentQuestion.options.length > 0 ? (
          <div className="space-y-3 stagger-children">
            {currentQuestion.options.map((option, idx) => (
              <label
                key={idx}
                className="quiz-option flex items-center gap-4 rounded-xl border-2 border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 p-5 hover:translate-x-2 transition-all duration-300 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                <input
                  type="radio"
                  name="answer"
                  value={option}
                  checked={userAnswer === option}
                  onChange={handleAnswerChange}
                  disabled={loading || showFeedback}
                  className="w-5 h-5 accent-blue-500 cursor-pointer"
                />
                <span className="text-white font-light text-lg">{option}</span>
              </label>
            ))}
          </div>
        ) : (
          /* Text Answer Input */
          <div className="animate-slide-in-up">
            <textarea
              value={userAnswer}
              onChange={handleAnswerChange}
              placeholder="Type your detailed answer here..."
              disabled={loading || showFeedback}
              rows={5}
              className="w-full rounded-xl border-2 border-white/10 bg-white/5 backdrop-blur-lg p-5 text-white placeholder-white/40 focus:outline-none focus:border-blue-400 focus:bg-white/15 focus:shadow-lg focus:shadow-blue-500/30 transition-all duration-300 font-light text-base leading-relaxed resize-none"
            />
            <p className="text-white/40 text-xs mt-3 font-light">
              💡 Be thorough and detailed in your response for better feedback.
            </p>
          </div>
        )}
      </div>

      {/* Confidence Slider */}
      <div className="mb-8 rounded-xl border border-white/10 bg-white/5 backdrop-blur-lg p-6 shadow-lg hover-lift animate-slide-in-up">
        <div className="flex items-center justify-between mb-4">
          <label htmlFor="confidence" className="text-white font-bold">
            🎯 How confident are you?
          </label>
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">{confidence}%</span>
        </div>
        <input
          id="confidence"
          type="range"
          min="0"
          max="100"
          step="10"
          value={confidence}
          onChange={handleConfidenceChange}
          disabled={loading || showFeedback}
          className="w-full h-3 bg-white/10 rounded-full appearance-none cursor-pointer accent-blue-500 transition-all hover:bg-white/15"
        />
        <div className="flex justify-between text-xs text-white/60 mt-3 font-light">
          <span>🤷 Not Sure</span>
          <span>✅ Very Confident</span>
        </div>
      </div>

      {/* Feedback Message */}
      {showFeedback && feedbackMessage && (
        <div
          className={`mb-8 rounded-lg border backdrop-blur-lg overflow-hidden quiz-feedback-message ${
            feedbackMessage.rating === 'strong'
              ? 'border-green-500/30 bg-green-500/10'
              : feedbackMessage.rating === 'partial'
                ? 'border-yellow-500/30 bg-yellow-500/10'
                : 'border-red-500/30 bg-red-500/10'
          }`}
        >
          <div
            className={`px-6 py-4 border-b ${
              feedbackMessage.rating === 'strong'
                ? 'border-green-500/20 bg-green-500/5'
                : feedbackMessage.rating === 'partial'
                  ? 'border-yellow-500/20 bg-yellow-500/5'
                  : 'border-red-500/20 bg-red-500/5'
            }`}
          >
            <p className="font-bold text-white text-lg flex items-center gap-2">
              <span>
                {feedbackMessage.rating === 'strong'
                  ? '✅'
                  : feedbackMessage.rating === 'partial'
                    ? '⚠️'
                    : '❌'}
              </span>
              {feedbackMessage.ratingLabel || feedbackMessage.rating}
            </p>
          </div>
          <div className="p-6 space-y-3">
            {feedbackMessage.feedback && (
              <p className="text-white/80 font-light">{feedbackMessage.feedback}</p>
            )}
            {feedbackMessage.correctAnswer && (
              <p className="text-white/60 font-light">
                <strong>Expected Answer:</strong> {feedbackMessage.correctAnswer}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleSkipQuestion}
          disabled={loading}
          className="quiz-skip-btn flex-1 rounded-lg border border-white/20 bg-white/5 px-6 py-3 font-bold text-white hover:bg-white/10 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ⏭️ Skip
        </button>
        <button
          onClick={handleSubmitAnswer}
          disabled={loading || !userAnswer.trim() || showFeedback}
          className={`quiz-submit-btn flex-1 rounded-lg bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-bold text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative overflow-hidden ${
            loading ? 'loading' : ''
          }`}
        >
          {loading ? (
            <>
              <span className="quiz-loading-spinner">🔄</span> Evaluating...
            </>
          ) : showFeedback ? (
            isLastQuestion ? (
              <>✅ Finish</>
            ) : (
              <>➡️ Next Question</>
            )
          ) : (
            <>✓ Submit Answer</>
          )}
        </button>
      </div>
    </div>
  );
};

export default Quiz;
