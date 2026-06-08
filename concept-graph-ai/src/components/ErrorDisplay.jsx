import React from 'react';

const ErrorDisplay = ({ error, onDismiss, onRetry }) => {
  if (!error) return null;

  const msg = error.userMessage || error.message || 'An error occurred';

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      right: 24,
      maxWidth: 420,
      zIndex: 9999,
      background: '#fff',
      border: '1.5px solid #fca5a5',
      borderRadius: 14,
      boxShadow: '0 8px 32px rgba(220,38,38,0.12)',
      padding: '16px 18px',
      animation: 'slideUp 0.25s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, fontSize: '1rem',
          }}>⚠️</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: '0.9rem', color: '#991b1b', marginBottom: 2 }}>Error</p>
            <p style={{ fontSize: '0.83rem', color: '#dc2626', lineHeight: 1.5 }}>{msg}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Close"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#9ca3af', fontSize: '1.2rem', lineHeight: 1,
            padding: 2, flexShrink: 0,
          }}
        >✕</button>
      </div>

      {/* Dev details */}
      {process.env.NODE_ENV === 'development' && error.data && (
        <details style={{ marginTop: 8 }}>
          <summary style={{ fontSize: '0.75rem', color: '#9ca3af', cursor: 'pointer' }}>Details</summary>
          <pre style={{
            marginTop: 4, padding: '6px 8px', background: '#1e1e2e',
            color: '#f1f5f9', borderRadius: 6, fontSize: '0.7rem',
            overflowX: 'auto', maxHeight: 120,
          }}>{JSON.stringify(error.data, null, 2)}</pre>
        </details>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {onRetry && (
          <button
            onClick={onRetry}
            style={{
              padding: '6px 14px', borderRadius: 8, border: 'none',
              background: '#dc2626', color: '#fff',
              fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseOver={e => e.target.style.opacity = '0.85'}
            onMouseOut={e => e.target.style.opacity = '1'}
          >Retry</button>
        )}
        <button
          onClick={onDismiss}
          style={{
            padding: '6px 14px', borderRadius: 8,
            border: '1.5px solid #e5e7eb', background: '#fff',
            fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', color: '#4b5563',
            transition: 'background 0.15s',
          }}
          onMouseOver={e => e.target.style.background = '#f9fafb'}
          onMouseOut={e => e.target.style.background = '#fff'}
        >Dismiss</button>
      </div>

      <style>{`@keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }`}</style>
    </div>
  );
};

export default ErrorDisplay;
