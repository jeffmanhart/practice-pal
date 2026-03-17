import { useState, useRef } from 'react'
import { useApp, ACHIEVEMENTS_DEF, checkAchievements, getPetProgress } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import TeacherView from './TeacherView'
import './DashboardScreen.css'

// ── Helpers ────────────────────────────────────────────────
function formatDur(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

// ── Recording row (self-contained playback) ────────────────
function RecRow({ rec, idx, onRemove, teacherEmail, studentName }) {
  const { uploadRecordingToTeacher } = useApp()
  const [playing,    setPlaying]    = useState(false)
  const [sendState,  setSendState]  = useState('idle') // idle | sending | sent | error
  const [errorMsg,   setErrorMsg]   = useState('')
  const audioRef = useRef(null)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play()
      setPlaying(true)
      audioRef.current.onended = () => setPlaying(false)
    }
  }

  const download = () => {
    const a = document.createElement('a')
    a.href = rec.url
    a.download = `practice-recording-${rec.id}.webm`
    a.click()
  }

  const send = async () => {
    if (sendState === 'sending' || sendState === 'sent') return
    setSendState('sending')
    setErrorMsg('')

    // 1. Try Firebase upload (works when class code is configured)
    const result = await uploadRecordingToTeacher(rec)
    if (result?.success) {
      setSendState('sent')
      return
    }

    // 2. Fallback: Web Share API (mobile native)
    if (navigator.canShare) {
      const file = new File([rec.blob], `practice-${rec.id}.webm`, { type: 'audio/webm' })
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Practice Recording — ${studentName || 'Student'}`,
            text: `My practice recording from ${fmtDate(rec.timestamp)} (${formatDur(rec.durationSecs)})`,
            files: [file],
          })
          setSendState('sent')
          return
        } catch (e) {
          if (e.name === 'AbortError') { setSendState('idle'); return }
        }
      }
    }

    // 3. Fallback: download + mailto
    download()
    if (teacherEmail) {
      const subject = encodeURIComponent(`Practice Recording — ${studentName || 'Student'}`)
      const body = encodeURIComponent(
        `Hi!\n\nPlease find my practice recording attached.\n` +
        `Date: ${fmtDate(rec.timestamp)}   Duration: ${formatDur(rec.durationSecs)}\n\n` +
        `— ${studentName || 'Student'}`
      )
      setTimeout(() => {
        window.location.href = `mailto:${teacherEmail}?subject=${subject}&body=${body}`
      }, 600)
    }

    if (result?.error) {
      setErrorMsg(result.error)
      setSendState('error')
    } else {
      setSendState('sent')
    }
  }

  return (
    <div className="dash-rec-row">
      <audio ref={audioRef} src={rec.url} preload="none" />

      <div className="dash-rec-meta">
        <span className="dash-rec-name">Take {idx}</span>
        <span className="dash-rec-time">{fmtTime(rec.timestamp)}</span>
        <span className="dash-rec-dur">{formatDur(rec.durationSecs)}</span>
      </div>

      <div className="dash-rec-actions">
        <button className={`dash-rec-btn ${playing ? 'dash-rec-btn--pause' : 'dash-rec-btn--play'}`} onClick={togglePlay}>
          {playing ? '⏸' : '▶'}
        </button>
        <button
          className="dash-rec-btn dash-rec-btn--send"
          disabled
          title="Sending recordings to teacher coming soon"
        >
          📤 Send
        </button>
        <button className="dash-rec-btn" onClick={download} title="Download">⬇</button>
        <button className="dash-rec-btn dash-rec-btn--del" onClick={() => onRemove(rec.id)} title="Delete">🗑</button>
      </div>
      {sendState === 'error' && (
        <div className="dash-rec-error">{errorMsg}</div>
      )}
    </div>
  )
}

// ── Main Dashboard ─────────────────────────────────────────
export default function DashboardScreen() {
  const {
    sessions, points, streak, games, pets, activePet,
    recordings, removeRecording,
  } = useApp()

  const { studentUser, studentData, studentLogout } = useAuth()

  // Settings (persisted to localStorage, not AppContext)
  const [studentName,  setStudentName]  = useState(() => studentData?.name || localStorage.getItem('pr_student_name')  || '')
  const [teacherEmail, setTeacherEmail] = useState(() => localStorage.getItem('pr_teacher_email') || '')
  const [teacherName,  setTeacherName]  = useState(() => localStorage.getItem('pr_teacher_name')  || '')
  const [classCode,    setClassCode]    = useState(() => localStorage.getItem('pr_class_code')     || '')
  const [settingsOpen, setSettingsOpen] = useState(!localStorage.getItem('pr_student_name'))
  const [showTeacher,  setShowTeacher]  = useState(false)

  const saveSettings = () => {
    localStorage.setItem('pr_student_name',  studentName)
    localStorage.setItem('pr_teacher_email', teacherEmail)
    localStorage.setItem('pr_teacher_name',  teacherName)
    localStorage.setItem('pr_class_code',    classCode.trim().toUpperCase())
    setClassCode(classCode.trim().toUpperCase())
    setSettingsOpen(false)
  }

  const applyDemoStudent = () => {
    setStudentName('Demo Student')
    setClassCode('DEMO01')
    setTeacherName('Ms. Johnson')
    setTeacherEmail('')
  }

  // ── Computed stats ─────────────────────────────────────
  const totalMins  = sessions.reduce((s, x) => s + x.durationMinutes, 0)
  const achieved   = checkAchievements(sessions, points, games, streak)
  const earnedList = ACHIEVEMENTS_DEF.filter(a => achieved[a.id])

  // This week (last 7 days including today)
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - 6)
  weekStart.setHours(0, 0, 0, 0)
  const weekSessions = sessions.filter(s => new Date(s.date) >= weekStart)
  const weekMins     = weekSessions.reduce((s, x) => s + x.durationMinutes, 0)

  // 7-day grid
  const last7        = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return d
  })
  const practicedSet = new Set(sessions.map(s => new Date(s.date).toDateString()))

  // Current pet
  const currentPet = pets.find(p => p.id === activePet && p.owned) || null

  // ── Send report via mailto ─────────────────────────────
  const sendReport = () => {
    const name    = studentName || 'Student'
    const subject = encodeURIComponent(`Practice Report — ${name}`)
    const lines   = [
      `Practice Report for ${name}`,
      `Generated: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      '',
      '── WEEKLY SUMMARY ──────────────────',
      `Days practiced this week : ${weekSessions.length}`,
      `Minutes this week        : ${weekMins}`,
      `Current streak           : ${streak} day${streak !== 1 ? 's' : ''}`,
      `Total practice time      : ${totalMins} min across ${sessions.length} session${sessions.length !== 1 ? 's' : ''}`,
      `Points earned            : ${points}`,
      '',
      '── ACHIEVEMENTS ────────────────────',
      earnedList.length > 0
        ? earnedList.map(a => `  ${a.icon} ${a.name}: ${a.desc}`).join('\n')
        : '  None unlocked yet.',
      '',
      '── RECENT SESSIONS ─────────────────',
      ...sessions.slice(0, 10).map(s =>
        `  ${fmtDate(s.date).padEnd(8)} ${String(s.durationMinutes).padStart(3)} min   +${s.pointsEarned} pts`
      ),
    ]
    const body = encodeURIComponent(lines.join('\n'))
    window.location.href = `mailto:${teacherEmail}?subject=${subject}&body=${body}`
  }

  const teacherLabel = teacherName || teacherEmail || 'Teacher'

  return (
    <div className="dashboard">

      {/* ── Header ─────────────────────────────────────── */}
      <header className="dash-header">
        <div>
          <h1 className="dash-title">📊 Practice Report</h1>
          <p className="dash-subtitle">
            {studentName ? studentName : <span className="dash-subtitle--hint">Set your name in Settings ↓</span>}
          </p>
        </div>
        <div className="dash-header-right">
          <p className="dash-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </p>
          <button className="dash-teacher-btn" onClick={() => setShowTeacher(true)}>
            👩‍🏫 Teacher View
          </button>
        </div>
      </header>

      {/* ── Summary cards ──────────────────────────────── */}
      <div className="dash-cards">
        <div className="dash-card">
          <div className="dash-card__val">{streak}</div>
          <div className="dash-card__label">🔥 Day Streak</div>
        </div>
        <div className="dash-card">
          <div className="dash-card__val">{weekMins}</div>
          <div className="dash-card__label">⏱ Mins This Week</div>
        </div>
        <div className="dash-card">
          <div className="dash-card__val">{totalMins}</div>
          <div className="dash-card__label">🎵 Total Mins</div>
        </div>
      </div>

      {/* ── 7-day calendar ─────────────────────────────── */}
      <section className="dash-section">
        <h2 className="dash-section-title">Last 7 Days</h2>
        <div className="dash-calendar">
          {last7.map((d, i) => {
            const done    = practicedSet.has(d.toDateString())
            const isToday = d.toDateString() === new Date().toDateString()
            return (
              <div key={i} className={`dash-day${done ? ' dash-day--done' : ''}${isToday ? ' dash-day--today' : ''}`}>
                <span className="dash-day__lbl">
                  {d.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 1)}
                </span>
                <span className="dash-day__dot">{done ? '✓' : ''}</span>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Session history ─────────────────────────────── */}
      {sessions.length > 0 && (
        <section className="dash-section">
          <h2 className="dash-section-title">Recent Sessions</h2>
          <div className="dash-sessions">
            {sessions.slice(0, 8).map(s => (
              <div key={s.id} className="dash-session-row">
                <span className="dash-session-date">{fmtDate(s.date)}</span>
                <div className="dash-session-bar-wrap">
                  <div
                    className="dash-session-bar"
                    style={{ width: `${Math.min(100, (s.durationMinutes / 60) * 100)}%` }}
                  />
                </div>
                <span className="dash-session-dur">{s.durationMinutes} min</span>
                <span className="dash-session-pts">+{s.pointsEarned} ⭐</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {sessions.length === 0 && (
        <section className="dash-section">
          <p className="dash-empty">No sessions yet — start practicing on the Practice tab!</p>
        </section>
      )}

      {/* ── Achievements ───────────────────────────────── */}
      <section className="dash-section">
        <h2 className="dash-section-title">
          Achievements
          <span className="dash-section-count">{earnedList.length}/{ACHIEVEMENTS_DEF.length}</span>
        </h2>
        {earnedList.length === 0 ? (
          <p className="dash-empty">Keep practicing to unlock achievements!</p>
        ) : (
          <div className="dash-achievements">
            {earnedList.map(a => (
              <div key={a.id} className="dash-badge" title={a.desc}>
                <span className="dash-badge__icon">{a.icon}</span>
                <span className="dash-badge__name">{a.name}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Pet ─────────────────────────────────────────── */}
      {currentPet && (() => {
        const { level, pct } = getPetProgress(currentPet.xp)
        return (
          <section className="dash-section">
            <h2 className="dash-section-title">Practice Buddy</h2>
            <div className="dash-pet">
              <span className="dash-pet__icon">{currentPet.icon}</span>
              <div className="dash-pet__info">
                <div className="dash-pet__name">{currentPet.name}</div>
                <div className="dash-pet__level">Level {level} companion</div>
                <div className="dash-pet__xp-bar">
                  <div className="dash-pet__xp-fill" style={{ width: `${Math.round(pct * 100)}%` }} />
                </div>
              </div>
            </div>
          </section>
        )
      })()}

      {/* ── Recordings ─────────────────────────────────── */}
      <section className="dash-section">
        <h2 className="dash-section-title">
          Recordings
          {recordings.length > 0 && <span className="dash-section-count">{recordings.length}</span>}
        </h2>
        <p className="dash-device-note">📱 Recordings are saved on this device only — sending to teacher coming soon.</p>
        {recordings.length === 0 ? (
          <p className="dash-empty">
            Record yourself on the Practice tab — takes will appear here for playback.
          </p>
        ) : (
          <div className="dash-recordings">
            {recordings.map((rec, idx) => (
              <RecRow
                key={rec.id}
                rec={rec}
                idx={recordings.length - idx}
                onRemove={removeRecording}
                teacherEmail={teacherEmail}
                studentName={studentName}
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Actions ────────────────────────────────────── */}
      <div className="dash-actions">
        <button className="dash-btn dash-btn--send" onClick={sendReport}>
          📧 Email Report{teacherEmail ? ` to ${teacherLabel}` : ''}
        </button>
        <button className="dash-btn dash-btn--print" onClick={() => window.print()}>
          🖨 Print
        </button>
      </div>

      {/* ── Settings ───────────────────────────────────── */}
      <div className="dash-settings">
        <button className="dash-settings-toggle" onClick={() => setSettingsOpen(o => !o)}>
          ⚙️ Settings {settingsOpen ? '▲' : '▼'}
        </button>

        {settingsOpen && (
          <div className="dash-settings-body">

            <button className="dash-btn dash-btn--demo" onClick={applyDemoStudent}>
              🧪 Fill Demo Student Info
            </button>

            <label className="dash-field">
              <span className="dash-field__label">Student Name</span>
              <input
                className="dash-field__input"
                value={studentName}
                onChange={e => setStudentName(e.target.value)}
                placeholder="e.g. Alex"
              />
            </label>
            <label className="dash-field">
              <span className="dash-field__label">Teacher Name</span>
              <input
                className="dash-field__input"
                value={teacherName}
                onChange={e => setTeacherName(e.target.value)}
                placeholder="e.g. Ms. Johnson"
              />
            </label>
            <label className="dash-field">
              <span className="dash-field__label">Teacher Email</span>
              <input
                className="dash-field__input"
                type="email"
                value={teacherEmail}
                onChange={e => setTeacherEmail(e.target.value)}
                placeholder="teacher@school.com"
              />
            </label>
            <label className="dash-field">
              <span className="dash-field__label">Class Code</span>
              <input
                className="dash-field__input dash-field__input--code"
                value={classCode}
                onChange={e => setClassCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                maxLength={6}
                spellCheck={false}
              />
              <span className="dash-field__hint">
                Ask your teacher for their 6-character class code
              </span>
            </label>
            <button className="dash-btn dash-btn--save" onClick={saveSettings}>
              Save Settings ✓
            </button>

            {/* ── Account section ──────────────────── */}
            <div className="dash-account">
              {studentUser ? (
                <>
                  <div className="dash-account__info">
                    <span className="dash-account__label">Signed in as</span>
                    <span className="dash-account__name">
                      {studentData?.name || studentUser.email}
                    </span>
                    {studentData?.classCode && (
                      <span className="dash-account__code">
                        Class: <strong>{studentData.classCode}</strong>
                      </span>
                    )}
                  </div>
                  <button className="dash-btn dash-btn--logout" onClick={studentLogout}>
                    Sign Out
                  </button>
                </>
              ) : (
                <p className="dash-account__anon">
                  Not signed in — progress saves on this device only.{' '}
                  <button
                    className="dash-account__signin-link"
                    onClick={() => {
                      localStorage.removeItem('pr_skip_auth')
                      window.location.reload()
                    }}
                  >
                    Sign in or create account
                  </button>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Teacher overlay ────────────────────────────── */}
      {showTeacher && <TeacherView onClose={() => setShowTeacher(false)} />}

    </div>
  )
}
