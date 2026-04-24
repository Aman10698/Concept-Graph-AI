import React, { useState, useRef } from 'react';
import { usePipeline } from '../hooks/usePipeline';

/**
 * DocumentUpload Component
 * 
 * Handles document file selection and processing
 * Shows:
 * - File selection UI
 * - Upload progress
 * - Processing status
 * - Extracted graph summary
 */
const DocumentUpload = ({ userId, onGraphCreated }) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processedGraph, setProcessedGraph] = useState(null);
  const fileInputRef = useRef(null);

  const { processDocument, loading, error, clearError } = usePipeline();

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const validTypes = [
        'application/pdf',
        'text/plain',
        'text/html',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'image/png',
        'image/jpeg',
        'image/jpg',
      ];

      if (!validTypes.includes(file.type)) {
        clearError();
        alert(
          'Invalid file type. Please upload: PDF, TXT, HTML, DOCX, PNG, JPG, JPEG'
        );
        return;
      }

      // Validate file size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size exceeds 10MB limit');
        return;
      }

      setSelectedFile(file);
      clearError();
    }
  };

  // Handle document processing
  const handleUpload = async () => {
    if (!selectedFile) {
      alert('Please select a file first');
      return;
    }

    if (!userId) {
      alert('User ID is required');
      return;
    }

    try {
      setUploadProgress(50);

      const result = await processDocument(selectedFile, userId);

      if (result.success) {
        setUploadProgress(100);
        setProcessedGraph(result.data);

        // Callback to parent component
        if (onGraphCreated) {
          onGraphCreated(result.data);
        }

        // Reset file input
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // Reset progress
        setTimeout(() => {
          setUploadProgress(0);
        }, 1500);
      }
    } catch (err) {
      console.error('Upload failed:', err);
      setUploadProgress(0);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="card rounded-2xl border border-gray-200 bg-white p-8 shadow-lg max-w-2xl mx-auto">
        <h2 className="text-4xl font-bold text-gray-900 mb-3 text-center">
          📄 Upload Document
        </h2>
        <p className="text-gray-600 text-center mb-8 font-medium">
          Extract concepts and create your knowledge graph
        </p>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-center justify-between">
            <span className="text-red-700 font-medium">❌ {error}</span>
            <button onClick={clearError} className="text-red-600 hover:text-red-700 text-xl font-bold transition-colors">
              ×
            </button>
          </div>
        )}

        {/* File Drop Zone */}
        <div
          className="mb-8 rounded-2xl border-2 border-dashed border-green-300 bg-green-50 p-12 text-center transition-all duration-300 cursor-pointer hover:border-green-400 hover:bg-green-100"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-6xl mb-4 block">📤</div>
          <p className="text-xl font-bold text-gray-900 mb-2">Drag and drop your document</p>
          <p className="text-gray-600 font-medium mb-6">or click below to browse</p>
          <label htmlFor="file-input" className="inline-block rounded-lg bg-green-600 hover:bg-green-700 px-6 py-3 font-semibold text-white cursor-pointer transition-colors hover:shadow-lg hover:shadow-green-600/30">
            Browse Files
          </label>
          <input
            ref={fileInputRef}
            id="file-input"
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.txt,.html,.docx,.png,.jpg,.jpeg"
            className="hidden"
          />
          <p className="text-xs text-gray-600 mt-6 font-medium">
            📁 Supported: PDF, TXT, HTML, DOCX, PNG, JPG (Max 10MB)
          </p>
        </div>

        {/* Selected File Info */}
        {selectedFile && (
          <div className="mb-8 rounded-lg border border-green-200 bg-green-50 p-4 flex items-center justify-between">
            <div>
              <p className="text-gray-900 font-semibold">
                ✅ Selected: <strong className="text-green-700">{selectedFile.name}</strong>
              </p>
              <p className="text-gray-600 text-sm font-medium mt-1">
                {(selectedFile.size / 1024).toFixed(2)} KB
              </p>
            </div>
            <span className="text-3xl opacity-40">📋</span>
          </div>
        )}

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!selectedFile || loading}
          className="mb-8 w-full rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-gray-300 px-6 py-3 font-bold text-lg text-white transition-all duration-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="inline-block animate-spin">⚡</span> 
              <span>Processing Document...</span>
            </>
          ) : (
            <>
              <span>⬆️</span> 
              <span>Process Document</span>
            </>
          )}
        </button>

        {/* Progress Bar */}
        {uploadProgress > 0 && (
          <div className="mb-8 rounded-full bg-gray-200 overflow-hidden border border-gray-300 h-3">
            <div
              className="bg-gradient-to-r from-green-500 to-green-600 h-full transition-all duration-300 flex items-center justify-center relative"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}

        {/* Success Message with Graph Summary */}
        {processedGraph && (
          <div className="rounded-lg border border-green-200 bg-green-50 overflow-hidden">
            <div className="bg-green-100 border-b border-green-200 p-4">
              <p className="font-bold text-lg text-green-700">✅ Document processed successfully!</p>
            </div>
            <div className="p-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">Extracted Content Summary</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-gray-900 font-semibold">
                    Topics Found: <span className="text-green-700">{processedGraph.topics?.length || 0}</span>
                  </p>
                  {processedGraph.topics && processedGraph.topics.length > 0 && (
                    <ul className="space-y-2 ml-4 mt-2">
                      {processedGraph.topics.slice(0, 5).map((topic, idx) => (
                        <li key={idx} className="text-gray-700 font-medium">
                          • <strong>{topic.name}</strong>
                          {topic.frequency && (
                            <span className="text-gray-600"> (mentioned {topic.frequency}x)</span>
                          )}
                        </li>
                      ))}
                      {processedGraph.topics.length > 5 && (
                        <li className="text-gray-600">• ... and {processedGraph.topics.length - 5} more</li>
                      )}
                    </ul>
                  )}
                </div>

                <div>
                  <p className="text-gray-900 font-semibold">
                    Relationships Found: <span className="text-green-700">{processedGraph.relationships?.length || 0}</span>
                  </p>
                </div>

                {processedGraph.summary && (
                  <div className="mt-4 pt-4 border-t border-green-200">
                    <p className="text-gray-900 font-bold mb-2">Summary:</p>
                    <div className="rounded-lg border border-gray-300 bg-white p-3 text-gray-700 text-sm font-medium">
                      {processedGraph.summary}
                    </div>
                  </div>
                )}

                <div className="text-xs text-gray-600 mt-4 pt-4 border-t border-green-200">
                  Processed on {new Date(processedGraph.createdAt).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-green-500/20">
                <p className="text-xs text-white/50 font-light">
                  Processed on {new Date(processedGraph.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentUpload;
