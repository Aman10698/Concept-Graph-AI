import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, FileText, Sparkles, ArrowUp } from 'lucide-react';

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
          border: `1.5px dashed ${isDragging ? '#7c3aed' : isUploading ? '#22c55e' : '#c4b5fd'}`,
          borderRadius: 20,
          padding: '48px 24px',
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          background: isDragging ? '#f5f3ff' : isUploading ? '#f0fdf4' : 'transparent',
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

        {/* Custom Illustration */}
        <div style={{ position: 'relative', width: 140, height: 120, margin: '0 auto 24px' }}>
          {/* Cloud background blobs */}
          <div style={{
            position: 'absolute', top: '10%', left: '0%', width: 140, height: 80,
            background: '#f5f3ff', borderRadius: '40px', zIndex: 0
          }} />
          <div style={{
            position: 'absolute', top: '-10%', left: '25%', width: 70, height: 70,
            background: '#f5f3ff', borderRadius: '50%', zIndex: 0
          }} />

          {/* Sparkles */}
          <Sparkles size={14} color="#c4b5fd" style={{ position: 'absolute', top: -5, left: 10, zIndex: 1 }} />
          <Sparkles size={10} color="#c4b5fd" style={{ position: 'absolute', top: 20, right: 10, zIndex: 1 }} />
          <Sparkles size={12} color="#c4b5fd" style={{ position: 'absolute', bottom: 10, left: 0, zIndex: 1 }} />

          {/* Document Card */}
          <div style={{
            position: 'absolute', top: '5%', left: '50%', transform: 'translateX(-50%)',
            width: 64, height: 86, background: '#e0e7ff', borderRadius: 8,
            boxShadow: '0 4px 12px rgba(124,58,237,0.1)', zIndex: 2,
            display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 12px',
            overflow: 'hidden'
          }}>
            {/* Folded corner effect */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: 20, height: 20, background: '#c7d2fe', borderBottomLeftRadius: 8 }} />
            
            <div style={{ width: '80%', height: 4, background: '#c7d2fe', borderRadius: 2, marginTop: 8 }} />
            <div style={{ width: '100%', height: 4, background: '#c7d2fe', borderRadius: 2 }} />
            <div style={{ width: '60%', height: 4, background: '#c7d2fe', borderRadius: 2 }} />
          </div>

          {/* Upload Button overlay */}
          <div style={{
            position: 'absolute', bottom: '15%', right: '22%',
            width: 28, height: 28, borderRadius: '50%', background: '#7c3aed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(124,58,237,0.3)', zIndex: 3,
            color: '#fff'
          }}>
            <ArrowUp size={16} strokeWidth={3} />
          </div>
        </div>

        {isUploading ? (
          <div>
            <p style={{ fontWeight: 800, fontSize: '1.1rem', color: '#15803d', marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>
              Uploading {fileName}…
            </p>
            <p style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: 16, fontFamily: "'Inter', sans-serif" }}>Please wait</p>
            {/* Progress bar */}
            <div style={{ maxWidth: 320, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b', fontFamily: "'Inter', sans-serif" }}>Progress</span>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#22c55e', fontFamily: "'Inter', sans-serif" }}>{uploadProgress}%</span>
              </div>
              <div style={{ height: 8, background: '#dcfce7', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${uploadProgress}%`, background: '#22c55e', borderRadius: 999, transition: 'width .3s' }} />
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', marginBottom: 6, fontFamily: "'Inter', sans-serif" }}>
              {isDragging ? 'Drop your file here' : 'Drag & drop your file here'}
            </p>
            <p style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: 10, fontFamily: "'Inter', sans-serif" }}>
              or click to browse
            </p>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: 24, fontFamily: "'Inter', sans-serif" }}>
              PDF, JPG, PNG — up to 10 MB
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 28px', borderRadius: 8,
              background: '#7c3aed',
              color: '#fff', fontWeight: 600, fontSize: '0.9rem',
              boxShadow: '0 4px 14px rgba(124,58,237,0.25)',
              pointerEvents: 'none',   /* click handled by parent */
              fontFamily: "'Inter', sans-serif"
            }}>
              <Upload size={16} /> Choose File
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
