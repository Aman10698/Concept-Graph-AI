/**
 * RagStudyPage.jsx
 * Upload Notes page:
 *  - Upload card takes the full main area
 *  - "My Notes" button pinned at bottom → opens full-screen overlay
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import BloomPanel from '../components/BloomPanel';

const API = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');



/* ── Icons ──────────────────────────────────────────────────────── */
const UploadIcon = () => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" y1="3" x2="12" y2="15"/>
  </svg>
);
const FileIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);
const CheckIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
  </svg>
);
const SparkleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.68 5.17a2 2 0 0 0 1.27 1.27L21 11l-6.05 1.56a2 2 0 0 0-1.27 1.27L12 21l-1.68-5.17a2 2 0 0 0-1.27-1.27L3 13l6.05-1.56a2 2 0 0 0 1.27-1.27z"/>
  </svg>
);
const NotesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <line x1="10" y1="9" x2="8" y2="9"/>
  </svg>
);
const ArrowLeftIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"/>
    <polyline points="12 19 5 12 12 5"/>
  </svg>
);

/* ═══════════════════════════════════════════════════════════════════
   Upload Zone
═══════════════════════════════════════════════════════════════════ */
function UploadZone({ onUploaded, disabled, userId }) {
  const [isDragging, setIsDragging] = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState(null);
  const [phase,      setPhase]      = useState('idle');
  const inputRef = useRef(null);

  const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'text/plain'];

  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError('Only PDF, TXT, and image files (JPEG, PNG) are accepted.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10 MB.');
      return;
    }
    setError(null);
    setUploading(true);
    setPhase('uploading');
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('userId', userId);

    try {
      const xhr = new XMLHttpRequest();
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      });

      const uploadResult = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else reject(new Error(`Upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.open('POST', `${API}/api/upload`);
        xhr.send(formData);
      });

      // Step 1: Register the doc in MongoDB instantly — gets the real, stable documentId
      //         so it shows up in "My Notes" immediately, even before embedding finishes.
      const registerRes = await fetch(`${API}/api/rag/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          filename: uploadResult.file.originalName,
          mimetype: uploadResult.file.mimetype,
        }),
      });
      const registerJson = await registerRes.json();
      const documentId = registerJson.documentId;

      // Step 2: Notify parent & show success immediately (no waiting for embeddings)
      onUploaded({
        ...uploadResult,
        rag: { documentId, chunkCount: 0 },
      });
      setPhase('done');
      setUploading(false);
      setTimeout(() => setPhase('idle'), 3500);

      // Step 3: Background indexing — fire-and-forget
      // For PDFs: send raw file to /api/rag/index-multimodal → backend does per-page extraction
      //           → proper page numbers in RagRawDocument and LanceDB chunks
      // For TXT/images: fall back to /api/rag/index with pre-extracted text
      const isPdf = file.type === 'application/pdf';
      if (isPdf) {
        const pdfForm = new FormData();
        pdfForm.append('file', file);
        pdfForm.append('userId', userId);
        pdfForm.append('enableVision', 'false');
        fetch(`${API}/api/rag/index-multimodal`, {
          method: 'POST',
          body: pdfForm,
        })
          .then(r => r.json())
          .then(ragJson => {
            if (ragJson.success) {
              console.log(`✅ RAG multimodal indexed: ${ragJson.rag?.chunkCount} chunks, ${ragJson.rag?.pages} pages`);
            } else {
              console.warn('RAG multimodal indexing issue:', ragJson.error);
            }
          })
          .catch(err => console.warn('RAG multimodal indexing failed:', err.message));
      } else {
        // TXT / image — use pre-extracted text from upload response
        const extractedText = uploadResult.extraction?.extractedText || '';
        if (extractedText.trim().length > 20) {
          fetch(`${API}/api/rag/index`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              filename: uploadResult.file.originalName,
              mimetype: uploadResult.file.mimetype,
              extractedText,
            }),
          })
            .then(r => r.json())
            .then(ragJson => {
              if (ragJson.success) {
                console.log(`✅ RAG indexed: ${ragJson.rag?.chunkCount} chunks`);
              }
            })
            .catch(err => console.warn('RAG background indexing failed:', err.message));
        }
      }


    } catch (err) {
      setError(err.message || 'Upload failed');
      setUploading(false);
      setPhase('idle');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, onUploaded]);

  const onDragOver  = (e) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop      = (e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]); };
  const onFileChange = (e) => processFile(e.target.files[0]);

  const isDone = phase === 'done';

  return (
    <div style={{ width: '100%' }}>
      <div
        onClick={() => !uploading && !disabled && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${isDragging ? '#6366f1' : isDone ? '#22c55e' : uploading ? '#22c55e' : 'rgba(99,102,241,0.3)'}`,
          borderRadius: 24,
          padding: '60px 40px',
          textAlign: 'center',
          cursor: (uploading || disabled) ? 'not-allowed' : 'pointer',
          background: isDragging
            ? 'rgba(99,102,241,0.05)'
            : isDone
              ? 'rgba(34,197,94,0.03)'
              : uploading
                ? 'rgba(34,197,94,0.03)'
                : 'rgba(99,102,241,0.02)',
          transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Animated glow background */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: isDragging
            ? 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.10) 0%, transparent 65%)'
            : isDone
              ? 'radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.08) 0%, transparent 65%)'
              : 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.04) 0%, transparent 65%)',
          transition: 'all 0.3s',
        }} />

        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.txt"
          onChange={onFileChange} disabled={uploading || disabled} style={{ display: 'none' }} />

        {/* Icon circle */}
        <div style={{
          width: 88, height: 88, borderRadius: '50%', margin: '0 auto 24px',
          background: isDone
            ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
            : uploading
              ? 'linear-gradient(135deg, #dcfce7, #bbf7d0)'
              : isDragging
                ? 'linear-gradient(135deg, #6366f1, #8b5cf6)'
                : 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isDone || uploading ? '#16a34a' : isDragging ? '#fff' : '#6366f1',
          boxShadow: isDone
            ? '0 8px 32px rgba(34,197,94,0.2)'
            : uploading
              ? '0 8px 32px rgba(34,197,94,0.2)'
              : '0 8px 32px rgba(99,102,241,0.18)',
          transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {isDone
            ? <CheckIcon />
            : uploading
              ? <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  border: '3px solid rgba(34,197,94,0.2)',
                  borderTopColor: '#16a34a',
                  animation: 'rag-spin 0.8s linear infinite',
                }} />
              : <UploadIcon />
          }
        </div>

        {(uploading || isDone) ? (
          <div>
            <p style={{ fontWeight: 800, fontSize: '1.1rem', color: isDone ? '#15803d' : '#374151', margin: '0 0 10px' }}>
              {isDone
                ? 'Indexed Successfully!'
                : phase === 'uploading'
                  ? `Uploading… ${progress}%`
                  : 'Chunking & indexing…'}
            </p>
            {phase === 'uploading' && (
              <div style={{ maxWidth: 360, margin: '0 auto 8px', height: 8, background: 'rgba(34,197,94,0.15)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #22c55e, #16a34a)', borderRadius: 999, transition: 'width 0.3s ease' }} />
              </div>
            )}
            {phase === 'indexing' && (
              <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>Splitting text into searchable chunks…</p>
            )}
            {isDone && (
              <p style={{ fontSize: '0.85rem', color: '#16a34a', margin: '4px 0 0', fontWeight: 600 }}>Your notes are ready to practice!</p>
            )}
          </div>
        ) : (
          <div>
            <p style={{ fontWeight: 800, fontSize: '1.25rem', color: '#0f172a', margin: '0 0 8px', letterSpacing: '-0.01em' }}>
              {isDragging ? 'Drop your file here' : 'Upload Study Content'}
            </p>
            <p style={{ fontSize: '0.88rem', color: '#9ca3af', margin: '0 0 28px', lineHeight: 1.5 }}>
              PDF, TXT, or image — max 10 MB<br />
              <span style={{ fontSize: '0.8rem' }}>Drag & drop or click to browse</span>
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 32px', borderRadius: 14,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              color: '#fff', fontWeight: 700, fontSize: '0.92rem',
              boxShadow: '0 6px 20px rgba(99,102,241,0.35)',
              pointerEvents: 'none',
              letterSpacing: '0.01em',
            }}>
              <SparkleIcon /> Choose File
            </div>
          </div>
        )}
      </div>

      {error && (
        <div style={{
          marginTop: 14, padding: '12px 18px',
          background: '#fef2f2', border: '1px solid #fca5a5',
          borderRadius: 12, fontSize: '0.85rem', color: '#dc2626', fontWeight: 600,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   My Notes Screen (full-screen overlay)
═══════════════════════════════════════════════════════════════════ */
function NotesScreen({ documents, loadingDocs, onRefresh, onDelete, onSelect, onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'linear-gradient(160deg, #f0f4ff 0%, #f8faff 40%, #eef2fb 100%)',
      display: 'flex', flexDirection: 'column',
      animation: 'notes-slidein 0.3s cubic-bezier(0.4,0,0.2,1) forwards',
    }}>
      <style>{`
        @keyframes notes-slidein { from { opacity:0; transform:translateY(24px); } to { opacity:1; transform:translateY(0); } }
        @keyframes rag-spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
        .note-card-item { transition: all 0.18s ease; }
        .note-card-item:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(99,102,241,0.12) !important; border-color: rgba(99,102,241,0.35) !important; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '20px 32px',
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(99,102,241,0.1)',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '9px 18px', borderRadius: 12,
            border: '1.5px solid #e2e8f0',
            background: '#fff', color: '#374151',
            fontWeight: 700, fontSize: '0.85rem',
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = 'rgba(99,102,241,0.04)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.background = '#fff'; }}
        >
          <ArrowLeftIcon /> Back
        </button>

        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: '1.4rem', color: '#0f172a', letterSpacing: '-0.02em' }}>
            My Notes
          </h1>
          <p style={{ margin: '2px 0 0', fontSize: '0.82rem', color: '#9ca3af' }}>
            {documents.length} note{documents.length !== 1 ? 's' : ''} indexed and ready for practice
          </p>
        </div>

        <button
          onClick={onRefresh}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 12,
            border: '1.5px solid rgba(99,102,241,0.2)',
            background: 'rgba(99,102,241,0.06)', color: '#6366f1',
            fontWeight: 700, fontSize: '0.82rem',
            cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.12)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.06)'; }}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
        {loadingDocs ? (
          <div style={{ textAlign: 'center', paddingTop: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              border: '3px solid rgba(99,102,241,0.15)',
              borderTopColor: '#6366f1',
              animation: 'rag-spin 0.8s linear infinite',
            }} />
            <span style={{ fontSize: '0.9rem', color: '#9ca3af', fontWeight: 600 }}>Loading your notes…</span>
          </div>
        ) : documents.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 100 }}>
            <p style={{ fontWeight: 700, fontSize: '1.1rem', color: '#374151', margin: '0 0 8px' }}>No notes yet</p>
            <p style={{ fontSize: '0.88rem', color: '#9ca3af' }}>Upload a document to get started</p>
            <button
              onClick={onClose}
              style={{
                marginTop: 24, padding: '11px 28px', borderRadius: 12,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', color: '#fff', fontWeight: 700,
                fontSize: '0.88rem', cursor: 'pointer', fontFamily: 'inherit',
                boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
              }}
            >
              Upload a Note
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 18,
            maxWidth: 1200,
            margin: '0 auto',
          }}>
            {documents.map((doc, idx) => (
              <NoteCard
                key={doc._id}
                doc={doc}
                onSelect={() => { onSelect(doc); onClose(); }}
                onDelete={onDelete}
                idx={idx}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Individual Note Card in overlay ── */
function NoteCard({ doc, onSelect, onDelete, idx }) {
  const ext = doc.filename?.split('.').pop()?.toUpperCase() || 'FILE';
  const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#3b82f6'];
  const color  = colors[idx % colors.length];
  const isIndexing = !doc.indexed || doc.chunkCount === 0;

  return (
    <div
      className="note-card-item"
      style={{
        background: '#fff',
        borderRadius: 18,
        border: `1.5px solid ${isIndexing ? 'rgba(99,102,241,0.2)' : '#e8ecf5'}`,
        padding: '20px',
        boxShadow: '0 2px 12px rgba(99,102,241,0.06)',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14, flexShrink: 0,
          background: `linear-gradient(135deg, ${color}22, ${color}44)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color,
        }}>
          <FileIcon size={22} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontWeight: 700, fontSize: '0.88rem', color: '#0f172a',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {doc.filename}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 6,
              background: `${color}18`, color,
              fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.04em',
            }}>
              {ext}
            </span>
            {isIndexing ? (
              <span style={{
                fontSize: '0.72rem', color: '#6366f1', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <span style={{
                  display: 'inline-block', width: 7, height: 7, borderRadius: '50%',
                  border: '2px solid rgba(99,102,241,0.3)', borderTopColor: '#6366f1',
                  animation: 'rag-spin 0.8s linear infinite',
                }} />
                Indexing…
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {doc.chunkCount} chunks
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          {new Date(doc.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onDelete(doc._id)}
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: '#d1d5db', padding: '6px 8px', borderRadius: 8,
              lineHeight: 0, transition: 'all 0.15s', fontFamily: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = '#fef2f2'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#d1d5db'; e.currentTarget.style.background = 'transparent'; }}
            title="Delete note"
          >
            <TrashIcon />
          </button>
        </div>
      </div>

      {/* Practice button */}
      <button
        onClick={onSelect}
        style={{
          width: '100%', padding: '10px', borderRadius: 12,
          background: isIndexing
            ? 'linear-gradient(135deg, #e2e8f0, #cbd5e1)'
            : `linear-gradient(135deg, ${color}, ${color}cc)`,
          border: 'none', color: isIndexing ? '#94a3b8' : '#fff',
          fontWeight: 700, fontSize: '0.85rem',
          cursor: isIndexing ? 'default' : 'pointer', fontFamily: 'inherit',
          boxShadow: isIndexing ? 'none' : `0 4px 14px ${color}40`,
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => { if (!isIndexing) e.currentTarget.style.opacity = '0.88'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
      >
        {isIndexing ? 'Indexing in background…' : 'Practice with this Note →'}
      </button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════════════════════ */
export default function RagStudyPage() {
  const { user } = useAuth();
  const userId   = user?.uid || user?.id || 'anonymous';

  const [documents,      setDocuments]      = useState([]);
  const [activeDocId,    setActiveDocId]    = useState(null);
  const [activeDocName,  setActiveDocName]  = useState('');
  const [chunkCount,     setChunkCount]     = useState(0);
  const [conceptInput,   setConceptInput]   = useState('');
  const [activeConcept,  setActiveConcept]  = useState(null);
  const [showBloom,      setShowBloom]      = useState(false);
  const [loadingDocs,    setLoadingDocs]    = useState(false);
  const [showNotes,      setShowNotes]      = useState(false);
  const [extractPreview, setExtractPreview] = useState('');

  /* ── Load existing documents (source of truth = MongoDB) ── */
  const loadDocuments = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const r = await fetch(`${API}/api/rag/documents?userId=${userId}`);
      const j = await r.json();
      if (j.success) setDocuments(j.documents); // MongoDB is authoritative
    } catch (err) { console.error('loadDocuments:', err); }
    finally { setLoadingDocs(false); }
  }, [userId]);

  // Load on first mount
  useEffect(() => { loadDocuments(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Handle upload success ──
   *  /api/rag/register already saved this doc to MongoDB before onUploaded
   *  was called, so loadDocuments() will return ALL docs including this new one.
   *  We DON'T fiddle with local state — just refresh from the source of truth.
   */
  const handleUploaded = useCallback((result) => {
    const { rag, extraction } = result;
    if (rag?.documentId) {
      setActiveDocId(rag.documentId);
      setActiveDocName(result.file.originalName);
      setChunkCount(rag.chunkCount);
      setExtractPreview(extraction?.extractedText?.slice(0, 300) || '');
      // Small delay to let MongoDB finish the write, then fetch authoritative list
      setTimeout(() => loadDocuments(), 300);
    }
  }, [loadDocuments]);


  /* ── Select a document ── */
  const selectDoc = (doc) => {
    setActiveDocId(doc._id);
    setActiveDocName(doc.filename);
    setChunkCount(doc.chunkCount);
    setExtractPreview('');
    setShowBloom(false);
    setActiveConcept(null);
  };

  /* ── Delete a document ── */
  const deleteDoc = async (docId) => {
    try {
      await fetch(`${API}/api/rag/documents/${docId}?userId=${userId}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => d._id !== docId));
      if (activeDocId === docId) {
        setActiveDocId(null); setActiveDocName(''); setChunkCount(0);
        setShowBloom(false); setActiveConcept(null);
      }
    } catch (err) { console.error('deleteDoc:', err); }
  };

  /* ── Start practice ── */
  const startPractice = () => {
    const concept = conceptInput.trim();
    if (!concept) return;
    setActiveConcept(concept);
    setShowBloom(true);
  };

  /* ── Open notes panel (docs already tracked locally; do a silent background refresh) ── */
  const openNotes = () => {
    setShowNotes(true);
    // Silent background refresh — merges with local state, won't remove any locally-added docs
    loadDocuments();
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f0f4ff 0%, #f8faff 40%, #eef2fb 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @keyframes rag-spin    { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes rag-pulse   { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes rag-fadein  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .rag-fadein { animation: rag-fadein 0.35s ease-out forwards; }
        .rag-concept-input::placeholder { color: #9ca3af; }
        .rag-concept-input:focus { outline: none; border-color: #6366f1 !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important; }
        .my-notes-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 28px rgba(99,102,241,0.28) !important; }
        .rag-bottom-bar { left: 220px; }
        @media (max-width: 1024px) { .rag-bottom-bar { left: 64px; } }
        @media (max-width: 768px)  { .rag-bottom-bar { left: 0; } }
      `}</style>

      {/* ── Main Scrollable Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '40px 32px 120px' }}>

        {/* ── Upload Section (Full width, centered) ── */}
        <div style={{ maxWidth: 720, margin: '0 auto 40px' }}>
          {/* Section header */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 18px', borderRadius: 999,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1))',
              border: '1px solid rgba(99,102,241,0.2)',
              marginBottom: 14,
            }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#6366f1', letterSpacing: '0.04em' }}>
                UPLOAD NOTES
              </span>
            </div>
            <h2 style={{
              margin: '0 0 8px', fontWeight: 800, fontSize: '1.75rem',
              color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.2,
            }}>
              Power your AI study assistant
            </h2>
            <p style={{ margin: 0, fontSize: '0.92rem', color: '#6b7280', lineHeight: 1.6 }}>
              Upload PDFs, images, or text files — Ollama will read your content<br />
              and generate targeted practice questions just for you.
            </p>
          </div>

          {/* Upload Zone Card */}
          <div style={{
            background: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            borderRadius: 24,
            padding: '28px',
            boxShadow: '0 4px 32px rgba(99,102,241,0.08), 0 1px 0 rgba(255,255,255,0.8) inset',
            border: '1px solid rgba(255,255,255,0.9)',
          }}>
            <UploadZone onUploaded={handleUploaded} userId={userId} />
          </div>
        </div>

        {/* ── Active Doc + Practice Area ── */}
        {activeDocId && (
          <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }} className="rag-fadein">

            {/* Active document banner */}
            <div style={{
              padding: '18px 22px', borderRadius: 20,
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(12px)',
              border: '1.5px solid rgba(99,102,241,0.15)',
              boxShadow: '0 4px 20px rgba(99,102,241,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
                  boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
                }}>
                  <FileIcon />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem', color: '#0f172a',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeDocName}
                  </p>
                  <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: '#9ca3af' }}>
                    {chunkCount} chunks indexed · Ollama will use this content
                  </p>
                </div>
                <span style={{
                  padding: '5px 12px', borderRadius: 999,
                  background: 'rgba(34,197,94,0.1)', color: '#16a34a',
                  fontSize: '0.73rem', fontWeight: 700, letterSpacing: '0.04em',
                  border: '1px solid rgba(34,197,94,0.2)',
                }}>
                  ● RAG Active
                </span>
              </div>
            </div>

            {/* Content preview */}
            {extractPreview && (
              <div style={{
                padding: '16px 20px', borderRadius: 16,
                background: 'rgba(255,255,255,0.7)',
                border: '1px solid rgba(99,102,241,0.1)',
              }}>
                <p style={{ fontSize: '0.7rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8, margin: '0 0 8px' }}>
                  Content Preview
                </p>
                <p style={{ fontSize: '0.83rem', color: '#374151', lineHeight: 1.6, margin: 0,
                  overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                  {extractPreview}…
                </p>
              </div>
            )}

            {/* Concept input */}
            <div style={{
              padding: '24px', borderRadius: 20,
              background: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(99,102,241,0.1)',
              boxShadow: '0 4px 20px rgba(99,102,241,0.06)',
            }}>
              <p style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', margin: '0 0 4px' }}>
                What concept do you want to practice?
              </p>
              <p style={{ fontSize: '0.83rem', color: '#6b7280', margin: '0 0 18px', lineHeight: 1.5 }}>
                Enter a topic from your document. Ollama will retrieve the most
                relevant chunks and generate targeted questions.
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  className="t-input rag-concept-input"
                  type="text"
                  value={conceptInput}
                  onChange={e => { setConceptInput(e.target.value); setShowBloom(false); setActiveConcept(null); }}
                  onKeyDown={e => e.key === 'Enter' && startPractice()}
                  placeholder="e.g. Photosynthesis, Binary Trees, Recursion…"
                  style={{ flex: 1 }}
                />
                <button
                  onClick={startPractice}
                  disabled={!conceptInput.trim()}
                  className="t-btn t-btn-primary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Start Practice →
                </button>
              </div>

              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>Try:</span>
                {['Introduction', 'Key Concepts', 'Applications', 'Summary'].map(chip => (
                  <button
                    key={chip}
                    onClick={() => { setConceptInput(chip); setShowBloom(false); setActiveConcept(null); }}
                    style={{
                      padding: '4px 12px', borderRadius: 999,
                      border: '1px solid #e2e8f0',
                      background: 'transparent', color: '#6b7280',
                      fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                      transition: 'all 0.15s', fontFamily: 'inherit',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#6366f1'; e.currentTarget.style.background = 'rgba(99,102,241,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.background = 'transparent'; }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Bloom panel */}
            {showBloom && activeConcept && (
              <div className="t-card rag-fadein" style={{ padding: 0, overflow: 'hidden', borderRadius: 20 }}>
                <div style={{
                  padding: '10px 20px',
                  background: 'linear-gradient(90deg, rgba(99,102,241,0.06), rgba(99,102,241,0.02))',
                  borderBottom: '1px solid rgba(99,102,241,0.1)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%', background: '#22c55e',
                    animation: 'rag-pulse 2s ease-in-out infinite',
                  }} />
                  <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600 }}>
                    RAG-grounded · Ollama is reading chunks from{' '}
                    <strong style={{ color: '#374151' }}>{activeDocName}</strong>
                  </span>
                </div>
                <BloomPanel
                  concept={activeConcept}
                  parentTopic=""
                  subtopics={[]}
                  onClose={() => { setShowBloom(false); setActiveConcept(null); }}
                  inline={true}
                  ragDocumentId={activeDocId}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── My Notes Button — pinned at bottom ── */}
      <div
        className="rag-bottom-bar"
        style={{
          position: 'fixed', bottom: 0, right: 0,
          padding: '16px 32px',
          background: 'rgba(248,250,255,0.92)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid rgba(99,102,241,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100,
        }}
      >
        <button
          onClick={openNotes}
          className="my-notes-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '13px 36px', borderRadius: 16,
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            border: 'none', color: '#fff',
            fontWeight: 700, fontSize: '0.95rem',
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(99,102,241,0.25)',
            transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
            letterSpacing: '0.01em',
          }}
        >
          <NotesIcon />
          My Notes
          {documents.length > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 22, height: 22, borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              fontSize: '0.72rem', fontWeight: 800,
            }}>
              {documents.length}
            </span>
          )}
        </button>
      </div>

      {/* ── My Notes Screen (full-screen overlay) ── */}
      {showNotes && (
        <NotesScreen
          documents={documents}
          loadingDocs={loadingDocs}
          onRefresh={loadDocuments}
          onDelete={deleteDoc}
          onSelect={selectDoc}
          onClose={() => setShowNotes(false)}
        />
      )}
    </div>
  );
}
