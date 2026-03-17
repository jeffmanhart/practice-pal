import { useState, useEffect, useRef, useCallback } from 'react'
import * as Tone from 'tone'
import './Metronome.css'

const TIME_SIGNATURES = [
  { label: '2/4', beats: 2 },
  { label: '3/4', beats: 3 },
  { label: '4/4', beats: 4 },
  { label: '6/8', beats: 6 },
]

export default function Metronome({ skinColor }) {
  const [bpm, setBpm] = useState(80)
  const [bpmText, setBpmText] = useState('80')
  const [isPlaying, setIsPlaying] = useState(false)
  const [timeSig, setTimeSig] = useState(TIME_SIGNATURES[2]) // 4/4 default
  const [currentBeat, setCurrentBeat] = useState(0)
  const [tapTimes, setTapTimes] = useState([])

  const clickHigh = useRef(null)
  const clickLow = useRef(null)
  const loopRef = useRef(null)
  const beatRef = useRef(0)

  // Build synths once
  useEffect(() => {
    clickHigh.current = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
      volume: -6,
    }).toDestination()

    clickLow.current = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.05 },
      volume: -10,
    }).toDestination()

    return () => {
      clickHigh.current?.dispose()
      clickLow.current?.dispose()
      loopRef.current?.dispose()
      Tone.getTransport().stop()
    }
  }, [])

  const stopMetronome = useCallback(() => {
    loopRef.current?.stop()
    loopRef.current?.dispose()
    loopRef.current = null
    Tone.getTransport().stop()
    beatRef.current = 0
    setCurrentBeat(0)
    setIsPlaying(false)
  }, [])

  const startMetronome = useCallback(async () => {
    await Tone.start()
    Tone.getTransport().bpm.value = bpm

    beatRef.current = 0

    loopRef.current = new Tone.Sequence(
      (time) => {
        const beat = beatRef.current
        if (beat === 0) {
          clickHigh.current.triggerAttackRelease('C5', '32n', time)
        } else {
          clickLow.current.triggerAttackRelease('G4', '32n', time)
        }
        // Update UI on next tick (can't set state inside Tone callback directly)
        Tone.getDraw().schedule(() => {
          setCurrentBeat(beat)
        }, time)
        beatRef.current = (beat + 1) % timeSig.beats
      },
      [...Array(timeSig.beats).keys()],
      '4n'
    )

    loopRef.current.start(0)
    Tone.getTransport().start()
    setIsPlaying(true)
  }, [bpm, timeSig])

  const toggle = () => {
    if (isPlaying) {
      stopMetronome()
    } else {
      startMetronome()
    }
  }

  // Restart when BPM or time sig changes while playing
  useEffect(() => {
    if (isPlaying) {
      stopMetronome()
      // Small delay to let cleanup finish
      const t = setTimeout(() => startMetronome(), 50)
      return () => clearTimeout(t)
    }
  }, [bpm, timeSig]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep bpmText display in sync when bpm changes externally (tap tempo, slider)
  useEffect(() => { setBpmText(String(bpm)) }, [bpm])

  const handleBpmTextChange = (e) => {
    setBpmText(e.target.value)
    const v = parseInt(e.target.value, 10)
    if (!isNaN(v) && v >= 30 && v <= 200) setBpm(v)
  }

  const handleBpmBlur = () => {
    const v = parseInt(bpmText, 10)
    const clamped = isNaN(v) ? bpm : Math.min(200, Math.max(30, v))
    setBpm(clamped)
    setBpmText(String(clamped))
  }

  const handleBpmKeyDown = (e) => {
    if (e.key === 'Enter') e.target.blur()
  }

  // Tap tempo
  const handleTap = () => {
    const now = Date.now()
    setTapTimes(prev => {
      const recent = [...prev, now].filter(t => now - t < 3000).slice(-6)
      if (recent.length >= 2) {
        const intervals = recent.slice(1).map((t, i) => t - recent[i])
        const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
        const newBpm = Math.round(60000 / avg)
        setBpm(Math.min(200, Math.max(30, newBpm)))
      }
      return recent
    })
  }

  return (
    <div className="metronome" style={skinColor ? { '--beat-color': skinColor } : undefined}>
      <div className="metronome__header">
        <span className="metronome__title">Metronome</span>
      </div>

      {/* Beat dots */}
      <div className="metronome__beats">
        {Array.from({ length: timeSig.beats }).map((_, i) => (
          <div
            key={i}
            className={`beat-dot ${i === currentBeat && isPlaying ? 'beat-dot--active' : ''} ${i === 0 ? 'beat-dot--accent' : ''}`}
          />
        ))}
      </div>

      {/* BPM display + slider */}
      <div className="metronome__bpm-row">
        <input
          type="number"
          className="metronome__bpm-input"
          value={bpmText}
          min={30}
          max={200}
          onChange={handleBpmTextChange}
          onBlur={handleBpmBlur}
          onKeyDown={handleBpmKeyDown}
          onWheel={e => e.currentTarget.blur()}
          aria-label="BPM"
        />
        <span className="metronome__bpm-unit">BPM</span>
      </div>
      <input
        type="range"
        className="metronome__slider"
        min={30}
        max={200}
        value={bpm}
        onChange={e => setBpm(Number(e.target.value))}
      />
      <div className="metronome__bpm-labels">
        <span>30</span>
        <span>Slow ← → Fast</span>
        <span>200</span>
      </div>

      {/* Time signature */}
      <div className="metronome__timesig">
        {TIME_SIGNATURES.map(ts => (
          <button
            key={ts.label}
            className={`timesig-btn ${timeSig.label === ts.label ? 'timesig-btn--active' : ''}`}
            onClick={() => setTimeSig(ts)}
          >
            {ts.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="metronome__controls">
        <button className="tap-btn" onClick={handleTap}>
          Tap Tempo
        </button>
        <button
          className={`play-btn ${isPlaying ? 'play-btn--stop' : ''}`}
          onClick={toggle}
        >
          {isPlaying ? '⏹ Stop' : '▶ Start'}
        </button>
      </div>
    </div>
  )
}
