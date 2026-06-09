import React, { useState, useMemo, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import DashboardTopicsGraph from '../components/DashboardTopicsGraph';
import UserMenu from '../components/UserMenu';
import { Link } from 'react-router-dom';
import { onEvalChange, offEvalChange } from '../utils/evalBus';

const DashboardPage = () => {
  const [topicsData, setTopicsData] = useState(null);
  const [evaluationData, setEvaluationData] = useState({});
  const [dependencyData, setDependencyData] = useState({});
  const [timeRange, setTimeRange] = useState('all'); // all, week, month
  const [sortBy, setSortBy] = useState('weakness'); // weakness, name, confidence

  // Load data from localStorage on mount + re-sync whenever evaluation changes
  const syncFromStorage = React.useCallback(() => {
    const activeSessionId = localStorage.getItem('activeSessionId');
    const LEARNING_KEYS = [
      'learningTopicsData',
      'learningQuestionsData',
      'learningEvaluationData',
      'learningDependencyData',
    ];

    if (!activeSessionId) {
      LEARNING_KEYS.forEach(k => localStorage.removeItem(k));
      setTopicsData(null);
      setEvaluationData({});
      setDependencyData({});
      return;
    }

    const savedEvaluations  = localStorage.getItem('learningEvaluationData');
    const savedTopics       = localStorage.getItem('learningTopicsData');
    const savedDependencies = localStorage.getItem('learningDependencyData');

    if (savedEvaluations) {
      try { setEvaluationData(JSON.parse(savedEvaluations)); }
      catch (e) { console.error('Failed to parse evaluation data:', e); }
    }
    if (savedTopics) {
      try { setTopicsData(JSON.parse(savedTopics)); }
      catch (e) { console.error('Failed to parse topics data:', e); }
    }
    if (savedDependencies) {
      try { setDependencyData(JSON.parse(savedDependencies)); }
      catch (e) { console.error('Failed to parse dependency data:', e); }
    }
  }, []);

  useEffect(() => {
    syncFromStorage();

    // Re-sync when any quiz completes — evalBus fires for same-tab updates,
    // native storage event fires for cross-tab updates (both handled inside onEvalChange)
    onEvalChange(syncFromStorage);

    // Also re-sync when user switches back to this tab
    const onFocus = () => syncFromStorage();
    window.addEventListener('focus', onFocus);

    return () => {
      offEvalChange(syncFromStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [syncFromStorage]);

  // Parse evaluation data
  const evaluationStats = useMemo(() => {
    const stats = {
      strong: [],
      partial: [],
      weak: [],
      total: 0,
      averageConfidence: 0,
    };

    let totalConfidence = 0;
    let topicCount = 0;

    // evaluationData shape: { "TopicName": { rating, score, confidence, practicedAt } }
    // The topic name is the KEY, not a .topic property inside the value.
    Object.entries(evaluationData).forEach(([topicName, evalData]) => {
      if (evalData && evalData.rating) {
        stats.total++;
        topicCount++;
        totalConfidence += evalData.confidence || evalData.score || 0;

        const entry = {
          name: evalData.topic || topicName,  // fall back to key if .topic missing
          confidence: evalData.confidence || evalData.score || 0,
          rating: evalData.rating,
          practicedAt: evalData.practicedAt,
        };

        switch (evalData.rating) {
          case 'strong':  stats.strong.push(entry);  break;
          case 'partial':
          case 'moderate': stats.partial.push(entry); break;
          case 'weak':    stats.weak.push(entry);    break;
          default: break;
        }
      }
    });

    stats.averageConfidence = topicCount > 0 ? Math.round(totalConfidence / topicCount) : 0;

    return stats;
  }, [evaluationData]);

  // Sort weak topics
  const sortedWeakTopics = useMemo(() => {
    let sorted = [...evaluationStats.weak];

    switch (sortBy) {
      case 'weakness':
        sorted.sort((a, b) => a.confidence - b.confidence); // Lowest confidence first
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'confidence':
        sorted.sort((a, b) => b.confidence - a.confidence);
        break;
      default:
        break;
    }

    return sorted;
  }, [evaluationStats.weak, sortBy]);

  // Prepare pie chart data
  const pieData = [
    { name: 'Strong', value: evaluationStats.strong.length, color: '#10b981' },
    { name: 'Partial', value: evaluationStats.partial.length, color: '#f59e0b' },
    { name: 'Weak', value: evaluationStats.weak.length, color: '#ef4444' },
  ].filter((item) => item.value > 0);

  // Progress data for chart
  const progressData = [
    { category: 'Strong', count: evaluationStats.strong.length, percentage: evaluationStats.total > 0 ? Math.round((evaluationStats.strong.length / evaluationStats.total) * 100) : 0 },
    { category: 'Partial', count: evaluationStats.partial.length, percentage: evaluationStats.total > 0 ? Math.round((evaluationStats.partial.length / evaluationStats.total) * 100) : 0 },
    { category: 'Weak', count: evaluationStats.weak.length, percentage: evaluationStats.total > 0 ? Math.round((evaluationStats.weak.length / evaluationStats.total) * 100) : 0 },
  ];

  // Topics graph data
  const allTopics = useMemo(() => {
    if (!topicsData?.topics) return [];
    return Array.isArray(topicsData.topics)
      ? topicsData.topics.map((t) => (typeof t === 'string' ? t : t.name || t.topic))
      : [];
  }, [topicsData]);

  const topicsWithStatus = useMemo(() => {
    return allTopics.map((topic) => {
      const topicName = typeof topic === 'string' ? topic : topic.name || topic;
      // Look up by key directly (the key IS the topic name)
      const evalData = evaluationData[topicName]
        // Also try case-insensitive lookup as a fallback
        || Object.entries(evaluationData).find(
            ([k]) => k.toLowerCase() === topicName.toLowerCase()
          )?.[1]
        || null;

      return {
        name: topicName,
        rating: evalData?.rating || 'unevaluated',
        confidence: evalData?.confidence || evalData?.score || 0,
        prerequisites: dependencyData?.[topicName] || [],
      };
    });
  }, [allTopics, evaluationData, dependencyData]);

  const getRatingColor = (rating) => {
    switch (rating) {
      case 'strong':
        return 'bg-green-100 border-green-300 text-green-900';
      case 'partial':
        return 'bg-yellow-100 border-yellow-300 text-yellow-900';
      case 'weak':
        return 'bg-red-100 border-red-300 text-red-900';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-700';
    }
  };

  const getRatingIcon = (rating) => {
    switch (rating) {
      case 'strong':  return 'Strong';
      case 'partial': return 'Partial';
      case 'weak':    return 'Weak';
      default:        return 'Unknown';
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #f0f4ff 0%, #f8faff 40%, #eef2fb 100%)' }}>
      {/* Navigation Bar */}
      <nav className="t-nav">
        <div className="t-nav-inner">
          <Link to="/" className="t-logo">
            <div className="t-logo-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4" fill="white" opacity="0.9" />
                <circle cx="5" cy="7" r="2.5" fill="white" opacity="0.7" />
                <circle cx="19" cy="7" r="2.5" fill="white" opacity="0.7" />
                <circle cx="5" cy="17" r="2.5" fill="white" opacity="0.7" />
                <circle cx="19" cy="17" r="2.5" fill="white" opacity="0.7" />
                <line x1="12" y1="12" x2="5" y2="7" stroke="white" strokeWidth="1.5" opacity="0.5" />
                <line x1="12" y1="12" x2="19" y2="7" stroke="white" strokeWidth="1.5" opacity="0.5" />
                <line x1="12" y1="12" x2="5" y2="17" stroke="white" strokeWidth="1.5" opacity="0.5" />
                <line x1="12" y1="12" x2="19" y2="17" stroke="white" strokeWidth="1.5" opacity="0.5" />
              </svg>
            </div>
            <span className="t-logo-text">ConceptGraphAI</span>
          </Link>
          <div className="t-nav-links">
            <Link to="/" className="t-nav-link">Home</Link>
            <Link to="/syllabuses" className="t-nav-link">Learn</Link>
            <Link to="/dashboard" className="t-nav-link active">Dashboard</Link>
            <UserMenu />
          </div>
        </div>
      </nav>

      <div className="t-page">
        <div className="t-content">
        {/* Header */}
        <div style={{ marginBottom: 36 }}>
          <h1 className="t-heading-xl">Learning Dashboard</h1>
          <p className="t-body" style={{ marginTop: 8 }}>Track your learning progress and identify areas for improvement</p>
        </div>

        {/* Top Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 28 }}>
          <div className="t-card t-card-blue">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="t-caption" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Topics</p>
                <p className="t-stat-number t-text-blue">{evaluationStats.total}</p>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Topics</span>
            </div>
            <p className="t-caption" style={{ marginTop: 8 }}>Topics evaluated</p>
          </div>

          <div className="t-card t-card-green">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="t-caption" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Strong</p>
                <p className="t-stat-number t-text-green">{evaluationStats.strong.length}</p>
                {evaluationStats.total > 0 && <p className="t-caption" style={{ marginTop: 2 }}>{Math.round((evaluationStats.strong.length / evaluationStats.total) * 100)}% of total</p>}
              </div>

            </div>
          </div>

          <div className="t-card t-card-amber">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="t-caption" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Partial</p>
                <p className="t-stat-number" style={{ color: '#f59e0b' }}>{evaluationStats.partial.length}</p>
                {evaluationStats.total > 0 && <p className="t-caption" style={{ marginTop: 2 }}>{Math.round((evaluationStats.partial.length / evaluationStats.total) * 100)}% of total</p>}
              </div>

            </div>
          </div>

          <div className="t-card t-card-red">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="t-caption" style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Weak</p>
                <p className="t-stat-number t-text-red">{evaluationStats.weak.length}</p>
                {evaluationStats.total > 0 && <p className="t-caption" style={{ marginTop: 2 }}>{Math.round((evaluationStats.weak.length / evaluationStats.total) * 100)}% of total</p>}
              </div>

            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 28 }}>
          {pieData.length > 0 && (
            <div className="t-card">
              <h2 className="t-heading-md" style={{ marginBottom: 20 }}>Knowledge Distribution</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-6 space-y-3">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm font-medium text-gray-700">{item.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {progressData.some((d) => d.count > 0) && (
            <div className="t-card">
              <h2 className="t-heading-md" style={{ marginBottom: 20 }}>Progress Overview</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-6 space-y-2">
                {progressData.map((item) => (
                  <div key={item.category} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{item.category}</span>
                    <span className="text-sm font-semibold text-gray-800">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 20 }}>
          <div className="t-card" style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="t-heading-md">Topics Needing Attention</h2>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="t-select"
              >
                <option value="weakness">Most Weak First</option>
                <option value="confidence">Most Confident First</option>
                <option value="name">Alphabetical</option>
              </select>
            </div>

            {sortedWeakTopics.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {sortedWeakTopics.map((topic, idx) => (
                  <div
                    key={idx}
                    className="p-4 border-2 border-red-200 rounded-lg bg-red-50 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-semibold text-red-900">{topic.name}</p>
                        <p className="text-xs text-red-700 mt-1">
                          Confidence Level: {topic.confidence}%
                        </p>
                      </div>

                    </div>
                    <div className="w-full h-2 bg-red-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${Math.max(topic.confidence, 10)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500">
                <p className="text-lg">No weak topics detected!</p>
                <p className="text-sm mt-2">Great job! Keep practicing to maintain your knowledge.</p>
              <div className="t-p-8 t-text-center t-text-gray-500">
                <p className="t-text-lg">No weak topics detected!</p>
                <p className="t-text-sm t-mt-2">Great job! Keep practicing to maintain your knowledge.</p>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 240 }}>
            {/* Overall Progress */}
            <div className="t-card">
              <h3 className="t-text-lg t-font-bold t-text-gray-800 t-mb-4">Overall Status</h3>
              <div className="t-space-y-4">
                <div>
                  <div className="t-flex t-justify-between t-items-center t-mb-2">
                    <span className="t-text-sm t-font-semibold t-text-gray-700">Mastery Level</span>
                    <span className="t-text-lg t-font-bold t-text-blue-600">
                      {evaluationStats.averageConfidence}%
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500"
                      style={{ width: `${evaluationStats.averageConfidence}%` }}
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Next Steps</p>
                  {sortedWeakTopics.length > 0 ? (
                    <p className="text-sm text-blue-900">
                      Focus on strengthening <strong>{sortedWeakTopics[0].name}</strong>
                    </p>
                  ) : (
                    <p className="text-sm text-blue-900">All topics mastered! Challenge yourself with practice.</p>
                  )}
                </div>

                {evaluationStats.strong.length > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs font-semibold text-green-700 uppercase mb-1">Strengths</p>
                    <div className="space-y-1">
                      {evaluationStats.strong.slice(0, 3).map((topic, idx) => (
                        <p key={idx} className="text-sm text-green-900">
                          {topic.name}
                        </p>
                      ))}
                      {evaluationStats.strong.length > 3 && (
                        <p className="text-xs text-green-800 font-semibold">
                          +{evaluationStats.strong.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="t-card">
              <h3 className="t-heading-md" style={{ marginBottom: 16 }}>Recommendations</h3>
              <div className="space-y-3">
                {sortedWeakTopics.length > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs font-semibold text-red-700 uppercase mb-1">Priority Action</p>
                    <p className="text-sm text-red-900">
                      Review weak topics using the Weakness Analysis tool
                    </p>
                  </div>
                )}

                {evaluationStats.partial.length > 0 && (
                  <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <p className="text-xs font-semibold text-yellow-700 uppercase mb-1">Practice More</p>
                    <p className="text-sm text-yellow-900">
                      {evaluationStats.partial.length} topic(s) need reinforcement
                    </p>
                  </div>
                )}

                {evaluationStats.weak.length === 0 && evaluationStats.partial.length === 0 && (
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-xs font-semibold text-green-700 uppercase mb-1">Excellent Work</p>
                    <p className="text-sm text-green-900">Continue practicing to maintain mastery</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {topicsWithStatus.length > 0 && (
          <div className="t-card" style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="t-heading-md">Topics Map</h2>
              <p className="t-caption">All topics color-coded by proficiency level</p>
            </div>
            <DashboardTopicsGraph topics={allTopics} evaluationData={evaluationData} />
          </div>
        )}

        {topicsWithStatus.length > 0 && (
          <div className="t-card" style={{ marginTop: 20 }}>
            <h2 className="t-heading-md" style={{ marginBottom: 20 }}>All Topics Detail View</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topicsWithStatus.map((topic, idx) => (
                <div
                  key={idx}
                  className={`p-5 rounded-lg border-2 transition-all hover:shadow-md ${getRatingColor(topic.rating)}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-base">{topic.name}</p>
                      <p className="text-xs opacity-75 mt-1">
                        Confidence: <span className="font-semibold">{topic.confidence}%</span>
                      </p>
                    </div>

                  </div>
                  {topic.rating !== 'unevaluated' && (
                    <div className="w-full h-2 bg-current bg-opacity-20 rounded-full overflow-hidden">
                      <div
                        className="h-full opacity-70 transition-all"
                        style={{ width: `${topic.confidence}%` }}
                      />
                    </div>
                  )}
                  <p className="text-xs mt-3 opacity-60 capitalize">
                    Status: <span className="font-semibold">{topic.rating.replace('-', ' ')}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
};

export default DashboardPage;
