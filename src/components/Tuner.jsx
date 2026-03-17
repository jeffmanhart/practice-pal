import { useState, useEffect, useRef } from 'react'
import { detectPitch, freqToNote } from '../utils/pitchDetection'
import './Tuner.css'

const CENTS_THRESHOLD = 10
const CENTS_CLOSE     = 25

function tuneStatus(cents) {
  if (cents === undefined || cents === null) return 'idle'
  const abs = Math.abs(cents)
  if (abs <= CENTS_THRESHOLD) return 'intune'
  if (abs <= CENTS_CLOSE)     return 'close'
  return 'off'
}

const STATUS_COLOR = {
  idle:   '#555',
  intune: '#4ade80',
  close:  '#f59e0b',
  off:    '#e94560',
}

export default function Tuner({ micOwner, setMicOwner }) {
  const [active,   setActive]   = useState(false)
  const [noteInfo, setNoteInfo] = useState(null)
  const [error,    setError]    = useState(null)
  const [blocked,  setBlocked]  = useState(false)

  const audioCtxRef = useRef(null)
  const analyserRef = useRef(null)
  const streamRef   = useRef(null)
  const rafRef      = useRef(null)
  const bufferRef   = useRef(null)

  const stop = () => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    streamRef.current   = null
    setActive(false)
    setNoteInfo(null)
    setMicOwner(null)
  }

  const start = async () => {
    // Block if recorder is running
    if (micOwner === 'recorder') {
      setBlocked(true)
      setTimeout(() => setBlocked(false), 3000)
      return
    }
    setError(null)
    setBlocked(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream

      const ctx      = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.4
      ctx.createMediaStreamSource(stream).connect(analyser)

      audioCtxRef.current = ctx
      analyserRef.current = analyser
      bufferRef.current   = new Float32Array(analyser.fftSize)

      setMicOwner('tuner')
      setActive(true)
      tick()
    } catch {
      setError('Microphone access denied. Check your browser permissions.')
    }
  }

  const tick = () => {
    if (!analyserRef.current) return
    analyserRef.current.getFloatTimeDomainData(bufferRef.current)
    const freq = detectPitch(bufferRef.current, audioCtxRef.current.sampleRate)
    setNoteInfo(freq ? freqToNote(freq) : null)
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => stop(), []) // eslint-disable-line

  const status     = noteInfo ? tuneStatus(noteInfo.cents) : 'idle'
  const color      = STATUS_COLOR[status]
  const needleAngle = noteInfo
    ? Math.max(-80, Math.min(80, (noteInfo.cents / 50) * 80))
    : 0

  return (
    <div className="tuner">
      <div className="tuner__header">
        <span className="tuner__title">Chromatic Tuner</span>
        <button
          className={`tuner-toggle ${active ? 'tuner-toggle--active' : ''}`}
          onClick={active ? stop : start}
        >
          {active ? '⏹ Stop' : '🎙 Start'}
        </button>
      </div>

      {/* Conflict message */}
      {blocked && (
        <div className="studio-conflict">
          🔴 Recorder is using the mic — stop it first.
        </div>
      )}

      {error && <div className="tuner__error">{error}</div>}

      {/* Note display */}
      <div className="tuner__note-display">
        <span className="tuner__note-name" style={{ color }}>
          {noteInfo ? noteInfo.name : '—'}
        </span>
        <span className="tuner__note-octave">
          {noteInfo ? noteInfo.octave : ''}
        </span>
      </div>

      {/* Cents gauge */}
      <div className="tuner__gauge">
        <div className="gauge__scale">
          {[-50, -25, 0, 25, 50].map(v => (
            <div key={v} className={`gauge__mark ${v === 0 ? 'gauge__mark--center' : ''}`}>
              <div className="gauge__tick" />
              <span className="gauge__tick-label">{v > 0 ? `+${v}` : v}</span>
            </div>
          ))}
        </div>
        <div className="gauge__needle-wrap">
          <div
            className={`gauge__needle gauge__needle--${status}`}
            style={{ transform: `rotate(${needleAngle}deg)`, '--needle-color': color }}
          />
          <div className="gauge__pivot" style={{ background: color }} />
        </div>
        <div className="gauge__intune-zone" />
      </div>

      {/* Freq + cents readout */}
      <div className="tuner__readout">
        <div className="tuner__readout-item">
          <span className="readout-val">{noteInfo ? `${noteInfo.freq} Hz` : '— Hz'}</span>
          <span className="readout-label">Frequency</span>
        </div>
        <div className="tuner__readout-item">
          <span className="readout-val" style={{ color }}>
            {noteInfo
              ? (noteInfo.cents === 0 ? '±0¢'
                : noteInfo.cents > 0  ? `+${noteInfo.cents}¢`
                : `${noteInfo.cents}¢`)
              : '—'}
          </span>
          <span className="readout-label">
            {status === 'intune' ? '✓ In Tune' :
             status === 'close'  ? 'Almost...'  :
             noteInfo?.cents > 0 ? '▲ Sharp'   :
             noteInfo?.cents < 0 ? '▼ Flat'    : 'Cents'}
          </span>
        </div>
      </div>

      {!active && !error && !blocked && (
        <p className="tuner__hint">Press Start, play a note, and hold it steady.</p>
      )}
    </div>
  )
}
