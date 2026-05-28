import React, { useEffect, useState } from 'react';

/* ─────────────────────────────────────────────────────────────
   STREAK PERSISTENCE HELPERS
   We store an array of ISO date strings (YYYY-MM-DD) in
   localStorage key "activityLog" — one entry per active day.
   ───────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'activityLog';

function todayStr() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function dateStr(d) {
  return d.toISOString().slice(0, 10);
}

/** Load the set of days the user was active */
function loadActivityLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

/** Record today as an active day */
function recordToday() {
  const log = loadActivityLog();
  log.add(todayStr());
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...log]));
  return log;
}

/** Compute current streak from an activity log set */
function computeStreak(log) {
  let streak = 0;
  const d = new Date();
  // Allow today OR yesterday as the "most recent" day
  // (so streak doesn't break early in the day before user logs in)
  const today = dateStr(d);
  d.setDate(d.getDate() - 1);
  const yesterday = dateStr(d);

  // Start from today; if today not in log, try yesterday
  let cur = new Date();
  if (!log.has(today)) {
    if (!log.has(yesterday)) return 0; // streak broke
    cur = new Date(); cur.setDate(cur.getDate() - 1);
  }

  // Walk backwards counting consecutive days
  while (true) {
    const s = dateStr(cur);
    if (!log.has(s)) break;
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

/* ─────────────────────────────────────────────────────────────
   Build a 21-day calendar grid (3 weeks ending today)
   Returns array of { dateStr, type } where type is:
     'today'     — today
     'active'    — past day with activity
     'streak'    — consecutive streak day
     'missed'    — past day without activity
     'future'    — future day (shouldn't appear in 3 weeks back)
   ───────────────────────────────────────────────────────────── */
function buildCalendar(log) {
  const cells = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from 20 days ago, show 21 days total
  for (let i = 20; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const s = dateStr(d);
    const isToday = i === 0;
    let type;
    if (isToday) {
      type = 'today';
    } else if (log.has(s)) {
      type = 'active';
    } else {
      type = 'missed';
    }
    cells.push({ dateStr: s, type, dayOfWeek: d.getDay() }); // 0=Sun
  }
  return cells;
}

/* ─────────────────────────────────────────────────────────────
   SUB-COMPONENTS
   ───────────────────────────────────────────────────────────── */

function MissionItem({ label, current, target, done }) {
  return (
    <div className="kg-mission-item">
      <div className={`kg-mission-check${done ? ' done' : ''}`}>
        {done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="3" strokeLinecap="round">
            <polyline points="20,6 9,17 4,12" />
          </svg>
        )}
      </div>
      <span className={`kg-mission-label${done ? ' done' : ''}`}>{label}</span>
      <span className={`kg-mission-progress${done ? ' done' : ''}`}>
        {current}/{target}
      </span>
    </div>
  );
}

/* Calendar cell */
function CalCell({ type }) {
  const base = {
    width: 26, height: 26, borderRadius: 6,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.7rem', fontWeight: 600, transition: 'all 0.15s',
  };

  if (type === 'today') return (
    <div style={{ ...base, background: '#f5f3ff', border: '2px solid #7c3aed', color: '#7c3aed' }}>
      🔥
    </div>
  );
  if (type === 'active') return (
    <div style={{ ...base, background: '#ede9fe', color: '#7c3aed' }}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke="#7c3aed" strokeWidth="3" strokeLinecap="round">
        <polyline points="20,6 9,17 4,12" />
      </svg>
    </div>
  );
  // missed
  return (
    <div style={{ ...base, background: '#f4f4f6', border: '1px solid #ebebf0' }} />
  );
}

/* ─────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ───────────────────────────────────────────────────────────── */
export default function StreakPanel({ evalData = {}, topicsData = null }) {
  const [streak,    setStreak]    = useState(0);
  const [calendar,  setCalendar]  = useState([]);
  const [log,       setLog]       = useState(new Set());

  // Record today on mount and compute streak
  useEffect(() => {
    const updatedLog = recordToday();
    setLog(updatedLog);
    setStreak(computeStreak(updatedLog));
    setCalendar(buildCalendar(updatedLog));
  }, []);

  // Missions based on real data
  const ratings   = Object.values(evalData);
  const strong    = ratings.filter(r => r.rating === 'strong').length;
  const weak      = ratings.filter(r => r.rating === 'weak').length;
  const answered  = ratings.length;
  const answeredQ = parseInt(localStorage.getItem('answeredQuestionsCount') || '0', 10);

  const missions = [
    { label: 'Solve 3 Practice Questions', current: Math.min(answeredQ, 3), target: 3, done: answeredQ >= 3 },
    { label: 'Review 1 Weak Concept',      current: Math.min(weak, 1),      target: 1, done: weak >= 1      },
    { label: 'Complete 1 Quiz',            current: answered > 0 ? 1 : 0,   target: 1, done: answered > 0   },
    { label: 'Reach Strong in a Concept',  current: strong > 0 ? 1 : 0,     target: 1, done: strong > 0     },
  ];

  const missionsDone = missions.filter(m => m.done).length;
  const pct = Math.round((missionsDone / missions.length) * 100);

  // Day-of-week header — start Monday
  const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  // How many cells to prepend to align to Monday
  // calendar[0].dayOfWeek: 0=Sun, so Monday=1
  const firstDow = calendar[0]?.dayOfWeek ?? 1; // 0=Sun
  // Convert to Mon-based: Mon=0 ... Sun=6
  const offset = (firstDow + 6) % 7; // e.g. Mon→0, Tue→1, Sun→6

  // Total active days this month
  const thisMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM'
  const activeDaysThisMonth = [...log].filter(d => d.startsWith(thisMonth)).length;

  return (
    <div className="kg-right">

      {/* ── Today's Streak ── */}
      <div className="kg-streak-card">
        <div className="kg-streak-header">Today's Streak</div>
        <div className="kg-streak-main">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="kg-streak-flame">🔥</span>
              <span className="kg-streak-num">{streak}</span>
              <span className="kg-streak-label">Day Streak</span>
            </div>
            <div className="kg-streak-sub" style={{ marginTop: 4 }}>
              {streak >= 7  ? 'Amazing consistency! 🏆'
              : streak >= 3 ? 'Great momentum! Keep it up 💪'
              : streak === 1 ? 'First day! Keep going 🌱'
              : 'Start your streak today!'}
            </div>
          </div>
          <div className="kg-streak-mascot">🔥</div>
        </div>

        <div className="kg-streak-progress">
          <div className="kg-streak-bar-bg">
            <div className="kg-streak-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="kg-streak-tasks">{missionsDone} / {missions.length} missions done today</span>
        </div>
        <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: 4, textAlign: 'right' }}>
          {activeDaysThisMonth} active day{activeDaysThisMonth !== 1 ? 's' : ''} this month
        </div>
      </div>

      {/* ── Today's Missions ── */}
      <div className="kg-missions-card">
        <div className="kg-missions-title">Today's Missions</div>
        {missions.map((m, i) => <MissionItem key={i} {...m} />)}
      </div>

      {/* ── Streak Calendar ── */}
      <div className="kg-calendar-card">
        <div className="kg-calendar-title">
          Streak Calendar
          <span style={{ fontWeight: 400, fontSize: '0.68rem', color: '#9ca3af', marginLeft: 8 }}>
            last 21 days
          </span>
        </div>

        {/* Day-of-week header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
          {DOW.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: '0.6rem', fontWeight: 700,
              color: '#b0b7c3', paddingBottom: 2 }}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid — offset to align with correct weekday */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {/* empty cells for offset */}
          {Array.from({ length: offset }).map((_, i) => (
            <div key={`empty-${i}`} style={{ width: 26, height: 26 }} />
          ))}
          {/* actual cells */}
          {calendar.map((cell, i) => (
            <CalCell key={cell.dateStr} type={cell.type} />
          ))}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
          {[
            { label: 'Active', style: { background: '#ede9fe', border: 'none' }, icon:
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round">
                <polyline points="20,6 9,17 4,12" />
              </svg>
            },
            { label: 'Today', style: { background: '#f5f3ff', border: '2px solid #7c3aed' }, icon: '🔥' },
            { label: 'Missed', style: { background: '#f4f4f6', border: '1px solid #ebebf0' }, icon: null },
          ].map(({ label, style, icon }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.65rem', color: '#6b7280' }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '0.55rem', ...style }}>
                {icon}
              </div>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Streak Shield ── */}
      <div className="kg-shield-card">
        <div className="kg-shield-icon">🛡️</div>
        <div className="kg-shield-info">
          <div className="kg-shield-title">Streak Protection</div>
          <div className="kg-shield-sub">Shield your streak if you miss a day!</div>
        </div>
        <button
          className="kg-shield-btn"
          onClick={() => {
            // Add yesterday to the log so streak is protected
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yd = dateStr(yesterday);
            const updated = new Set([...log, yd]);
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...updated]));
            setLog(updated);
            setStreak(computeStreak(updated));
            setCalendar(buildCalendar(updated));
          }}
        >
          Use Shield
        </button>
      </div>

    </div>
  );
}
