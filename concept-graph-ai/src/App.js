import './App.css';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import LandingPage from './pages/LandingPage';

import Dashboard from './components/Dashboard';
import PracticePage from './pages/PracticePage';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import MySyllabusesPage from './pages/MySyllabusesPage';
import ProfilePage from './pages/ProfilePage';
import AboutPage from './pages/AboutPage';
import RagStudyPage from './pages/RagStudyPage';
import ChatsPage from './pages/ChatsPage';
import DepGraphPage from './pages/DepGraphPage';
import ConceptGraphPage from './pages/ConceptGraphPage';

/**
 * AppRoutes — clean routing that uses AppLayout for all authenticated pages
 */
function AppRoutes() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base, #0f0f1a)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44,
            border: '4px solid rgba(99,102,241,0.2)',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 12px',
          }} />
          <p style={{ color: '#9ca3af', fontWeight: 600 }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* ── Public Routes ── */}
      <Route path="/login"  element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Landing page — always shown at root, logged-in users can navigate to dashboard */}
      <Route
        path="/"
        element={<LandingPage />}
      />

      {/* ── Protected Routes — all wrapped in AppLayout ── */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout><Dashboard /></AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/practice"
        element={
          <ProtectedRoute>
            <AppLayout><PracticePage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/syllabuses"
        element={
          <ProtectedRoute>
            <AppLayout><MySyllabusesPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout><ProfilePage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/about"
        element={
          <ProtectedRoute>
            <AppLayout><AboutPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/rag-study"
        element={
          <ProtectedRoute>
            <AppLayout><RagStudyPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/chats"
        element={
          <ProtectedRoute>
            <AppLayout><ChatsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/dep-graph"
        element={
          <ProtectedRoute>
            <AppLayout><DepGraphPage /></AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/learn"
        element={
          <ProtectedRoute>
            <AppLayout><ConceptGraphPage /></AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
      <Route
        path="*"
        element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
