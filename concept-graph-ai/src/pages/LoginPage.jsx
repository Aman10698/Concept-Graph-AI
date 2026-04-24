import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const { login, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!email.trim())    { setLocalError('Email is required');    return; }
    if (!password.trim()) { setLocalError('Password is required'); return; }

    setIsLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/dashboard');
      } else {
        setLocalError(result.error || 'Login failed');
      }
    } catch {
      setLocalError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const displayError = localError || error;

  return (
    <div className="t-auth-root">
      {/* Background blobs */}
      <div className="t-auth-blob t-auth-blob-1" />
      <div className="t-auth-blob t-auth-blob-2" />

      <div className="t-auth-wrapper">
        {/* Logo */}
        <Link to="/" className="t-auth-logo">
          <div className="t-logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="4" fill="white" opacity="0.9" />
              <circle cx="5"  cy="7"  r="2.5" fill="white" opacity="0.7" />
              <circle cx="19" cy="7"  r="2.5" fill="white" opacity="0.7" />
              <circle cx="5"  cy="17" r="2.5" fill="white" opacity="0.7" />
              <circle cx="19" cy="17" r="2.5" fill="white" opacity="0.7" />
              <line x1="12" y1="12" x2="5"  y2="7"  stroke="white" strokeWidth="1.5" opacity="0.5" />
              <line x1="12" y1="12" x2="19" y2="7"  stroke="white" strokeWidth="1.5" opacity="0.5" />
              <line x1="12" y1="12" x2="5"  y2="17" stroke="white" strokeWidth="1.5" opacity="0.5" />
              <line x1="12" y1="12" x2="19" y2="17" stroke="white" strokeWidth="1.5" opacity="0.5" />
            </svg>
          </div>
          <span className="t-logo-text">ConceptGraphAI</span>
        </Link>

        {/* Card */}
        <div className="t-auth-card t-animate-in">
          <div className="t-auth-header">
            <h1 className="t-heading-lg">Welcome back</h1>
            <p className="t-body" style={{ marginTop: 4 }}>Sign in to continue your learning journey</p>
          </div>

          {displayError && (
            <div className="t-alert t-alert-error" style={{ marginBottom: 20 }}>
              {displayError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="t-auth-form">
            <div className="t-field">
              <label className="t-label" htmlFor="login-email">Email Address</label>
              <input
                id="login-email"
                type="email"
                className="t-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <div className="t-field">
              <label className="t-label" htmlFor="login-password">Password</label>
              <input
                id="login-password"
                type="password"
                className="t-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={isLoading}
              className="t-btn t-btn-primary t-btn-full t-btn-lg"
              style={{ marginTop: 8 }}
            >
              {isLoading ? (
                <>
                  <div className="t-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Signing in…
                </>
              ) : 'Sign In'}
            </button>
          </form>



          <p className="t-auth-foot-text">
            Don't have an account?{' '}
            <Link to="/signup" className="t-auth-link" id="signup-link">Create one</Link>
          </p>
        </div>
      </div>

      <style>{authStyles}</style>
    </div>
  );
};

const authStyles = `
.t-auth-root {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, #f0f4ff 0%, #f8faff 40%, #eef2fb 100%);
  padding: 32px 16px;
  position: relative;
  overflow: hidden;
}

.t-auth-blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}
.t-auth-blob-1 {
  width: 480px; height: 480px;
  background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
  top: -120px; left: -120px;
}
.t-auth-blob-2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%);
  bottom: -100px; right: -80px;
}

.t-auth-wrapper {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.t-auth-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
}

.t-auth-card {
  width: 100%;
  background: rgba(255,255,255,0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(99,102,241,0.1);
  border-radius: 20px;
  box-shadow: 0 8px 40px rgba(99,102,241,0.1), 0 2px 8px rgba(0,0,0,0.05);
  padding: 36px 36px 28px;
}

.t-auth-header {
  margin-bottom: 28px;
}

.t-auth-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.t-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}



.t-auth-foot-text {
  margin-top: 20px;
  text-align: center;
  font-size: 0.875rem;
  color: #6b7280;
}

.t-auth-link {
  color: #6366f1;
  font-weight: 700;
  text-decoration: none;
  transition: color 0.2s;
}
.t-auth-link:hover { color: #4f46e5; text-decoration: underline; }
`;

export default LoginPage;
