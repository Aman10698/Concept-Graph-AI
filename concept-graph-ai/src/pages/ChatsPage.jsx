/**
 * ChatsPage.jsx
 *
 * RAG-powered Ollama chatbot with:
 * - Markdown rendering for assistant messages (bold, italic, headers, lists, code)
 * - Inter font for premium typography
 * - Streaming SSE responses from Ollama
 * - Context strictly grounded in uploaded notes
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Folder, ChevronRight, GraduationCap, ShieldCheck, FileText, Sparkles, Send } from 'lucide-react';

const API = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

/* ─── Helpers ────────────────────────────────────────────────────── */
function formatTime(date) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function cleanFilename(name) {
  return (name || 'Document')
    .replace(/\.[a-zA-Z0-9]+$/, '')
    .replace(/-?\d{10,}-?\d*/g, '')
    .replace(/[-_]+$/, '')
    .trim() || name;
}

/* ─── Inline Markdown Parser ─────────────────────────────────────── */
function renderInline(text) {
  if (!text) return null;
  // Split on bold, italic, inline-code patterns
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: 'inherit' }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={i} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</em>;
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} style={{
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
          fontSize: '0.82em',
          background: 'rgba(99,102,241,0.1)',
          color: '#4f46e5',
          padding: '1px 5px',
          borderRadius: 4,
          border: '1px solid rgba(99,102,241,0.15)',
        }}>{part.slice(1, -1)}</code>
      );
    }
    return part;
  });
}

/* ─── Block Markdown Renderer ────────────────────────────────────── */
function MarkdownRenderer({ text, isUser }) {
  if (!text) return null;

  const textColor = isUser ? '#fff' : '#1e293b';
  const mutedColor = isUser ? 'rgba(255,255,255,0.75)' : '#64748b';
  const codeBorder = isUser ? 'rgba(255,255,255,0.2)' : 'rgba(99,102,241,0.15)';
  const listColor = isUser ? 'rgba(255,255,255,0.6)' : '#6366f1';

  // Split by fenced code blocks first
  const segments = text.split(/(```[\s\S]*?```)/g);

  const elements = [];

  segments.forEach((segment, si) => {
    if (segment.startsWith('```')) {
      // Fenced code block
      const match = segment.match(/^```([^\n]*)\n?([\s\S]*?)```$/);
      const lang = match?.[1]?.trim() || '';
      const code = match?.[2] || segment.replace(/^```[^\n]*\n?/, '').replace(/```$/, '');
      elements.push(
        <div key={`code-${si}`} style={{ margin: '10px 0' }}>
          {lang && (
            <div style={{
              background: isUser ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.08)',
              borderRadius: '8px 8px 0 0',
              padding: '4px 12px',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: listColor,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              fontFamily: "'Inter', sans-serif",
            }}>{lang}</div>
          )}
          <pre style={{
            margin: 0,
            background: isUser ? 'rgba(0,0,0,0.2)' : 'rgba(15,23,42,0.04)',
            border: `1px solid ${codeBorder}`,
            borderRadius: lang ? '0 0 8px 8px' : 8,
            padding: '12px 14px',
            overflowX: 'auto',
            fontSize: '0.82rem',
            lineHeight: 1.6,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            color: isUser ? 'rgba(255,255,255,0.9)' : '#1e293b',
            whiteSpace: 'pre',
          }}>
            <code>{code.trim()}</code>
          </pre>
        </div>
      );
      return;
    }

    // Parse line-by-line for block elements
    const lines = segment.split('\n');
    let i = 0;
    let listBuffer = [];
    let listType = null; // 'ul' or 'ol'

    const flushList = (key) => {
      if (listBuffer.length === 0) return;
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(
        <Tag key={key} style={{
          margin: '6px 0 6px 4px',
          paddingLeft: 20,
          color: textColor,
          lineHeight: 1.75,
        }}>
          {listBuffer.map((item, li) => (
            <li key={li} style={{
              marginBottom: 2,
              fontSize: '0.92rem',
              paddingLeft: 2,
            }}>
              {renderInline(item)}
            </li>
          ))}
        </Tag>
      );
      listBuffer = [];
      listType = null;
    };

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // H1
      if (/^# /.test(trimmed)) {
        flushList(`flush-before-h1-${si}-${i}`);
        elements.push(
          <h2 key={`h1-${si}-${i}`} style={{
            fontSize: '1.05rem', fontWeight: 800, color: textColor,
            margin: '14px 0 6px', letterSpacing: '-0.02em', lineHeight: 1.3,
            fontFamily: "'Inter', sans-serif",
          }}>
            {renderInline(trimmed.slice(2))}
          </h2>
        );
      }
      // H2
      else if (/^## /.test(trimmed)) {
        flushList(`flush-before-h2-${si}-${i}`);
        elements.push(
          <h3 key={`h2-${si}-${i}`} style={{
            fontSize: '0.98rem', fontWeight: 700, color: textColor,
            margin: '12px 0 5px', letterSpacing: '-0.01em', lineHeight: 1.3,
            fontFamily: "'Inter', sans-serif",
          }}>
            {renderInline(trimmed.slice(3))}
          </h3>
        );
      }
      // H3
      else if (/^### /.test(trimmed)) {
        flushList(`flush-before-h3-${si}-${i}`);
        elements.push(
          <h4 key={`h3-${si}-${i}`} style={{
            fontSize: '0.9rem', fontWeight: 700, color: mutedColor,
            margin: '10px 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em',
            fontFamily: "'Inter', sans-serif",
          }}>
            {renderInline(trimmed.slice(4))}
          </h4>
        );
      }
      // Horizontal rule
      else if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
        flushList(`flush-before-hr-${si}-${i}`);
        elements.push(
          <hr key={`hr-${si}-${i}`} style={{
            border: 'none',
            borderTop: `1px solid ${isUser ? 'rgba(255,255,255,0.2)' : 'rgba(99,102,241,0.12)'}`,
            margin: '10px 0',
          }} />
        );
      }
      // Bullet list
      else if (/^[-*•] /.test(trimmed)) {
        if (listType === 'ol') flushList(`flush-ol-${si}-${i}`);
        listType = 'ul';
        listBuffer.push(trimmed.replace(/^[-*•] /, ''));
      }
      // Ordered list
      else if (/^\d+[.)]\s/.test(trimmed)) {
        if (listType === 'ul') flushList(`flush-ul-${si}-${i}`);
        listType = 'ol';
        listBuffer.push(trimmed.replace(/^\d+[.)]\s/, ''));
      }
      // Blockquote
      else if (/^> /.test(trimmed)) {
        flushList(`flush-before-bq-${si}-${i}`);
        elements.push(
          <blockquote key={`bq-${si}-${i}`} style={{
            borderLeft: `3px solid ${isUser ? 'rgba(255,255,255,0.4)' : '#6366f1'}`,
            paddingLeft: 12,
            margin: '6px 0',
            color: mutedColor,
            fontStyle: 'italic',
            fontSize: '0.9rem',
          }}>
            {renderInline(trimmed.slice(2))}
          </blockquote>
        );
      }
      // Empty line
      else if (trimmed === '') {
        flushList(`flush-empty-${si}-${i}`);
        // Only add spacing if not at start/end
        if (i > 0 && i < lines.length - 1) {
          elements.push(<div key={`space-${si}-${i}`} style={{ height: 6 }} />);
        }
      }
      // Regular paragraph text
      else {
        flushList(`flush-before-p-${si}-${i}`);
        elements.push(
          <p key={`p-${si}-${i}`} style={{
            margin: '2px 0',
            fontSize: '0.93rem',
            lineHeight: 1.72,
            color: textColor,
            fontFamily: "'Inter', sans-serif",
          }}>
            {renderInline(trimmed)}
          </p>
        );
      }
      i++;
    }
    flushList(`flush-end-${si}`);
  });

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{elements}</div>;
}

/* ─── Icons ──────────────────────────────────────────────────────── */
const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);
const BotIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    <line x1="12" y1="15" x2="12" y2="17" />
  </svg>
);
const FileIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
  </svg>
);
const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
  </svg>
);
const CopyIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

/* ─── Typing Indicator ───────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '6px 4px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'rgba(99,102,241,0.45)',
          animation: `chatDot 1.3s ease-in-out ${i * 0.18}s infinite`,
        }} />
      ))}
    </div>
  );
}

/* ─── Message Bubble ─────────────────────────────────────────────── */
function MessageBubble({ msg, onCopy }) {
  const isUser = msg.role === 'user';
  const isError = msg.isError;
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 11,
      marginBottom: 22,
      animation: 'chatFadeIn 0.28s cubic-bezier(0.4,0,0.2,1)',
      alignItems: 'flex-start',
    }}>
      {/* Bot Avatar */}
      {!isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: 11, flexShrink: 0,
          background: isError
            ? 'linear-gradient(135deg, #fef2f2, #fee2e2)'
            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isError ? '#ef4444' : '#fff',
          boxShadow: isError ? 'none' : '0 4px 14px rgba(99,102,241,0.35)',
          marginTop: 2,
          fontSize: '0.8rem', fontWeight: 800,
        }}>
          <BotIcon />
        </div>
      )}

      <div style={{
        maxWidth: isUser ? '68%' : '76%',
        display: 'flex', flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        gap: 4,
        minWidth: 0,
      }}>
        {/* Name label */}
        <span style={{
          fontSize: '0.68rem', fontWeight: 700,
          color: isUser ? '#4f46e5' : '#9ca3af',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          fontFamily: "'Inter', sans-serif",
        }}>
          {isUser ? 'You' : 'Ollama AI'}
        </span>

        {/* Bubble */}
        <div style={{
          padding: isUser ? '11px 16px' : '14px 18px',
          borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
          background: isUser
            ? 'linear-gradient(135deg, #e0e7ff, #ede9fe)'
            : isError
              ? 'rgba(239,68,68,0.05)'
              : '#fff',
          color: isUser ? '#3730a3' : isError ? '#ef4444' : '#1e293b',
          boxShadow: isUser
            ? '0 4px 16px rgba(99,102,241,0.15), 0 1px 0 rgba(255,255,255,0.9) inset'
            : isError
              ? 'none'
              : '0 2px 12px rgba(0,0,0,0.06), 0 1px 0 rgba(99,102,241,0.04)',
          border: isUser
            ? '1.5px solid rgba(99,102,241,0.2)'
            : isError
              ? '1px solid rgba(239,68,68,0.2)'
              : '1px solid rgba(226,232,240,0.8)',
          wordBreak: 'break-word',
          fontFamily: "'Inter', 'system-ui', sans-serif",
          letterSpacing: '-0.005em',
          position: 'relative',
        }}>
          {!msg.content && !isUser
            ? <TypingIndicator />
            : isUser
              ? <p style={{
                margin: 0, fontSize: '0.93rem', lineHeight: 1.65,
                fontFamily: "'Inter', sans-serif",
                whiteSpace: 'pre-wrap',
                color: '#3730a3',
                fontWeight: 500,
              }}>{msg.content}</p>
              : <MarkdownRenderer text={msg.content} isUser={false} />
          }
        </div>

        {/* Footer row: timestamp + copy */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: '0.66rem', color: '#b0b9c9',
            fontFamily: "'Inter', sans-serif",
          }}>
            {msg.time ? formatTime(msg.time) : ''}
          </span>
          {!isUser && msg.content && (
            <button
              onClick={handleCopy}
              title="Copy response"
              style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: 'none', border: 'none', cursor: 'pointer',
                color: copied ? '#22c55e' : '#b0b9c9',
                fontSize: '0.64rem', fontWeight: 600, padding: '2px 4px',
                borderRadius: 4, transition: 'color 0.15s',
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <CopyIcon />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          )}
        </div>
      </div>

      {/* User Avatar */}
      {isUser && (
        <div style={{
          width: 34, height: 34, borderRadius: 11, flexShrink: 0,
          background: 'linear-gradient(135deg, #e0e7ff, #c7d2fe)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 800, color: '#4f46e5',
          marginTop: 2, letterSpacing: '-0.02em',
          boxShadow: '0 2px 8px rgba(99,102,241,0.15)',
          fontFamily: "'Inter', sans-serif",
        }}>
          Me
        </div>
      )}
    </div>
  );
}

/* ─── Document Sidebar Item ────────────────────────────────────────────── */
function DocItem({ doc, isActive, onClick, msgCount }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        padding: '12px 14px', borderRadius: 12, marginBottom: 8,
        background: isActive ? '#f5f3ff' : 'transparent',
        transition: 'all 0.15s ease',
        display: 'flex', alignItems: 'center', gap: 12,
        borderLeft: `3px solid ${isActive ? '#7c3aed' : 'transparent'}`,
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f8fafc'; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: isActive ? '#7c3aed' : '#f1f5f9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: isActive ? '#fff' : '#94a3b8',
        transition: 'all 0.15s',
      }}>
        <FileText size={16} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontWeight: 700, fontSize: '0.85rem',
          color: isActive ? '#0f172a' : '#334155',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: "'Inter', sans-serif",
        }}>{cleanFilename(doc.filename)}</p>
        <p style={{
          margin: '2px 0 0', fontSize: '0.7rem', color: '#94a3b8',
          fontFamily: "'Inter', sans-serif",
        }}>
          {doc.chunkCount} chunks indexed
        </p>
      </div>
      {isActive && (
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#7c3aed', flexShrink: 0 }} />
      )}
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Main Page
═══════════════════════════════════════════════════════════════════ */
export default function ChatsPage() {
  const { user } = useAuth();
  const userId = user?.uid || 'anonymous';

  const [documents, setDocuments] = useState([]);
  const [activeDoc, setActiveDoc] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(true);
  // eslint-disable-next-line no-unused-vars
  const [loadingHist, setLoadingHist] = useState(false); // reserved for future skeleton loading UI
  // Track saved message counts per documentId for sidebar badges
  const [histCounts, setHistCounts] = useState({});
  const [level, setLevel] = useState('beginner');
  const [showLevelDropdown, setShowLevelDropdown] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const abortRef = useRef(null);

  /* ── Scroll to bottom on new messages ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Chat history helpers ── */
  const loadHistory = useCallback(async (doc) => {
    if (!doc?._id) return;
    setLoadingHist(true);
    try {
      const r = await fetch(`${API}/api/rag/chat-history?userId=${userId}&documentId=${doc._id}`);
      const j = await r.json();
      if (j.success) {
        setMessages(j.messages ?? []);
        setHistCounts(prev => ({ ...prev, [doc._id]: (j.messages ?? []).length }));
      }
    } catch (e) {
      console.error('loadHistory:', e);
    } finally {
      setLoadingHist(false);
    }
  }, [userId]);

  const saveHistory = useCallback(async (doc, msgs) => {
    if (!doc?._id) return;
    try {
      await fetch(`${API}/api/rag/chat-history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          documentId: doc._id,
          documentName: doc.filename,
          messages: msgs.map(m => ({ role: m.role, content: m.content, time: m.time ?? Date.now() })),
        }),
      });
      setHistCounts(prev => ({ ...prev, [doc._id]: msgs.length }));
    } catch (e) {
      console.error('saveHistory:', e);
    }
  }, [userId]);

  const deleteHistory = useCallback(async (doc) => {
    if (!doc?._id) return;
    try {
      await fetch(`${API}/api/rag/chat-history?userId=${userId}&documentId=${doc._id}`, {
        method: 'DELETE',
      });
      setHistCounts(prev => ({ ...prev, [doc._id]: 0 }));
    } catch (e) {
      console.error('deleteHistory:', e);
    }
  }, [userId]);

  /* ── Load documents on mount ── */
  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const r = await fetch(`${API}/api/rag/documents?userId=${userId}`);
      const j = await r.json();
      if (j.success) {
        setDocuments(j.documents);
        if (!activeDoc && j.documents.length > 0) {
          const first = j.documents[0];
          setActiveDoc(first);
          loadHistory(first);
        }
      }
    } catch (e) { console.error('loadDocs:', e); }
    finally { setLoadingDocs(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  /* ── Switch document → load its history ── */
  const selectDoc = (doc) => {
    if (streaming) abortRef.current?.abort();
    setActiveDoc(doc);
    setMessages([]);
    setInput('');
    loadHistory(doc);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  /* ── Send message with SSE streaming ── */
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg = { role: 'user', content: text, time: Date.now() };
    const updatedHistory = [...messages, userMsg];
    setMessages(updatedHistory);
    setInput('');
    setStreaming(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    // Placeholder for streaming response
    const assistantMsg = { role: 'assistant', content: '', time: Date.now() };
    setMessages(prev => [...prev, assistantMsg]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API}/api/rag/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          userId,
          documentId: activeDoc?._id || null,
          messages: updatedHistory.map(m => ({ role: m.role, content: m.content })),
          level,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'assistant', content: `Error: ${errText}`, time: Date.now(), isError: true };
          return copy;
        });
        setStreaming(false);
        return;
      }

      // Read SSE stream token by token
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const json = JSON.parse(line.slice(6));
            if (json.token) {
              setMessages(prev => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = { ...last, content: last.content + json.token };
                return copy;
              });
            }
            if (json.done) {
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = { ...copy[copy.length - 1], time: Date.now() };
                // Save history once stream is fully done
                saveHistory(activeDoc, copy);
                return copy;
              });
            }
            if (json.error) {
              setMessages(prev => {
                const copy = [...prev];
                copy[copy.length - 1] = {
                  role: 'assistant',
                  content: `Error: ${json.error}`,
                  time: Date.now(),
                  isError: true,
                };
                return copy;
              });
            }
          } catch (_) { }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setMessages(prev => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: 'assistant',
            content: 'Could not reach the backend. Make sure the server is running.',
            time: Date.now(),
            isError: true,
          };
          return copy;
        });
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, messages, streaming, userId, activeDoc, saveHistory]);

  /* ── Keyboard shortcut ── */
  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  /* ── Clear conversation + delete from DB ── */
  const clearChat = () => {
    if (streaming) abortRef.current?.abort();
    setMessages([]);
    deleteHistory(activeDoc);
  };

  const SIDEBAR_W = 268;

  /* ── Starter suggestions ── */
  const STARTERS = [
    'Summarise this document',
    'What are the key concepts?',
    'Explain the main topics',
    'What should I study first?',
    'List all important definitions',
    'What topics are covered?',
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes chatFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chatDot {
          0%,80%,100% { transform: scale(0.85); opacity: 0.35; }
          40%          { transform: scale(1.2);  opacity: 1; }
        }
        @keyframes chatSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.3); }
          50%      { box-shadow: 0 0 0 6px rgba(99,102,241,0); }
        }

        .chat-input { font-family: 'Inter', 'system-ui', sans-serif !important; }
        .chat-input:focus  { outline: none; }
        .chat-input::placeholder { color: #b0b9c9; font-family: 'Inter', sans-serif; }

        .chat-scroll { scrollbar-width: thin; scrollbar-color: rgba(99,102,241,0.12) transparent; }
        .chat-scroll::-webkit-scrollbar       { width: 4px; }
        .chat-scroll::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.18); border-radius: 999px; }

        .doc-item-btn:hover { background: rgba(99,102,241,0.05) !important; }

        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
          box-shadow: 0 6px 20px rgba(99,102,241,0.5) !important;
        }
        .send-btn:active:not(:disabled) { transform: scale(0.96); }
        .send-btn { transition: all 0.18s ease !important; }

        .starter-chip:hover {
          background: rgba(99,102,241,0.1) !important;
          border-color: #6366f1 !important;
          color: #4f46e5 !important;
          transform: translateY(-1px);
        }
        .starter-chip { transition: all 0.15s ease !important; }
      `}</style>

      <div style={{
        display: 'grid',
        gridTemplateColumns: `${SIDEBAR_W}px 1fr`,
        height: 'calc(100vh - 72px)',
        background: '#f0f4ff',
        overflow: 'hidden',
        fontFamily: "'Inter', 'system-ui', sans-serif",
      }}>

        {/* ════ LEFT SIDEBAR ════ */}
        <div style={{
          background: '#fff',
          borderRight: '1px solid #f1f5f9',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '2px 0 12px rgba(0,0,0,0.02)',
        }}>
          {/* Header */}
          <div style={{ padding: '24px 20px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: '#f4f0ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Folder size={18} color="#7c3aed" />
                </div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem', color: '#0f172a', fontFamily: "'Inter', sans-serif", letterSpacing: '-0.02em' }}>
                  My Notes
                </p>
              </div>
              <Link
                to="/rag-study"
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: 8,
                  background: '#f4f0ff', color: '#7c3aed',
                  fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none',
                  transition: 'all 0.15s', fontFamily: "'Inter', sans-serif",
                }}
                title="Upload new document"
              >
                <PlusIcon /> Add
              </Link>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#94a3b8', fontFamily: "'Inter', sans-serif", paddingLeft: 4 }}>
              Select a note to chat about
            </p>
          </div>

          {/* Doc list */}
          <div className="chat-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0 12px' }}>
            {loadingDocs ? (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <div style={{
                  width: 24, height: 24,
                  border: '2.5px solid rgba(99,102,241,0.15)',
                  borderTopColor: '#6366f1', borderRadius: '50%',
                  animation: 'chatSpin 0.7s linear infinite', margin: '0 auto 10px',
                }} />
                <p style={{ fontSize: '0.72rem', color: '#b0b9c9', margin: 0, fontFamily: "'Inter', sans-serif" }}>
                  Loading notes…
                </p>
              </div>
            ) : documents.length === 0 ? (
              <div style={{ padding: '40px 14px', textAlign: 'center' }}>
                <p style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 700, marginBottom: 5, fontFamily: "'Inter', sans-serif" }}>
                  No notes yet
                </p>
                <p style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: 16, fontFamily: "'Inter', sans-serif", lineHeight: 1.5 }}>
                  Upload your study notes on the RAG Study page first
                </p>
                <Link
                  to="/rag-study"
                  style={{
                    display: 'inline-block', padding: '8px 16px', borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none',
                    boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  Upload Notes →
                </Link>
              </div>
            ) : (
              documents.map(doc => (
                <DocItem
                  key={doc._id}
                  doc={doc}
                  isActive={activeDoc?._id === doc._id}
                  onClick={() => selectDoc(doc)}
                  msgCount={histCounts[doc._id] ?? 0}
                />
              ))
            )}
          </div>


        </div>

        {/* ════ CHAT PANEL ════ */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff' }}>



          {/* ── Messages ── */}
          <div
            className="chat-scroll"
            style={{
              flex: 1, overflowY: 'auto',
              padding: '32px 36px 24px',
              background: '#fafbff',
            }}
          >
            {/* Empty state */}
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 60, animation: 'chatFadeIn 0.4s ease-out' }}>
                
                <div style={{ position: 'relative', display: 'inline-block', marginBottom: 28 }}>
                  <div style={{
                    position: 'absolute', inset: -20, background: 'radial-gradient(circle, #f4f0ff 0%, transparent 70%)', zIndex: 0,
                  }} />
                  <div style={{
                    width: 88, height: 88, borderRadius: 24,
                    background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 12px 40px rgba(124,58,237,0.1)',
                    position: 'relative', zIndex: 1,
                  }}>
                    <FileText size={36} color="#7c3aed" />
                  </div>
                  <Sparkles size={16} color="#c4b5fd" style={{ position: 'absolute', top: -10, right: -10, zIndex: 1 }} />
                  <Sparkles size={12} color="#c4b5fd" style={{ position: 'absolute', bottom: 10, left: -20, zIndex: 1 }} />
                </div>

                <h2 style={{
                  fontSize: '1.6rem', fontWeight: 900, color: '#0f172a', marginBottom: 16,
                  fontFamily: "'Inter', sans-serif", letterSpacing: '-0.03em',
                }}>
                  {activeDoc
                    ? `Chat with "${cleanFilename(activeDoc.filename)}"`
                    : 'Select a note to start'
                  }
                </h2>
                <p style={{
                  fontSize: '1rem', color: '#64748b',
                  maxWidth: 500, margin: '0 auto 48px', lineHeight: 1.6,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  {activeDoc
                    ? 'Ollama will retrieve the most relevant parts of your notes and answer strictly based on that content.'
                    : 'Pick one of your indexed notes from the left sidebar to begin.'}
                </p>

                {/* Starter suggestions */}
                {activeDoc && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 800, margin: '0 auto' }}>
                    {STARTERS.map((q, i) => {
                      const icons = [<FileText/>, <Sparkles/>, <FileText/>, <FileText/>, <FileText/>, <FileText/>];
                      return (
                        <button
                          key={q}
                          className="starter-chip"
                          onClick={() => { setInput(q); inputRef.current?.focus(); }}
                          style={{
                            padding: '20px', borderRadius: 16,
                            border: '1px solid #f1f5f9',
                            background: '#fff', color: '#1e293b',
                            fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
                            fontFamily: "'Inter', sans-serif",
                            boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                            textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16,
                          }}
                        >
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: '#f5f3ff', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            {React.cloneElement(icons[i % icons.length], { size: 18 })}
                          </div>
                          <span style={{ flex: 1, lineHeight: 1.4 }}>{q}</span>
                          <ChevronRight size={18} color="#94a3b8" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Message list */}
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} />
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Input bar ── */}
          <div style={{
            padding: '24px 40px 32px',
            background: '#fafbff',
            flexShrink: 0,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              background: '#fff',
              border: '1px solid #f1f5f9',
              borderRadius: 24, padding: '8px 10px',
              transition: 'all 0.2s ease',
              boxShadow: streaming ? '0 4px 16px rgba(124,58,237,0.08)' : '0 8px 24px rgba(0,0,0,0.04)',
              maxWidth: 900, margin: '0 auto',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: '#f8fafc', border: '1px solid #f1f5f9',
                borderRadius: 14, padding: '8px 12px',
                marginRight: 12,
              }}>
                <GraduationCap size={16} color="#7c3aed" />
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => {
                      if (!streaming && activeDoc) setShowLevelDropdown(!showLevelDropdown);
                    }}
                    disabled={streaming || !activeDoc}
                    style={{
                      border: 'none', background: 'transparent',
                      fontSize: '0.85rem', fontWeight: 600, fontFamily: "'Inter', sans-serif",
                      color: '#334155', display: 'flex', alignItems: 'center', gap: 6,
                      cursor: (!activeDoc || streaming) ? 'not-allowed' : 'pointer',
                      padding: 0, outline: 'none',
                    }}
                  >
                    <span style={{ textTransform: 'capitalize' }}>{level}</span>
                    <ChevronRight size={14} color="#64748b" style={{ transform: showLevelDropdown ? 'rotate(-90deg)' : 'rotate(90deg)', transition: 'transform 0.2s' }} />
                  </button>
                  
                  {showLevelDropdown && (
                    <div style={{
                      position: 'absolute', bottom: 'calc(100% + 20px)', left: -20,
                      background: '#fff', borderRadius: 12, padding: 6,
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
                      border: '1px solid #f1f5f9', zIndex: 50, minWidth: 120,
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}>
                      {['beginner', 'medium', 'advanced'].map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => { setLevel(lvl); setShowLevelDropdown(false); }}
                          style={{
                            padding: '8px 12px', border: 'none', borderRadius: 8,
                            background: level === lvl ? '#f5f3ff' : 'transparent',
                            color: level === lvl ? '#7c3aed' : '#475569',
                            fontSize: '0.85rem', fontWeight: level === lvl ? 700 : 500,
                            textAlign: 'left', cursor: 'pointer', fontFamily: "'Inter', sans-serif",
                            textTransform: 'capitalize', transition: 'all 0.15s',
                          }}
                          onMouseEnter={e => { if (level !== lvl) e.currentTarget.style.background = '#f8fafc'; }}
                          onMouseLeave={e => { if (level !== lvl) e.currentTarget.style.background = 'transparent'; }}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ width: 1, height: 24, background: '#e2e8f0', marginRight: 16 }} />

              <textarea
                ref={inputRef}
                className="chat-input"
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px';
                }}
                onKeyDown={onKeyDown}
                placeholder={activeDoc
                  ? `Ask anything about "${cleanFilename(activeDoc.filename)}"...`
                  : 'Select a note first...'
                }
                disabled={!activeDoc || streaming}
                style={{
                  flex: 1, resize: 'none', border: 'none', background: 'transparent',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.95rem', color: '#0f172a',
                  lineHeight: 1.55, overflowY: 'auto', minHeight: 24, maxHeight: 130,
                  padding: '4px 16px', outline: 'none', boxShadow: 'none',
                }}
              />
              <button
                className="send-btn"
                onClick={sendMessage}
                disabled={!input.trim() || !activeDoc || streaming}
                style={{
                  width: 44, height: 44, borderRadius: 14, border: 'none',
                  background: (!input.trim() || !activeDoc || streaming)
                    ? '#e2e8f0'
                    : '#a78bfa',
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: (!input.trim() || !activeDoc || streaming) ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  transition: 'all 0.2s',
                }}
              >
                {streaming
                  ? <div style={{
                    width: 16, height: 16,
                    border: '2.5px solid rgba(255,255,255,0.4)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'chatSpin 0.65s linear infinite',
                  }} />
                  : <Send size={18} />
                }
              </button>
            </div>
            
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              marginTop: 16, color: '#94a3b8', fontSize: '0.75rem', fontFamily: "'Inter', sans-serif", fontWeight: 500
            }}>
              <ShieldCheck size={14} />
              <span>Grounded answers • Llama 3.1 • Local processing • Your data stays private</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
