import { useState, useRef, useEffect } from 'react'
import * as Tone from 'tone'
import { useApp } from '../context/AppContext'
import './Recorder.css'

function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  return types.find(t => MediaRecorder.isTypeSupported(t)) || ''
}

function formatDur(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0')
  const s = (secs % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function formatTimestamp(iso) {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit'
  })
}

let recIdCounter = 0

export default function Recorder({ micOwner, setMicOwner }) {
  const { recordings, addRecording, removeRecording } = useApp()

  const [recording,  setRecording]  = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [playingId,  setPlayingId]  = useState(null)
  const [error,      setError]      = useState(null)
  const [blocked,    setBlocked]    = useState(false)

  const mediaRecRef    = useRef(null)
  const streamRef      = useRef(null)
  const chunksRef      = useRef([])
  const timerRef       = useRef(null)
  const audioRefs      = useRef({})
  const micSourceRef   = useRef(null)
  const recordDestRef  = useRef(null)
  const toneLinkedRef  = useRef(false)
  const mimeTypeRef    = useRef('')

  // Cleanup on unmount
  useEffect(() => () => {
    stopRecording()
    streamRef.current?.getTracks().forEach(t => t.stop())
  }, [])

  const startRecording = async () => {
    if (micOwner === 'tuner') {
      setBlocked(true)
      setTimeout(() => setBlocked(false), 3000)
      return
    }
    setError(null)
    setBlocked(false)
    try {
      // Disable all voice-call processing — critical for instrument recording quality
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation:  false,
          noiseSuppression:  false,
          autoGainControl:   false,
          sampleRate:        48000,
          channelCount:      1,
        },
      })
      streamRef.current = micStream
      chunksRef.current = []

      // Mix mic + Tone.js (metronome) into one recording stream via Web Audio
      await Tone.start()
      const toneCtx = Tone.getContext().rawContext

      // Mic → AudioContext source
      const micSource = toneCtx.createMediaStreamSource(micStream)
      micSourceRef.current = micSource

      // Destination node whose .stream we'll record
      const recordDest = toneCtx.createMediaStreamDestination()
      recordDestRef.current = recordDest

      micSource.connect(recordDest)

      // Tap Tone.js master output → same destination so metronome is mixed in digitally
      Tone.getDestination().connect(recordDest)
      toneLinkedRef.current = true

      const mimeType = getSupportedMimeType()
      mimeTypeRef.current = mimeType

      const durationRef = { val: 0 }
      const mr = new MediaRecorder(recordDest.stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 128000,
      })
      mediaRecRef.current = mr

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
        const url  = URL.createObjectURL(blob)
        const id   = ++recIdCounter
        addRecording({ id, url, blob, timestamp: new Date().toISOString(), durationSecs: durationRef.val })
        micStream.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }

      mr.start(100)
      setMicOwner('recorder')
      setRecording(true)
      setRecSeconds(0)
      durationRef.val = 0

      timerRef.current = setInterval(() => {
        setRecSeconds(s => { durationRef.val = s + 1; return s + 1 })
      }, 1000)
    } catch {
      setError('Microphone access denied. Check your browser permissions.')
    }
  }

  const stopRecording = () => {
    clearInterval(timerRef.current)
    // Disconnect Tone.js from recording destination
    if (toneLinkedRef.current && recordDestRef.current) {
      try { Tone.getDestination().disconnect(recordDestRef.current) } catch {}
      toneLinkedRef.current = false
    }
    if (micSourceRef.current) {
      try { micSourceRef.current.disconnect() } catch {}
      micSourceRef.current = null
    }
    recordDestRef.current = null
    if (mediaRecRef.current?.state !== 'inactive') {
      mediaRecRef.current?.stop()
    }
    setRecording(false)
    setMicOwner(null)
  }

  const playRecording = (rec) => {
    Object.values(audioRefs.current).forEach(a => { a?.pause(); a && (a.currentTime = 0) })
    setPlayingId(null)
    const audio = audioRefs.current[rec.id]
    if (!audio) return
    audio.play()
    setPlayingId(rec.id)
    audio.onended = () => setPlayingId(null)
  }

  const pausePlayback = (id) => {
    audioRefs.current[id]?.pause()
    setPlayingId(null)
  }

  const deleteRecording = (id) => {
    audioRefs.current[id]?.pause()
    delete audioRefs.current[id]
    removeRecording(id)
    if (playingId === id) setPlayingId(null)
  }

  const downloadRecording = (rec) => {
    const a = document.createElement('a')
    a.href = rec.url
    a.download = `practice-recording-${rec.id}.webm`
    a.click()
  }

  const shareRecording = async (rec) => {
    // Try native share sheet (great on mobile)
    if (navigator.canShare) {
      const file = new File([rec.blob], `practice-${rec.id}.webm`, { type: 'audio/webm' })
      if (navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: 'Practice Recording',
            text: `My practice recording — ${new Date(rec.timestamp).toLocaleDateString()}`,
            files: [file],
          })
          return
        } catch (e) {
          if (e.name === 'AbortError') return  // user cancelled — do nothing
        }
      }
    }
    // Desktop fallback: download the file
    downloadRecording(rec)
  }

  return (
    <div className="recorder">
      <div className="recorder__header">
        <span className="recorder__title">Recorder</span>
        {recordings.length > 0 && (
          <span className="recorder__count">{recordings.length} take{recordings.length > 1 ? 's' : ''}</span>
        )}
      </div>

      {blocked && (
        <div className="studio-conflict">
          🎙 Tuner is using the mic — stop it first.
        </div>
      )}

      {error && <div className="recorder__error">{error}</div>}

      <div className="recorder__control">
        {!recording ? (
          <button className="rec-btn" onClick={startRecording}>
            <span className="rec-btn__dot" />
            Record
          </button>
        ) : (
          <div className="recorder__live">
            <div className="rec-live-indicator">
              <span className="rec-live-dot" />
              <span className="rec-live-label">REC</span>
            </div>
            <span className="rec-timer">{formatDur(recSeconds)}</span>
            <button className="stop-btn" onClick={stopRecording}>⏹ Stop</button>
          </div>
        )}
      </div>

      {recordings.length === 0 ? (
        <div className="recorder__empty">
          <p>Hit Record, play something, then stop. Your takes appear here for playback.</p>
          <p className="recorder__device-note">📱 Recordings are saved on this device only — they won't sync to your teacher yet.</p>
        </div>
      ) : (
        <div className="recordings-list">
          {recordings.map((rec, idx) => (
            <div key={rec.id} className="rec-row">
              <audio
                ref={el => { if (el) audioRefs.current[rec.id] = el }}
                src={rec.url}
                preload="none"
              />

              <div className="rec-row__meta">
                <span className="rec-row__name">Take {recordings.length - idx}</span>
                <span className="rec-row__time">{formatTimestamp(rec.timestamp)}</span>
                <span className="rec-row__dur">{formatDur(rec.durationSecs)}</span>
              </div>

              <div className="rec-row__actions">
                {playingId === rec.id ? (
                  <button className="rec-action-btn rec-action-btn--pause" onClick={() => pausePlayback(rec.id)} title="Pause">⏸</button>
                ) : (
                  <button className="rec-action-btn rec-action-btn--play" onClick={() => playRecording(rec)} title="Play">▶</button>
                )}
                <button className="rec-action-btn" onClick={() => downloadRecording(rec)} title="Download">⬇</button>
                <button className="rec-action-btn rec-action-btn--delete" onClick={() => deleteRecording(rec.id)} title="Delete">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
