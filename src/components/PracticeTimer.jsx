import { useState, useEffect, useRef } from 'react'
import { calcPhases, MIN_MINUTES_FOR_PHASES } from '../data/practicePhases'
import './PracticeTimer.css'

// 5 & 10 removed; 45 & 60 added
const PRESETS = [15, 20, 30, 45, 60]

function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0')
  const s = (seconds % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function playTones(freqs) {
  try {
    const ctx = new AudioContext()
    freqs.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.2)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.2 + 0.5)
      osc.start(ctx.currentTime + i * 0.2)
      osc.stop(ctx.currentTime + i * 0.2 + 0.65)
    })
  } catch { /* ignore */ }
}

const playPhaseChime = () => playTones([659, 784])        // E5 G5
const playDoneSound  = () => playTones([523, 659, 784, 1047]) // C E G C

export default function PracticeTimer({ onSessionComplete }) {
  const [totalSeconds, setTotalSeconds] = useState(15 * 60)
  const [customInput, setCustomInput]   = useState('')
  const [running,     setRunning]       = useState(false)
  const [started,     setStarted]       = useState(false)
  const [phases,      setPhases]        = useState(() => calcPhases(15 * 60))
  const [phaseIdx,    setPhaseIdx]      = useState(0)
  const [phaseRem,    setPhaseRem]      = useState(null)
  const [isComplete,  setIsComplete]    = useState(false)

  const intervalRef = useRef(null)

  const noPhases      = !phases
  const currentPhase  = phases?.[phaseIdx] ?? null

  // Recalc phases whenever total changes (only while not started)
  useEffect(() => {
    if (!started) {
      setPhases(calcPhases(totalSeconds))
      setPhaseIdx(0)
      setPhaseRem(null)
    }
  }, [totalSeconds, started])

  // ── Countdown tick ────────────────────────────────────────────
  useEffect(() => {
    if (!running) { clearInterval(intervalRef.current); return }

    intervalRef.current = setInterval(() => {
      setPhaseRem(prev => {
        const next = prev - 1
        if (next > 0) return next

        // Phase or session complete
        const lastPhase = noPhases || phaseIdx >= (phases?.length ?? 0) - 1
        if (lastPhase) {
          clearInterval(intervalRef.current)
          setRunning(false)
          setIsComplete(true)
          playDoneSound()
          onSessionComplete?.(totalSeconds)
          return 0
        }

        // Advance to next phase
        playPhaseChime()
        const nextIdx  = phaseIdx + 1
        setPhaseIdx(nextIdx)
        return phases[nextIdx].seconds
      })
    }, 1000)

    return () => clearInterval(intervalRef.current)
  }, [running, phaseIdx, noPhases]) // eslint-disable-line

  // ── Controls ─────────────────────────────────────────────────
  const start = () => {
    const initSecs = noPhases ? totalSeconds : phases[0].seconds
    setPhaseIdx(0)
    setPhaseRem(initSecs)
    setRunning(true)
    setStarted(true)
    setIsComplete(false)
  }

  const pause  = () => setRunning(false)
  const resume = () => setRunning(true)

  const reset = () => {
    clearInterval(intervalRef.current)
    setRunning(false)
    setStarted(false)
    setPhaseIdx(0)
    setPhaseRem(null)
    setIsComplete(false)
  }

  const skipPhase = () => {
    if (!phases || phaseIdx >= phases.length - 1) return
    playPhaseChime()
    const nextIdx = phaseIdx + 1
    setPhaseIdx(nextIdx)
    setPhaseRem(phases[nextIdx].seconds)
  }

  // ── Display values ────────────────────────────────────────────
  const displaySecs   = phaseRem !== null
    ? phaseRem
    : (noPhases ? totalSeconds : (phases?.[0]?.seconds ?? totalSeconds))

  const phaseTotalSecs = noPhases
    ? totalSeconds
    : (phases?.[phaseIdx]?.seconds ?? totalSeconds)

  const progress = (started && phaseRem !== null)
    ? Math.max(0, 1 - phaseRem / phaseTotalSecs)
    : 0

  const circumference = 2 * Math.PI * 54
  const strokeDash    = circumference * progress
  const ringColor     = isComplete
    ? '#4ade80'
    : (currentPhase?.color ?? '#e94560')

  const selectPreset = (mins) => {
    reset()
    setTotalSeconds(mins * 60)
    setCustomInput('')
  }

  const applyCustom = () => {
    const mins = parseInt(customInput, 10)
    if (!isNaN(mins) && mins > 0) selectPreset(Math.min(120, mins))
  }

  return (
    <div
      className="timer"
      style={currentPhase && started ? { '--phase-color': currentPhase.color } : {}}
    >
      {/* ── Pre-start: structured plan ───────────────────────── */}
      {!started && phases && (
        <div className="phase-plan">
          <div className="phase-plan__title">
            Today's Plan · {Math.round(totalSeconds / 60)} min
          </div>
          {phases.map(p => (
            <div key={p.id} className="phase-plan__row" style={{ '--pc': p.color }}>
              <span className="phase-plan__icon">{p.icon}</span>
              <div className="phase-plan__info">
                <span className="phase-plan__label">{p.label}</span>
                <span className="phase-plan__mins">{Math.round(p.seconds / 60)} min</span>
              </div>
              <div className="phase-plan__bar-wrap">
                <div
                  className="phase-plan__fill"
                  style={{ width: `${p.pct * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {!started && !phases && (
        <div className="free-practice-note">
          🎵 Pick {MIN_MINUTES_FOR_PHASES}+ minutes to get a structured practice plan!
        </div>
      )}

      {/* ── Active: current phase banner ─────────────────────── */}
      {started && !isComplete && currentPhase && (
        <div className="phase-banner" style={{ '--pc': currentPhase.color }}>
          <div className="phase-banner__top">
            <span className="phase-banner__icon">{currentPhase.icon}</span>
            <span className="phase-banner__name">{currentPhase.label}</span>
            <span className="phase-banner__step">{phaseIdx + 1} / {phases.length}</span>
          </div>
          <p className="phase-banner__desc">{currentPhase.desc}</p>
          <ul className="phase-banner__tips">
            {currentPhase.tips.slice(0, 2).map(t => <li key={t}>{t}</li>)}
          </ul>
          {phaseIdx < phases.length - 1 && (
            <button className="skip-btn" onClick={skipPhase}>
              Skip → {phases[phaseIdx + 1].label}
            </button>
          )}
        </div>
      )}

      {started && !isComplete && noPhases && (
        <div className="phase-banner" style={{ '--pc': '#e94560' }}>
          <span className="phase-banner__name">🎵 Free Practice</span>
        </div>
      )}

      {/* ── Ring ─────────────────────────────────────────────── */}
      <div className="timer__ring-wrap">
        <svg className="timer__ring" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" className="ring-bg" />
          <circle
            cx="60" cy="60" r="54"
            className="ring-progress"
            style={{ stroke: ringColor }}
            strokeDasharray={`${strokeDash} ${circumference}`}
            strokeDashoffset={0}
            transform="rotate(-90 60 60)"
          />
        </svg>
        <div className="timer__display">
          <span className="timer__time" style={{ color: ringColor }}>
            {isComplete ? '🎉' : formatTime(displaySecs)}
          </span>
          {isComplete && <span className="timer__done-text">Great job!</span>}
        </div>
      </div>

      {/* ── Presets (pre-start only) ──────────────────────────── */}
      {!started && (
        <>
          <div className="timer__presets">
            {PRESETS.map(m => (
              <button
                key={m}
                className={`preset-btn ${totalSeconds === m * 60 ? 'preset-btn--active' : ''}`}
                onClick={() => selectPreset(m)}
              >
                {m === 60 ? '1hr' : `${m}m`}
              </button>
            ))}
          </div>
          <div className="preset-custom-row">
            <input
              type="number"
              className="custom-input"
              placeholder="Custom min"
              min={1} max={120}
              value={customInput}
              onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyCustom()}
            />
            <button className="preset-btn" onClick={applyCustom}>Set</button>
          </div>
        </>
      )}

      {/* ── Controls ─────────────────────────────────────────── */}
      <div className="timer__controls">
        {!started && !isComplete && (
          <button className="timer-btn timer-btn--primary" onClick={start}>
            ▶ Start{phases ? ' Session' : ''}
          </button>
        )}
        {started && !isComplete && running && (
          <button className="timer-btn timer-btn--secondary" onClick={pause}>⏸ Pause</button>
        )}
        {started && !isComplete && !running && (
          <button className="timer-btn timer-btn--primary" onClick={resume}>▶ Resume</button>
        )}
        {(started || isComplete) && (
          <button className="timer-btn timer-btn--ghost" onClick={reset}>↺ Reset</button>
        )}
        {isComplete && (
          <button className="timer-btn timer-btn--primary" onClick={reset}>Practice Again</button>
        )}
      </div>
    </div>
  )
}
