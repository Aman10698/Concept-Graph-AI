import React, { useEffect, useState } from 'react';
import QuizMindMap from './QuizMindMap';

/**
 * MindMapViewer — wraps QuizMindMap with the same beautiful canvas
 * circular layout used on the Practice page.
 */
const MindMapViewer = ({ topics = [], subject = '', evaluationData = {}, onTopicClick, revision = 0 }) => {
  const [ready, setReady] = useState(false);

  // Small delay so the parent container has painted before QuizMindMap measures its width
  useEffect(() => {
    const id = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(id);
  }, []);

  const nodeCount     = topics.length;
  const subtopicCount = topics.reduce((acc, t) => acc + (t.subtopics?.length ?? 0), 0);

  if (!topics || topics.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px', color: '#9ca3af' }}>
        <p style={{ fontWeight: 600 }}>No topics to display yet.</p>
        <p style={{ fontSize: '0.85rem', marginTop: 6 }}>Upload and process a syllabus to generate your concept map.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* ── Quick stats strip ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {[
          { label: 'Topics',    value: nodeCount,     color: '#6366f1' },
          { label: 'Subtopics', value: subtopicCount, color: '#22c55e' },
          { label: 'Nodes',     value: nodeCount + subtopicCount + 1, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} style={{
            padding: '7px 16px', borderRadius: 999,
            background: `${s.color}12`, border: `1.5px solid ${s.color}33`,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ fontWeight: 800, fontSize: '1.05rem', color: s.color }}>{s.value}</span>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: s.color }}>{s.label}</span>
          </div>
        ))}
        <div style={{
          marginLeft: 'auto', padding: '7px 14px', borderRadius: 999,
          background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
          fontSize: '0.75rem', color: '#6b7280', alignSelf: 'center',
        }}>
          Click a node to quiz that topic
        </div>
      </div>

      {/* ── Canvas mind map ── */}
      {ready && (
        <QuizMindMap
          topics={topics}
          evalData={evaluationData}
          courseTitle={subject || 'Concept Map'}
          revision={revision}
          onSelectTopic={name => onTopicClick?.(name)}
          onSelectSubtopic={(name, parent) => onTopicClick?.(name, parent)}
          onCardClick={(name) => onTopicClick?.(name)}
        />
      )}

      {/* ── Legend ── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', paddingTop: 4 }}>
        {[
          { color: '#6366f1', label: 'Centre / Subject' },
          { color: '#818cf8', label: 'Topic' },
          { color: '#a5b4fc', label: 'Subtopic' },
          { color: '#22c55e', label: 'Strong' },
          { color: '#f59e0b', label: 'Partial' },
          { color: '#ef4444', label: 'Needs Work' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />
            <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MindMapViewer;
