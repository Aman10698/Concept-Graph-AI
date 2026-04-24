import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import ProgressDashboard from './components/ProgressDashboard';
import DocumentUpload from './components/DocumentUpload';
import Quiz from './components/Quiz';

/**
 * Main App Component with Sidebar Navigation
 * Professional Dashboard Layout
 */
const App = () => {
  const [userId, setUserId] = useState(null);
  const [userName, setUserName] = useState('');
  const [activeView, setActiveView] = useState('dashboard');
  const [currentGraph, setCurrentGraph] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    let storedUserId = localStorage.getItem('userId');
    if (!storedUserId) {
      storedUserId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('userId', storedUserId);
    }
    setUserId(storedUserId);

    const storedName = localStorage.getItem('userName');
    if (storedName) {
      setUserName(storedName);
    }
  }, []);

  const handleAuthSubmit = (authData) => {
    setUserId(authData.userId);
    setUserName(authData.name);
    localStorage.setItem('userId', authData.userId);
    localStorage.setItem('userName', authData.name);
    localStorage.setItem('userEmail', authData.email);
    setActiveView('dashboard');
  };

  if (!userName) {
    return <Auth onAuthSubmit={handleAuthSubmit} />;
  }

  const handleGraphCreated = (graph) => {
    setCurrentGraph(graph);
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', count: null },
    { id: 'upload', label: 'Upload', icon: '📤', count: null },
    { id: 'quiz', label: 'Quiz', icon: '✏️', count: null },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'w-64' : 'w-20'} transition-all duration-300`}>
        <div className="sidebar-header">
          <div className="text-2xl font-bold text-green-600">🧠</div>
          {sidebarOpen && <div className="sidebar-logo">Concept AI</div>}
        </div>

        <nav className="sidebar-menu">
          <div className="sidebar-section">
            <div className="sidebar-section-title">MENU</div>
            {menuItems.map((item) => (
              <div
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`sidebar-item ${activeView === item.id ? 'active' : ''}`}
              >
                <span className="text-xl">{item.icon}</span>
                {sidebarOpen && (
                  <>
                    <span className="flex-1">{item.label}</span>
                    {item.count && (
                      <span className="sidebar-badge">{item.count}</span>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className="sidebar-section mt-8">
            <div className="sidebar-section-title">GENERAL</div>
            <div className="sidebar-item">
              <span className="text-xl">⚙️</span>
              {sidebarOpen && <span className="flex-1">Settings</span>}
            </div>
            <div className="sidebar-item">
              <span className="text-xl">❓</span>
              {sidebarOpen && <span className="flex-1">Help</span>}
            </div>
            <div
              onClick={() => {
                localStorage.removeItem('userName');
                setUserName('');
              }}
              className="sidebar-item hover:text-red-600"
            >
              <span className="text-xl">🚪</span>
              {sidebarOpen && <span className="flex-1">Logout</span>}
            </div>
          </div>
        </nav>

        {/* Mobile App Promo */}
        {sidebarOpen && (
          <div className="p-6">
            <div className="bg-green-600 text-white rounded-xl p-4 text-center">
              <p className="text-sm font-semibold mb-2">Download our Mobile App</p>
              <p className="text-xs mb-3">Get learning on the go!</p>
              <button className="bg-white text-green-600 px-3 py-1 rounded text-xs font-bold hover:bg-gray-100">
                Download
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Layout */}
      <div className="main-layout flex-1 flex flex-col">
        {/* Top Navigation */}
        <div className="top-nav">
          <div className="top-nav-left">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 hover:bg-gray-200 rounded-lg transition"
            >
              {sidebarOpen ? '☰' : '→'}
            </button>
            <input
              type="text"
              placeholder="Search task"
              className="search-box ml-4"
            />
          </div>

          <div className="top-nav-right">
            <button className="notification-icon">
              📬
            </button>
            <button className="notification-icon">
              🔔
            </button>
            <div className="flex items-center gap-3">
              <div className="user-avatar">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="user-info">
                <div className="user-name">{userName}</div>
                <div className="user-email">{localStorage.getItem('userEmail')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="content flex-1 overflow-auto">
          {activeView === 'dashboard' && (
            <ProgressDashboard userId={userId} userName={userName} currentGraph={currentGraph} />
          )}

          {activeView === 'upload' && userId && (
            <div>
              <div className="content-header">
                <div className="content-title">
                  <h1>📤 Upload Document</h1>
                  <p className="content-subtitle">Upload and extract concepts from your learning materials</p>
                </div>
              </div>
              <DocumentUpload userId={userId} onGraphCreated={handleGraphCreated} />
            </div>
          )}

          {activeView === 'quiz' && userId && (
            <div>
              <div className="content-header">
                <div className="content-title">
                  <h1>✏️ Take Quiz</h1>
                  <p className="content-subtitle">Test your knowledge with AI-generated questions</p>
                </div>
              </div>
              <Quiz userId={userId} graphId={currentGraph?.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="group">
                <h1 className="text-5xl font-extrabold text-white animate-slide-in-right">
                  🧠 <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Concept Graph AI</span>
                </h1>
                <p className="mt-2 text-lg text-white/60 font-light group-hover:text-white/80 transition-colors">
                  Learn smarter with AI-powered concept mapping
                </p>
              </div>
              {userName && (
                <div className="rounded-2xl bg-gradient-to-r from-blue-500/20 to-purple-500/20 px-6 py-3 backdrop-blur-lg border border-white/20 hover:border-white/40 hover:shadow-lg hover:shadow-purple-500/20 transition-all duration-300 animate-slide-in-left group">
                  <p className="text-lg font-semibold text-white">
                    <span className="group-hover:animate-bounce inline-block">👋</span> {userName}
                  </p>
                  <p className="text-xs text-white/50 mt-1">Learning in progress</p>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <section className="mb-24 rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/3 backdrop-blur-lg p-20 text-center shadow-xl animate-fade-in-scale hover:border-white/20 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-500 group will-animate">
            <div className="text-7xl mb-8 inline-block animate-bounce group-hover:animate-pulse">
              🚀
            </div>
            <h2 className="text-6xl font-extrabold text-white mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-slide-in-down">
              Welcome to Your Learning Journey
            </h2>
            <p className="text-2xl text-white/70 font-light max-w-3xl mx-auto animate-slide-in-up">
              Upload any document, extract key concepts, and test your knowledge
              with AI-generated quizzes
            </p>
            <div className="mt-8 h-1 w-32 mx-auto bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full blur-sm opacity-60 group-hover:opacity-100 transition-opacity duration-500" />
          </section>

          {/* Feature Cards */}
          <section className="mb-24 grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Upload Documents */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 to-white/5 backdrop-blur-lg p-8 shadow-lg hover-lift hover-glow-blue card-hover-effect animate-slide-in-up stagger-1 group cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/0 via-transparent to-purple-500/0 opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
              <div className="relative">
                <div className="text-6xl block text-center mb-4 group-hover:animate-bounce transition-all duration-300">
                  📄
                </div>
                <h3 className="text-2xl font-bold text-white text-center text-glow">Upload Documents</h3>
                <p className="mt-3 text-white/70 font-light text-center">
                  Support for PDF, images, DOCX, TXT and more. Instantly process your learning materials with AI.
                </p>
                <button
                  onClick={() => setActiveView('upload')}
                  className="mt-6 w-full rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 px-4 py-3 font-semibold text-white hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 transform hover:scale-105 active:scale-95 btn-primary-enhanced"
                >
                  Start Upload <span className="ml-2">→</span>
                </button>
              </div>
            </div>

            {/* Card 2: Extract Concepts */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-purple-500/10 to-white/5 backdrop-blur-lg p-8 shadow-lg hover-lift hover-glow-purple card-hover-effect animate-slide-in-up stagger-2 group cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 via-transparent to-pink-500/0 opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
              <div className="relative">
                <div className="text-6xl block text-center mb-4 group-hover:animate-float transition-all duration-300">
                  🧠
                </div>
                <h3 className="text-2xl font-bold text-white text-center text-glow">Extract Concepts</h3>
                <p className="mt-3 text-white/70 font-light text-center">
                  AI automatically extracts key topics and their relationships from your documents with precision.
                </p>
                <div className="mt-6 h-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            </div>

            {/* Card 3: Generate Quizzes */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-green-500/10 to-white/5 backdrop-blur-lg p-8 shadow-lg hover-lift card-hover-effect animate-slide-in-up stagger-3 group cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/0 via-transparent to-emerald-500/0 opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
              <div className="relative">
                <div className="text-6xl block text-center mb-4 group-hover:animate-spin transition-all duration-300">
                  📝
                </div>
                <h3 className="text-2xl font-bold text-white text-center text-glow">Generate Quizzes</h3>
                <p className="mt-3 text-white/70 font-light text-center">
                  Adaptive quizzes automatically generated to test your understanding and reinforce learning.
                </p>
                <button
                  onClick={() => setActiveView('quiz')}
                  className="mt-6 w-full rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 px-4 py-3 font-semibold text-white hover:shadow-lg hover:shadow-green-500/50 transition-all duration-300 transform hover:scale-105 active:scale-95 btn-primary-enhanced"
                >
                  Take Quiz <span className="ml-2">✨</span>
                </button>
              </div>
            </div>

            {/* Card 4: Track Progress */}
            <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-orange-500/10 to-white/5 backdrop-blur-lg p-8 shadow-lg hover-lift card-hover-effect animate-slide-in-up stagger-4 group cursor-pointer overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/0 via-transparent to-red-500/0 opacity-0 group-hover:opacity-20 transition-opacity duration-500" />
              <div className="relative">
                <div className="text-6xl block text-center mb-4 group-hover:animate-pulse transition-all duration-300">
                  📊
                </div>
                <h3 className="text-2xl font-bold text-white text-center text-glow">Track Progress</h3>
                <p className="mt-3 text-white/70 font-light text-center">
                  Beautiful dashboard showing progress, weak areas, and personalized learning recommendations.
                </p>
                <button
                  onClick={() => setActiveView('dashboard')}
                  className="mt-6 w-full rounded-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 px-4 py-3 font-semibold text-white hover:shadow-lg hover:shadow-orange-500/50 transition-all duration-300 transform hover:scale-105 active:scale-95 btn-primary-enhanced"
                >
                  Dashboard <span className="ml-2">📈</span>
                </button>
              </div>
            </div>
          </section>

          {/* Quick Actions */}
          <section className="mb-24 rounded-2xl border border-white/10 bg-gradient-to-r from-white/5 to-white/3 backdrop-blur-lg p-16 text-center shadow-xl card-hover-effect group animate-slide-in-up">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-blue-500/0 via-purple-500/10 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10" />
            <h2 className="text-4xl font-extrabold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              🚀 Get Started in Seconds
            </h2>
            <p className="text-white/60 mb-10 font-light">Choose your learning path</p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center flex-wrap">
              <button
                onClick={() => setActiveView('upload')}
                className="rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 px-8 py-4 font-semibold text-white hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95 btn-primary-enhanced"
              >
                <span className="text-2xl">📤</span>
                <span>Upload Document</span>
              </button>
              <button
                onClick={() => setActiveView('quiz')}
                className="rounded-xl border-2 border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20 px-8 py-4 font-semibold text-white hover:shadow-lg hover:shadow-purple-500/50 transition-all duration-300 flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95 backdrop-blur-lg"
              >
                <span className="text-2xl">✏️</span>
                <span>Take a Quiz</span>
              </button>
              <button
                onClick={() => setActiveView('dashboard')}
                className="rounded-xl border-2 border-orange-500/50 bg-orange-500/10 hover:bg-orange-500/20 px-8 py-4 font-semibold text-white hover:shadow-lg hover:shadow-orange-500/50 transition-all duration-300 flex items-center justify-center gap-3 transform hover:scale-105 active:scale-95 backdrop-blur-lg"
              >
                <span className="text-2xl">📈</span>
                <span>View Progress</span>
              </button>
            </div>
          </section>

          {/* Current Graph Summary */}
          {currentGraph && (
            <section className="mb-24 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/3 backdrop-blur-lg p-8 shadow-xl card-hover-effect group animate-fade-in-scale">
              <h3 className="text-3xl font-bold text-white mb-3 text-center">📊 Last Processed Document</h3>
              <p className="text-white/60 text-center mb-8 font-light">Your latest concept extraction</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Topics Card */}
                <div className="rounded-xl bg-gradient-to-br from-blue-500/15 to-blue-500/5 border border-blue-500/20 p-6 hover-lift hover-glow-blue transition-all duration-300 group/card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm font-light">📚 Topics</p>
                      <p className="text-4xl font-bold text-white mt-2 group-hover/card:text-blue-300 transition-colors">
                        {currentGraph.topics?.length || 0}
                      </p>
                    </div>
                    <div className="text-5xl opacity-30 group-hover/card:opacity-60 transition-opacity">📖</div>
                  </div>
                </div>
                
                {/* Relationships Card */}
                <div className="rounded-xl bg-gradient-to-br from-purple-500/15 to-purple-500/5 border border-purple-500/20 p-6 hover-lift hover-glow-purple transition-all duration-300 group/card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm font-light">🔗 Relationships</p>
                      <p className="text-4xl font-bold text-white mt-2 group-hover/card:text-purple-300 transition-colors">
                        {currentGraph.relationships?.length || 0}
                      </p>
                    </div>
                    <div className="text-5xl opacity-30 group-hover/card:opacity-60 transition-opacity">⛓️</div>
                  </div>
                </div>
                
                {/* Processed Date Card */}
                <div className="rounded-xl bg-gradient-to-br from-green-500/15 to-green-500/5 border border-green-500/20 p-6 hover-lift transition-all duration-300 group/card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/70 text-sm font-light">📅 Processed</p>
                      <p className="text-lg font-bold text-white mt-2 group-hover/card:text-green-300 transition-colors">
                        {new Date(currentGraph.createdAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        {new Date(currentGraph.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-5xl opacity-30 group-hover/card:opacity-60 transition-opacity">✅</div>
                  </div>
                </div>
              </div>
            </section>
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-white/10 bg-gradient-to-r from-white/5 to-white/3 backdrop-blur-xl mt-16">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              {/* Brand */}
              <div className="space-y-2">
                <h3 className="text-white font-bold text-lg">Concept Graph AI</h3>
                <p className="text-white/50 text-sm font-light">Making learning smarter with AI-powered concepts</p>
              </div>
              
              {/* Features */}
              <div className="space-y-2">
                <h4 className="text-white font-semibold text-sm">Features</h4>
                <ul className="space-y-1 text-white/50 text-sm font-light">
                  <li>✨ AI Concept Extraction</li>
                  <li>📝 Adaptive Quizzes</li>
                  <li>📊 Progress Tracking</li>
                </ul>
              </div>
              
              {/* Tips */}
              <div className="space-y-2">
                <h4 className="text-white font-semibold text-sm">Get Started</h4>
                <p className="text-white/50 text-sm font-light">
                  💡 Upload a document to create your first concept graph
                </p>
              </div>
            </div>
            
            <div className="border-t border-white/10 pt-8 text-center">
              <p className="text-white/60 text-sm">
                Made with <span className="text-red-400">❤️</span> by AI Learning Platform
              </p>
              {userId && (
                <p className="mt-2 text-xs text-white/40 font-light">
                  User: {userId?.substring(0, 15)}...
                </p>
              )}
            </div>
          </div>
        </footer>
      </div>
    );
  }

  // Upload View
  if (activeView === 'upload' && userId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="border-b border-white/10 bg-gradient-to-r from-white/5 to-white/3 backdrop-blur-xl sticky top-0 z-50 shadow-lg shadow-blue-500/10">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-white">🧠 Concept Graph AI</h1>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <button
            onClick={() => setActiveView('home')}
            className="mb-8 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2 font-semibold text-white hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-2 group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            Back to Home
          </button>

          <DocumentUpload
            userId={userId}
            onGraphCreated={handleGraphCreated}
          />
        </main>
      </div>
    );
  }

  // Quiz View
  if (activeView === 'quiz' && userId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="border-b border-white/10 bg-gradient-to-r from-white/5 to-white/3 backdrop-blur-xl sticky top-0 z-50 shadow-lg shadow-purple-500/10">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-white">🧠 Concept Graph AI</h1>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <button
            onClick={() => setActiveView('home')}
            className="mb-8 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2 font-semibold text-white hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-2 group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            Back to Home
          </button>

          <Quiz
            userId={userId}
            graphId={currentGraph?.id}
            onAnswerSubmitted={handleAnswerSubmitted}
          />
        </main>
      </div>
    );
  }

  // Dashboard View
  if (activeView === 'dashboard' && userId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="border-b border-white/10 bg-gradient-to-r from-white/5 to-white/3 backdrop-blur-xl sticky top-0 z-50 shadow-lg shadow-orange-500/10">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold text-white">🧠 Concept Graph AI</h1>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <button
            onClick={() => setActiveView('home')}
            className="mb-8 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 px-4 py-2 font-semibold text-white hover:shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 flex items-center gap-2 group"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span>
            Back to Home
          </button>

          <ProgressDashboard userId={userId} />
        </main>
      </div>
    );
  }

  return null;
};

export default App;
