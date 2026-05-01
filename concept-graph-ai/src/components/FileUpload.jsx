import React, { useState, useRef } from 'react';
import axios from 'axios';

const FileUpload = ({ onUploadSuccess, onUploadError }) => {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading]       = useState(false);
  const [error, setError]                   = useState(null);
  const [fileName, setFileName]             = useState('');
  const [isDragging, setIsDragging]         = useState(false);
  const inputRef = useRef(null);

  const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  const MAX_FILE_SIZE  = 10 * 1024 * 1024; // 10 MB

  const processFile = async (selectedFile) => {
    if (!selectedFile) return;

    if (!ACCEPTED_TYPES.includes(selectedFile.type)) {
      setError('Only PDF and image files (JPEG, PNG) are accepted.');
      return;
    }
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('File size must be less than 10 MB.');
      return;
    }

    setError(null);
    setFileName(selectedFile.name);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/upload`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            setUploadProgress(Math.round((e.loaded * 100) / e.total));
          },
        }
      );

      setIsUploading(false);
      setUploadProgress(0);
      setFileName('');
      if (onUploadSuccess) onUploadSuccess(response.data);
    } catch (err) {
      setIsUploading(false);
      setUploadProgress(0);
      const msg = err.response?.data?.message || err.message || 'Upload failed';
      setError(msg);
      if (onUploadError) onUploadError(err);
    }
  };

  // ── Drag and drop handlers ────────────────────────────────
  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    processFile(e.dataTransfer.files[0]);
  };
  const onFileChange = (e) => processFile(e.target.files[0]);

  return (
    <div>
      {/* Drop zone — click anywhere or drag a file */}
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${isDragging ? '#6366f1' : isUploading ? '#22c55e' : '#c7d2fe'}`,
          borderRadius: 14,
          padding: '36px 24px',
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          background: isDragging ? '#eff6ff' : isUploading ? '#f0fdf4' : '#fafbff',
          transition: 'all .2s',
          userSelect: 'none',
        }}
      >
        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={onFileChange}
          disabled={isUploading}
          style={{ display: 'none' }}
        />

        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%', margin: '0 auto 16px',
          background: isUploading ? 'linear-gradient(135deg,#dcfce7,#bbf7d0)' : 'linear-gradient(135deg,#eff6ff,#dbeafe)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.6rem',
          boxShadow: '0 4px 12px rgba(99,102,241,0.15)',
        }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
            stroke={isUploading ? '#16a34a' : isDragging ? '#6366f1' : '#3b82f6'}
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {isUploading
              ? <><circle cx="12" cy="12" r="10"/><polyline points="8 12 12 8 16 12"/><line x1="12" y1="8" x2="12" y2="16"/></>
              : <><polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/></>
            }
          </svg>
        </div>

        {isUploading ? (
          <div>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#15803d', marginBottom: 6 }}>
              Uploading {fileName}…
            </p>
            <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: 16 }}>Please wait</p>
            {/* Progress bar */}
            <div style={{ maxWidth: 320, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>Progress</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#22c55e' }}>{uploadProgress}%</span>
              </div>
              <div style={{ height: 8, background: '#dcfce7', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#22c55e', borderRadius: 999, transition: 'width .3s' }} />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginBottom: 6 }}>
              {isDragging ? 'Drop your file here' : 'Click to upload or drag & drop'}
            </p>
            <p style={{ fontSize: '0.82rem', color: '#9ca3af', marginBottom: 16 }}>
              PDF, JPG, PNG — max 10 MB
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 24px', borderRadius: 9,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: '#fff', fontWeight: 700, fontSize: '0.875rem',
              boxShadow: '0 4px 12px rgba(99,102,241,0.25)',
              pointerEvents: 'none',   /* click handled by parent */
            }}>
              Choose File
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{ marginTop: 12, padding: '10px 16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 9 }}>
          <p style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>{error}</p>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
