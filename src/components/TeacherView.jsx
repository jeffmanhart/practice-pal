import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { ACHIEVEMENTS_DEF, checkAchievements } from '../context/AppContext'
import './TeacherView.css'

// ── Teacher-awardable badge definitions ───────────────────
const TEACHER_BADGES = [
  { id: 'teacher_star',     icon: '⭐', label: 'Star Student',     desc: 'Exceptional practice this week' },
  { id: 'teacher_great',    icon: '🌟', label: 'Great Lesson',     desc: 'Outstanding lesson performance' },
  { id: 'teacher_improved', icon: '📈', label: 'Most Improved',    desc: 'Remarkable progress shown' },
  { id: 'teacher_effort',   icon: '💪', label: 'Extra Effort',     desc: 'Went above and beyond' },
  { id: 'teacher_perfect',  icon: '🏆', label: 'Perfect Week',     desc: 'Practiced every day this week' },
  { id: 'teacher_creative', icon: '🎨', label: 'Creative Playing', desc: 'Showed great musical creativity' },
]

// ── Helpers ────────────────────────────────────────────────
function formatDur(secs) {
  if (!secs) return '0:00'
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysAgoLabel(ts) {
  if (!ts) return 'No activity'
  const d = Math.floor((Date.now() - ts) / 86400000)
  if (d === 0) return 'Active today'
  if (d === 1) return 'Active yesterday'
  return `${d} days ago`
}

// ── Teacher login / register ───────────────────────────────
function TeacherAuth() {
  const { login, register, authLoading, authError, setAuthError } = useAuth()
  const [mode,  setMode]  = useState('login')
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [pass,  setPass]  = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setAuthError(null)
    if (mode === 'login') login(email, pass)
    else register(name, email, pass)
  }

  const switchMode = () => { setMode(m => m === 'login' ? 'register' : 'login'); setAuthError(null) }

  return (
    <div className="teacher-auth">
      <div className="teacher-auth__logo">🎓</div>
      <h1 className="teacher-auth__title">Teacher Portal</h1>
      <p className="teacher-auth__sub">
        {mode === 'login' ? 'Sign in to see your students' : 'Create your teacher account'}
      </p>
      {mode === 'login' && (
        <p className="teacher-auth__demo-hint">
          🧪 Demo: email&nbsp;<code>teacher</code>&nbsp;· password&nbsp;<code>teacher</code>
        </p>
      )}

      <form className="teacher-auth__form" onSubmit={handleSubmit}>
        {mode === 'register' && (
          <input
            className="teacher-field"
            placeholder="Your name (e.g. Ms. Johnson)"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        )}
        <input
          className="teacher-field"
          type="text"
          placeholder='Email address (or "teacher" for demo)'
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="username"
        />
        <input
          className="teacher-field"
          type="password"
          placeholder="Password (min 6 chars)"
          value={pass}
          onChange={e => setPass(e.target.value)}
          required
          minLength={6}
        />

        {authError && <p className="teacher-auth__error">{authError}</p>}

        <button className="teacher-auth__btn" type="submit" disabled={authLoading}>
          {authLoading ? 'Loading…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <button className="teacher-auth__switch" onClick={switchMode}>
        {mode === 'login'
          ? "New teacher? Create an account →"
          : "Already have an account? Sign in →"}
      </button>
    </div>
  )
}

// ── Student list card ──────────────────────────────────────
function StudentCard({ student, onClick }) {
  const unreviewed = student.unreviewed || 0
  const sessions   = student.sessions || []
  const weekStart  = Date.now() - 7 * 86400000
  const weekMins   = sessions
    .filter(s => new Date(s.date).getTime() >= weekStart)
    .reduce((t, s) => t + s.durationMinutes, 0)

  return (
    <div className="student-card" onClick={onClick}>
      <div className="student-card__top">
        <span className="student-card__name">{student.studentName || 'Unknown'}</span>
        {unreviewed > 0 && (
          <span className="student-card__badge">🎵 {unreviewed} new</span>
        )}
      </div>
      <div className="student-card__stats">
        <span title="Streak">🔥 {student.streak || 0}d</span>
        <span title="This week">⏱ {weekMins}min</span>
        <span title="Points">⭐ {student.points || 0}</span>
      </div>
      <div className="student-card__last">{daysAgoLabel(student.lastActive)}</div>
    </div>
  )
}

// ── Student detail view ────────────────────────────────────
function StudentDetail({ student, classCode, onBack }) {
  const {
    markReviewed, listenStudentRecordings,
    teacherAwardPoints, teacherAwardAchievement, teacherGradeRecording,
  } = useAuth()

  const [recordings,    setRecordings]    = useState([])
  const [playingId,     setPlayingId]     = useState(null)
  const audioRefs = useRef({})

  // Grading / award state
  const [awardNote,     setAwardNote]     = useState('')
  const [awardPts,      setAwardPts]      = useState('')
  const [selectedBadge, setSelectedBadge] = useState('')
  const [awardConfirm,  setAwardConfirm]  = useState('')
  const [recGrades,     setRecGrades]     = useState({})   // { recId: { pts, note } }

  useEffect(() => {
    const unsub = listenStudentRecordings(classCode, student.id, setRecordings)
    return unsub
  }, [classCode, student.id])

  // Derived stats
  const sessions     = student.sessions || []
  const totalMins    = sessions.reduce((t, s) => t + s.durationMinutes, 0)
  const achieved     = checkAchievements(sessions, student.points || 0, [], student.streak || 0)
  const earned       = ACHIEVEMENTS_DEF.filter(a => achieved[a.id])
  const last7        = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (6 - i)); return d })
  const practicedSet = new Set(sessions.map(s => new Date(s.date).toDateString()))

  const showConfirm = (msg) => {
    setAwardConfirm(msg)
    setTimeout(() => setAwardConfirm(''), 3500)
  }

  const togglePlay = (rec) => {
    const el = audioRefs.current[rec.id]
    if (!el) return
    if (playingId === rec.id) { el.pause(); setPlayingId(null) }
    else {
      Object.values(audioRefs.current).forEach(a => a?.pause())
      el.play(); setPlayingId(rec.id)
      el.onended = () => setPlayingId(null)
    }
  }

  const handleMarkReviewed = (rec) => markReviewed(classCode, student.id, rec.id)

  const handleAwardPoints = async () => {
    const pts = parseInt(awardPts)
    if (!pts || pts <= 0) return
    await teacherAwardPoints(student.id, pts, awardNote.trim())
    showConfirm(`✅ ${pts} pts awarded!${awardNote ? `  "${awardNote}"` : ''}`)
    setAwardNote('')
    setAwardPts('')
  }

  const handleAwardBadge = async () => {
    if (!selectedBadge) return
    const badge = TEACHER_BADGES.find(b => b.id === selectedBadge)
    await teacherAwardAchievement(student.id, selectedBadge)
    showConfirm(`✅ ${badge?.icon} ${badge?.label} badge awarded!`)
    setSelectedBadge('')
  }

  const handleGradeRecording = async (recId) => {
    const pts  = parseInt(recGrades[recId]?.pts || '0')
    const note = (recGrades[recId]?.note || '').trim()
    if (!pts || pts <= 0) return
    await teacherGradeRecording(classCode, student.id, recId, pts, note)
    // Update local recording state immediately
    setRecordings(prev => prev.map(r =>
      r.id === recId ? { ...r, teacherPoints: pts, teacherFeedback: note, graded: true } : r
    ))
    setRecGrades(prev => ({ ...prev, [recId]: { pts: '', note: '' } }))
    showConfirm(`✅ Recording graded: ${pts} pts${note ? `  "${note}"` : ''}`)
  }

  const setRecGrade = (recId, field, val) => {
    setRecGrades(prev => ({ ...prev, [recId]: { ...(prev[recId] || {}), [field]: val } }))
  }

  return (
    <div className="student-detail">
      {/* Header */}
      <div className="student-detail__header">
        <button className="teacher-back-btn" onClick={onBack}>← Students</button>
        <div className="student-detail__title-wrap">
          <h2 className="student-detail__name">{student.studentName || 'Student'}</h2>
          <span className="student-detail__last">{daysAgoLabel(student.lastActive)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="teacher-stats">
        {[
          { val: student.streak || 0,  lbl: '🔥 Streak' },
          { val: totalMins,            lbl: '⏱ Total Mins' },
          { val: sessions.length,      lbl: '📅 Sessions' },
          { val: student.points || 0,  lbl: '⭐ Points' },
        ].map(({ val, lbl }) => (
          <div key={lbl} className="teacher-stat">
            <div className="teacher-stat__val">{val}</div>
            <div className="teacher-stat__lbl">{lbl}</div>
          </div>
        ))}
      </div>

      {/* 7-day calendar */}
      <div className="teacher-section">
        <div className="teacher-section__title">Last 7 Days</div>
        <div className="teacher-calendar">
          {last7.map((d, i) => {
            const done    = practicedSet.has(d.toDateString())
            const isToday = d.toDateString() === new Date().toDateString()
            return (
              <div key={i} className={`teacher-cal-day${done ? ' teacher-cal-day--done' : ''}${isToday ? ' teacher-cal-day--today' : ''}`}>
                <span>{d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}</span>
                <span className="teacher-cal-check">{done ? '✓' : ''}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Award Points & Achievements ── */}
      <div className="teacher-section teacher-award-section">
        <div className="teacher-section__title">🏆 Award Points &amp; Achievements</div>

        {awardConfirm && <div className="teacher-award-confirm">{awardConfirm}</div>}

        {/* Lesson points */}
        <div className="teacher-award-row">
          <input
            className="teacher-field teacher-field--sm"
            type="text"
            placeholder='Lesson note, e.g. "Great scales today!"'
            value={awardNote}
            onChange={e => setAwardNote(e.target.value)}
          />
          <div className="teacher-pts-row">
            <input
              className="teacher-field teacher-field--pts"
              type="number"
              min="0"
              placeholder="pts"
              value={awardPts}
              onChange={e => setAwardPts(e.target.value)}
            />
            {[100, 250, 500, 1000].map(n => (
              <button key={n} className="teacher-pts-quick" onClick={() => setAwardPts(String(n))}>
                +{n}
              </button>
            ))}
          </div>
          <button
            className="teacher-award-btn"
            onClick={handleAwardPoints}
            disabled={!awardPts || parseInt(awardPts) <= 0}
          >
            🌟 Award Points
          </button>
        </div>

        {/* Badge award */}
        <div className="teacher-badge-row">
          <select
            className="teacher-field teacher-field--select"
            value={selectedBadge}
            onChange={e => setSelectedBadge(e.target.value)}
          >
            <option value="">Select achievement badge…</option>
            {TEACHER_BADGES.map(b => (
              <option key={b.id} value={b.id}>{b.icon} {b.label} — {b.desc}</option>
            ))}
          </select>
          <button
            className="teacher-badge-btn"
            onClick={handleAwardBadge}
            disabled={!selectedBadge}
          >
            🏆 Award Badge
          </button>
        </div>

        {/* Already-awarded teacher badges */}
        {student.teacherBadges?.length > 0 && (
          <div className="teacher-earned-badges">
            <span className="teacher-earned-badges__label">Awarded:</span>
            {student.teacherBadges.map(bid => {
              const b = TEACHER_BADGES.find(x => x.id === bid)
              return b ? (
                <span key={bid} className="teacher-achievement" title={b.desc}>
                  {b.icon} {b.label}
                </span>
              ) : null
            })}
          </div>
        )}
      </div>

      {/* Recordings */}
      <div className="teacher-section">
        <div className="teacher-section__title">
          Recordings
          {recordings.filter(r => r.isNew).length > 0 && (
            <span className="teacher-new-badge">{recordings.filter(r => r.isNew).length} new</span>
          )}
        </div>
        {recordings.length === 0 ? (
          <p className="teacher-empty">No recordings sent yet.</p>
        ) : (
          <div className="teacher-recordings">
            {recordings.map(rec => (
              <div key={rec.id} className={`teacher-rec-row${rec.isNew ? ' teacher-rec-row--new' : ''}`}>
                <audio
                  ref={el => { if (el) audioRefs.current[rec.id] = el }}
                  src={rec.downloadUrl}
                  preload="none"
                />
                <div className="teacher-rec-meta">
                  {rec.isNew && <span className="teacher-rec-new-dot">NEW</span>}
                  <span className="teacher-rec-date">{fmtDate(rec.timestamp)}</span>
                  <span className="teacher-rec-dur">{formatDur(rec.durationSecs)}</span>
                </div>
                <div className="teacher-rec-actions">
                  <button
                    className={`teacher-rec-btn ${playingId === rec.id ? 'teacher-rec-btn--pause' : 'teacher-rec-btn--play'}`}
                    onClick={() => togglePlay(rec)}
                  >
                    {playingId === rec.id ? '⏸' : '▶'}
                  </button>
                  {rec.isNew && (
                    <button
                      className="teacher-rec-btn teacher-rec-btn--review"
                      onClick={() => handleMarkReviewed(rec)}
                    >
                      ✓ Reviewed
                    </button>
                  )}
                </div>

                {/* Grade area */}
                {rec.graded ? (
                  <div className="teacher-rec-graded">
                    ⭐ {rec.teacherPoints} pts
                    {rec.teacherFeedback && (
                      <span className="teacher-rec-feedback">· "{rec.teacherFeedback}"</span>
                    )}
                  </div>
                ) : (
                  <div className="teacher-rec-grade-form">
                    <input
                      className="teacher-grade-pts"
                      type="number"
                      min="0"
                      placeholder="pts"
                      value={recGrades[rec.id]?.pts || ''}
                      onChange={e => setRecGrade(rec.id, 'pts', e.target.value)}
                    />
                    <input
                      className="teacher-grade-note"
                      type="text"
                      placeholder="Feedback (optional)"
                      value={recGrades[rec.id]?.note || ''}
                      onChange={e => setRecGrade(rec.id, 'note', e.target.value)}
                    />
                    <button
                      className="teacher-grade-btn"
                      onClick={() => handleGradeRecording(rec.id)}
                      disabled={!recGrades[rec.id]?.pts || parseInt(recGrades[rec.id].pts) <= 0}
                    >
                      Grade
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session history */}
      {sessions.length > 0 && (
        <div className="teacher-section">
          <div className="teacher-section__title">Recent Sessions</div>
          <div className="teacher-sessions">
            {sessions.slice(0, 8).map((s, i) => (
              <div key={i} className="teacher-session-row">
                <span className="teacher-session-date">{fmtDate(s.date)}</span>
                <div className="teacher-session-bar-wrap">
                  <div className="teacher-session-bar" style={{ width: `${Math.min(100, (s.durationMinutes / 60) * 100)}%` }} />
                </div>
                <span className="teacher-session-dur">{s.durationMinutes} min</span>
                <span className="teacher-session-pts">+{s.pointsEarned} ⭐</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Auto-earned achievements */}
      {earned.length > 0 && (
        <div className="teacher-section">
          <div className="teacher-section__title">Achievements ({earned.length}/{ACHIEVEMENTS_DEF.length})</div>
          <div className="teacher-achievements">
            {earned.map(a => (
              <span key={a.id} className="teacher-achievement" title={a.desc}>
                {a.icon} {a.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Teacher dashboard (student list) ──────────────────────
function TeacherDashboard() {
  const { teacherData, students, logout, teacherUser } = useAuth()
  const [selected, setSelected] = useState(null)
  const [copied,   setCopied]   = useState(false)

  // Guard against the brief moment where teacherUser is set but teacherData hasn't arrived yet
  if (!teacherData) return <div className="teacher-loading">🎵 Loading your dashboard…</div>

  const copyCode = () => {
    navigator.clipboard?.writeText(teacherData.classCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (selected) {
    return (
      <StudentDetail
        student={selected}
        classCode={teacherData.classCode}
        onBack={() => setSelected(null)}
      />
    )
  }

  const totalNewRecs = students.reduce((t, s) => t + (s.unreviewed || 0), 0)

  return (
    <div className="teacher-dashboard">
      {teacherUser?.isDemo && (
        <div className="teacher-demo-banner">
          🧪 Demo mode — showing sample student data. Configure Firebase to use with real students.
        </div>
      )}
      <div className="teacher-dash-header">
        <div>
          <h1 className="teacher-dash-title">👩‍🏫 {teacherData.name}'s Class</h1>
          <p className="teacher-dash-sub">
            {students.length} student{students.length !== 1 ? 's' : ''}
            {totalNewRecs > 0 && ` · ${totalNewRecs} new recording${totalNewRecs !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button className="teacher-logout-btn" onClick={logout}>Sign out</button>
      </div>

      {/* Class code box */}
      <div className="teacher-code-box">
        <div className="teacher-code-label">Share this code with your students:</div>
        <div className="teacher-code-row">
          <span className="teacher-code">{teacherData.classCode}</span>
          <button className="teacher-code-copy" onClick={copyCode}>
            {copied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <div className="teacher-code-hint">
          Students: Dashboard tab → Settings → enter this code
        </div>
      </div>

      {/* Student list */}
      {students.length === 0 ? (
        <div className="teacher-empty-class">
          <p className="teacher-empty-class__icon">🎵</p>
          <p className="teacher-empty-class__msg">No students yet.</p>
          <p className="teacher-empty-class__sub">Share your class code above and have students enter it in their Dashboard settings.</p>
        </div>
      ) : (
        <div className="teacher-student-grid">
          {students.map(s => (
            <StudentCard key={s.id} student={s} onClick={() => setSelected(s)} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component — works as overlay OR standalone page ───
export default function TeacherView({ onClose, standalone = false, onSwitchPortal }) {
  const { teacherUser } = useAuth()
  const handleClose = standalone ? onSwitchPortal : onClose

  useEffect(() => {
    if (standalone) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = e => { if (e.key === 'Escape' && onClose) onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [standalone, onClose])

  const panel = (
    <div className={standalone ? 'teacher-standalone-panel' : 'teacher-panel'}>
      <button
        className={standalone ? 'teacher-portal-back-btn' : 'teacher-close-btn'}
        onClick={handleClose}
        aria-label={standalone ? 'Change portal' : 'Close'}
      >
        {standalone ? '← Change Portal' : '✕'}
      </button>
      {!teacherUser ? <TeacherAuth /> : <TeacherDashboard />}
    </div>
  )

  if (standalone) {
    return <div className="teacher-standalone">{panel}</div>
  }

  return (
    <div className="teacher-overlay" onClick={e => { if (e.target === e.currentTarget && onClose) onClose() }}>
      {panel}
    </div>
  )
}
