import React from 'react';

const ErrorDisplay = ({ error, onDismiss, onRetry }) => {
  if (!error) return null;

  return (
    <div className="fixed bottom-4 right-4 max-w-md bg-red-50 border border-red-300 rounded-lg shadow-lg p-4 animate-slideIn">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-semibold text-red-800">Error</h3>
          <p className="text-sm text-red-700 mt-1">
            {error.userMessage || error.message || 'An error occurred'}
          </p>

          {/* Show error details in development */}
          {process.env.NODE_ENV === 'development' && error.data && (
            <details className="mt-2 text-xs text-red-600 cursor-pointer">
              <summary className="opacity-60 hover:opacity-100">Details</summary>
              <pre className="mt-1 p-2 bg-red-900 text-red-100 rounded overflow-auto max-h-40">
                {JSON.stringify(error.data, null, 2)}
              </pre>
            </details>
          )}

          {/* Show individual errors */}
          {error.errors && Array.isArray(error.errors) && (
            <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
              {error.errors.map((err, index) => (
                <li key={index}>{err}</li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={onDismiss}
          className="ml-2 text-red-400 hover:text-red-600 font-bold text-lg"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 mt-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        )}
        <button
          onClick={onDismiss}
          className="px-3 py-1 bg-gray-300 text-gray-800 rounded text-sm hover:bg-gray-400 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default ErrorDisplay;
