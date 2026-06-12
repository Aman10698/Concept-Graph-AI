import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FileUpload from '../components/FileUpload'
import { extractTextFromFile } from '../services/textExtractionService'
import { useTopicExtraction } from '../hooks/useTopicExtraction'
import { useAuth } from '../context/AuthContext'
import { createSession } from '../services/sessionService'
import { Lock } from 'lucide-react'

/* ─── strip course codes from subject names ─── */
function stripCode(s) {
  return (s || '').replace(/^[A-Z]{2,6}[-\s]?\d{3,6}\s*/i, '').replace(/[,;:]+$/, '').trim()
}

/* ═══════════════════════════════════════════════════════════
   UPLOAD PAGE — shows the file drop, processes the syllabus,
   then navigates to /practice.
═══════════════════════════════════════════════════════════ */
export default function UploadPage() {
  const navigate        = useNavigate()
  const { user }        = useAuth()
  const topicExtraction = useTopicExtraction()

  const [phase,   setPhase]   = useState('idle')   // idle | uploading | topics | done | error
  const [errMsg,  setErrMsg]  = useState('')
  const [subject, setSubject] = useState('')

  /* ── full pipeline triggered after FileUpload succeeds ── */
  const handleUploadSuccess = async (responseData) => {
    const fileInfo  = responseData.file || responseData
    const rawText   = responseData.extraction?.extractedText || ''

    // Clear stale session data
    ;['learningTopicsData', 'learningQuestionsData',
      'learningEvaluationData', 'learningDependencyData',
    ].forEach(k => localStorage.removeItem(k))

    try {
      let text = rawText

      // Fallback extraction if text not returned by upload
      if (!text || text.trim().length < 20) {
        setPhase('uploading')
        try {
          const res = await extractTextFromFile(fileInfo.filename, fileInfo.mimetype)
          text = res?.data?.text || res?.text || ''
        } catch (_) { /* ignore — try topics anyway */ }
      }

      if (!text || text.trim().length < 20) {
        setErrMsg('Could not extract text from this file. Try a different PDF or image.')
        setPhase('error')
        return
      }

      // Extract topics
      setPhase('topics')
      const topicsResult = await topicExtraction.extract(text)

      if (!topicsResult) {
        setErrMsg(topicExtraction.error || 'AI failed to extract topics. Make sure Ollama is running.')
        setPhase('error')
        return
      }

      // Sanitize subject name
      const cleaned = stripCode(topicsResult.subject)
      if (!cleaned || cleaned === 'Unknown') {
        const first = topicsResult.topics?.[0]
        topicsResult.subject = typeof first === 'string' ? first : (first?.name || 'My Course')
      } else {
        topicsResult.subject = cleaned
      }
      setSubject(topicsResult.subject)

      // Persist topics to localStorage (Practice page reads from here)
      localStorage.setItem('learningTopicsData', JSON.stringify(topicsResult))

      // Create MongoDB session
      if (user) {
        const rawName = fileInfo.originalname || fileInfo.filename || ''
        const sessionTitle = topicsResult.subject
          || rawName.replace(/\.[^.]+$/, '').replace(/-\d{10,}-\d+$/, '').replace(/[-_]/g, ' ').trim()
          || 'Uploaded Syllabus'
        try {
          await createSession(user.uid, {
            title:        sessionTitle,
            subject:      topicsResult.subject || '',
            extractedText: text,
            topicsData:   topicsResult,
          })
        } catch (_) { /* non-fatal */ }
      }

      setPhase('done')
      // Short pause so the user sees the success state, then go to practice
      setTimeout(() => navigate('/practice'), 900)

    } catch (err) {
      setErrMsg(err.message || 'Something went wrong.')
      setPhase('error')
    }
  }

  const handleUploadError = (err) => {
    setErrMsg(err?.response?.data?.message || err?.message || 'Upload failed.')
    setPhase('error')
  }

  /* ─── UI ─── */
  return (
    <div style={{ padding: '60px 28px', maxWidth: 740, margin: '0 auto', fontFamily: "'Inter', sans-serif" }}>

      {/* Page header */}
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a',
          letterSpacing: '-0.03em', marginBottom: 12 }}>
          Upload Your Syllabus
        </h1>
        <p style={{ color: '#64748b', fontSize: '0.95rem', lineHeight: 1.6, maxWidth: 540, margin: '0 auto' }}>
          Upload a PDF or image file and we'll automatically extract topics, identify key concepts, and build your personalised practice graph.
        </p>
      </div>

      {/* ── Idle / upload state ── */}
      {(phase === 'idle' || phase === 'uploading') && (
        <>
          <div style={{ 
            padding: '32px', background: '#fff', borderRadius: 20,
            boxShadow: '0 12px 40px rgba(0,0,0,0.04)', marginBottom: 32
          }}>
            <FileUpload
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#94a3b8' }}>
            <Lock size={14} />
            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Your files are secure and never shared with anyone.</span>
          </div>
        </>
      )}

      {/* ── Processing: extracting topics ── */}
      {phase === 'topics' && (
        <div className="t-card" style={{ padding: '56px 32px', textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(59,130,246,0.12))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
          }}>🧠</div>
          <div className="t-spinner" style={{ margin: '0 auto 20px' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            AI is analysing your syllabus
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.88rem' }}>
            Extracting topics, subtopics and concepts… this takes 15–60 seconds.
          </p>
        </div>
      )}

      {/* ── Done ── */}
      {phase === 'done' && (
        <div className="t-card" style={{ padding: '56px 32px', textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
            background: 'linear-gradient(135deg, #dcfce7, #bbf7d0)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem',
          }}>✅</div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            {subject ? `"${subject}" is ready!` : 'Syllabus ready!'}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.88rem' }}>
            Redirecting you to practice…
          </p>
        </div>
      )}

      {/* ── Error ── */}
      {phase === 'error' && (
        <div className="t-card" style={{ padding: '40px 32px', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%', margin: '0 auto 20px',
            background: '#fef2f2', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.8rem',
          }}>⚠️</div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>
            Something went wrong
          </h2>
          <p style={{ color: '#6b7280', fontSize: '0.88rem', marginBottom: 24 }}>
            {errMsg}
          </p>
          <button
            onClick={() => { setPhase('idle'); setErrMsg('') }}
            className="t-btn t-btn-primary t-btn-sm"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
