import React, { useState, useEffect } from 'react';
import { usePipeline } from '../hooks/usePipeline';

/**
 * CircularProgress Component
 * Renders a circular progress indicator with green theme gradient fill
 */
const CircularProgress = ({ percentage, size = 80 }) => {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Determine color based on percentage - green theme
  const getColor = () => {
    if (percentage >= 80) return '#10b981'; // emerald green
    if (percentage >= 60) return '#06b6d4'; // cyan
    return '#f59e0b'; // amber
  };

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="4"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={getColor()}
        strokeWidth="4"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dy="0.3em"
        fill="#1f2937"
        fontSize={size / 3}
        fontWeight="bold"
        style={{ transform: 'rotate(90deg)', transformOrigin: `${size / 2}px ${size / 2}px` }}
      >
        {Math.round(percentage)}%
      </text>
    </svg>
  );
};

/**
 * StatusBadge Component
 * Displays semantic status label based on accuracy percentage (light theme)
 */
const StatusBadge = ({ accuracy }) => {
  const getStatus = () => {
    if (accuracy >= 80) return { label: '✨ Excellent', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' };
    if (accuracy >= 60) return { label: '👍 Good', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' };
    return { label: '📈 Needs Work', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' };
  };

  const status = getStatus();
  return (
    <span className={`inline-block px-3 py-1 rounded-full border text-xs font-semibold ${status.bg} ${status.border} ${status.text}`}>
      {status.label}
    </span>
  );
};

/**
 * ProgressDashboard Component
 * 
 * Displays comprehensive learning progress with professional light theme
 * Shows:
 * - Key metrics cards (Total Topics, Strong Topics, Weak Topics)
 * - Overall progress percentage
 * - Quiz statistics and accuracy
 * - Learning recommendations
 * - Topic status sections (Mastered, In Progress, Needs Practice)
 */
const ProgressDashboard = ({ userId, userName, onNavigate }) => {
  const [loadingData, setLoadingData] = useState(true);

  const {
    getProgress,
    getStatistics,
    getRecommendations,
    progress,
    statistics,
    recommendations,
    loading,
    error,
    clearError,
  } = usePipeline();

  // Load all data on mount
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoadingData(true);
        await Promise.all([
          getProgress(userId),
          getStatistics(userId),
          getRecommendations(userId),
        ]);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    if (userId) {
      loadAllData();
    }
  }, [userId]);

  if (loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center justify-center gap-4">
          <span className="inline-block animate-spin text-6xl">🔄</span>
          <p className="text-xl text-gray-900 font-semibold">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center justify-between">
            <span className="text-red-700 flex items-center gap-2">
              <span className="text-lg">⚠️</span> {error}
            </span>
            <button onClick={clearError} className="text-red-600 hover:text-red-700 text-xl font-bold">
              ×
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-gray-600">Welcome back! Here's your learning progress overview.</p>
        </div>

        {/* Key Metrics Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Total Topics Card */}
          <div className="stat-card border-l-4 border-green-500 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Total Topics</p>
                <p className="text-4xl font-bold text-gray-900">{(progress?.masteredTopics?.length || 0) + (progress?.inProgressTopics?.length || 0) + (progress?.weakTopics?.length || 0)}</p>
              </div>
              <span className="text-5xl opacity-20">📚</span>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-500 h-full rounded-full" style={{ width: '75%' }} />
            </div>
          </div>

          {/* Strong Topics Card */}
          <div className="stat-card border-l-4 border-green-600 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Strong Topics</p>
                <p className="text-4xl font-bold text-gray-900">{progress?.masteredTopics?.length || 0}</p>
              </div>
              <span className="text-5xl opacity-30">🏆</span>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div className="bg-green-600 h-full rounded-full" style={{ width: `${((progress?.masteredTopics?.length || 0) / 10) * 100}%` }} />
            </div>
          </div>

          {/* Weak Topics Card */}
          <div className="stat-card border-l-4 border-amber-500 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Needs Practice</p>
                <p className="text-4xl font-bold text-gray-900">{progress?.weakTopics?.length || 0}</p>
              </div>
              <span className="text-5xl opacity-20">⚡</span>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${((progress?.weakTopics?.length || 0) / 10) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Overall Progress Section */}
        {progress && (
          <div className="card mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Overall Progress</h2>
              <span className="text-4xl">📍</span>
            </div>
            <div className="flex justify-center py-8">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#e5e7eb" strokeWidth="2" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#gradientGreen)"
                    strokeWidth="3"
                    strokeDasharray={`${(progress.overallProgress || 0) * 2.827} 282.7`}
                    strokeLinecap="round"
                  />
                  <defs>
                    <linearGradient id="gradientGreen" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10b981" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold text-gray-900">{progress.overallProgress || 0}%</span>
                  <span className="text-gray-600 font-medium text-sm">Complete</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Section */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Questions */}
            <div className="stat-card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Total Questions</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.totalAnswered || 0}</p>
                </div>
                <span className="text-4xl opacity-25">📝</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full" style={{ width: '100%' }} />
              </div>
            </div>

            {/* Correct Answers */}
            <div className="stat-card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Correct Answers</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.correctAnswers || 0}</p>
                </div>
                <span className="text-4xl opacity-25">✅</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full" 
                    style={{ width: `${((statistics.correctAnswers || 0) / (statistics.totalAnswered || 1)) * 100}%` }} 
                  />
                </div>
                <span className="text-green-700 text-xs font-semibold min-w-fit">
                  {Math.round(((statistics.correctAnswers || 0) / (statistics.totalAnswered || 1)) * 100)}%
                </span>
              </div>
            </div>

            {/* Accuracy Rate */}
            <div className="stat-card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Accuracy Rate</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{statistics.accuracy || 0}%</p>
                </div>
                <CircularProgress percentage={statistics.accuracy || 0} size={64} />
              </div>
              <div className="mt-3">
                <StatusBadge accuracy={statistics.accuracy || 0} />
              </div>
            </div>

            {/* Current Streak */}
            <div className="stat-card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-600 text-sm font-medium">Current Streak</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">🔥 {statistics.currentStreak || 0}</p>
                </div>
                <span className="text-4xl animate-pulse opacity-40">⚡</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-amber-400 to-amber-600 rounded-full" style={{ width: `${Math.min((statistics.currentStreak || 0) * 10, 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* Topics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Mastered Topics */}
          {progress?.masteredTopics && progress.masteredTopics.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-3xl">🏆</span>
                <h3 className="text-2xl font-bold text-gray-900">Mastered</h3>
                <span className="ml-auto bg-green-100 text-green-700 text-sm font-semibold px-3 py-1 rounded-full">
                  {progress.masteredTopics.length}
                </span>
              </div>
              <div className="space-y-2">
                {progress.masteredTopics.slice(0, 5).map((topic, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                  >
                    <p className="text-gray-900 font-medium text-sm">{topic.name}</p>
                    {topic.masteryLevel && (
                      <p className="text-green-700 text-xs mt-1">✓ {topic.masteryLevel}</p>
                    )}
                  </div>
                ))}
                {progress.masteredTopics.length > 5 && (
                  <p className="text-center text-gray-600 text-sm py-2">
                    +{progress.masteredTopics.length - 5} more topics
                  </p>
                )}
              </div>
            </div>
          )}

          {/* In Progress Topics */}
          {progress?.inProgressTopics && progress.inProgressTopics.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-3xl">📚</span>
                <h3 className="text-2xl font-bold text-gray-900">In Progress</h3>
                <span className="ml-auto bg-blue-100 text-blue-700 text-sm font-semibold px-3 py-1 rounded-full">
                  {progress.inProgressTopics.length}
                </span>
              </div>
              <div className="space-y-2">
                {progress.inProgressTopics.slice(0, 5).map((topic, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors"
                  >
                    <p className="text-gray-900 font-medium text-sm">{topic.name}</p>
                    {topic.masteryLevel && (
                      <p className="text-blue-700 text-xs mt-1">→ {topic.masteryLevel}</p>
                    )}
                  </div>
                ))}
                {progress.inProgressTopics.length > 5 && (
                  <p className="text-center text-gray-600 text-sm py-2">
                    +{progress.inProgressTopics.length - 5} more topics
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Needs Practice Topics */}
          {progress?.weakTopics && progress.weakTopics.length > 0 && (
            <div className="card">
              <div className="flex items-center gap-2 mb-6">
                <span className="text-3xl">⚡</span>
                <h3 className="text-2xl font-bold text-gray-900">Practice</h3>
                <span className="ml-auto bg-amber-100 text-amber-700 text-sm font-semibold px-3 py-1 rounded-full">
                  {progress.weakTopics.length}
                </span>
              </div>
              <div className="space-y-2">
                {progress.weakTopics.slice(0, 5).map((topic, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                  >
                    <p className="text-gray-900 font-medium text-sm">{topic.name}</p>
                    {topic.masteryLevel && (
                      <p className="text-amber-700 text-xs mt-1">🔧 {topic.masteryLevel}</p>
                    )}
                  </div>
                ))}
                {progress.weakTopics.length > 5 && (
                  <p className="text-center text-gray-600 text-sm py-2">
                    +{progress.weakTopics.length - 5} more topics
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Performance by Topic */}
        {statistics?.accuracyByTopic && Object.keys(statistics.accuracyByTopic).length > 0 && (
          <div className="card mt-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <span>📊</span>
              Performance by Topic
            </h3>
            <div className="space-y-4">
              {Object.entries(statistics.accuracyByTopic).slice(0, 6).map(([topic, accuracy]) => {
                const status = accuracy >= 80 ? 'excellent' : accuracy >= 60 ? 'good' : 'needs-work';
                const statusColor = status === 'excellent' ? 'bg-green-500' : 
                                   status === 'good' ? 'bg-blue-500' : 
                                   'bg-amber-500';
                const statusLabel = status === 'excellent' ? '✨ Excellent' : 
                                   status === 'good' ? '👍 Good' : 
                                   '📈 Needs Work';

                return (
                  <div key={topic} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-900 font-semibold">{topic}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-700 font-bold">{accuracy}%</span>
                        <span className="text-xs font-semibold px-2 py-1 bg-gray-100 text-gray-700 rounded">
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 h-3 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full ${statusColor} rounded-full transition-all duration-500`}
                          style={{ width: `${accuracy}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!progress || 
          ((!progress.masteredTopics || progress.masteredTopics.length === 0) &&
           (!progress.inProgressTopics || progress.inProgressTopics.length === 0) &&
           (!progress.weakTopics || progress.weakTopics.length === 0))) && (
          <div className="card text-center py-12">
            <span className="text-6xl block mb-4">📚</span>
            <p className="text-gray-600">No learning data yet. Upload a document and take a quiz to start!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressDashboard;
