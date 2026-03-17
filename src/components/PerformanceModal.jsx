import { useEffect, useRef, useState } from 'react'
import './PerformanceModal.css'

// ── Web Audio crowd-cheer synth ───────────────────────────
function playCrowdCheer() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()

    const now = ctx.currentTime

    // Cheer burst: layered band-passed noise
    const bufLen = ctx.sampleRate * 2.5
    const buf    = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data   = buf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1)

    const src = ctx.createBufferSource()
    src.buffer = buf

    const bp1 = ctx.createBiquadFilter(); bp1.type = 'bandpass'; bp1.frequency.value = 1200; bp1.Q.value = 0.8
    const bp2 = ctx.createBiquadFilter(); bp2.type = 'bandpass'; bp2.frequency.value = 2400; bp2.Q.value = 0.6

    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.35, now + 0.18)
    gain.gain.setValueAtTime(0.35, now + 0.9)
    gain.gain.linearRampToValueAtTime(0, now + 2.4)

    src.connect(bp1); bp1.connect(bp2); bp2.connect(gain); gain.connect(ctx.destination)
    src.start(now)
    src.stop(now + 2.5)

    // Triumphant fanfare: 3 quick ascending notes
    const notes = [523.25, 659.25, 783.99, 1046.5]  // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator()
      const gOsc = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      const t0 = now + i * 0.12
      gOsc.gain.setValueAtTime(0, t0)
      gOsc.gain.linearRampToValueAtTime(0.22, t0 + 0.04)
      gOsc.gain.linearRampToValueAtTime(0, t0 + 0.28)
      osc.connect(gOsc); gOsc.connect(ctx.destination)
      osc.start(t0); osc.stop(t0 + 0.35)
    })

    setTimeout(() => ctx.close(), 3000)
  } catch (_) {}
}

function playLevelUpSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime
    // Sparkling ascending arpeggio — C5 E5 G5 B5 C6, with shimmer
    const notes = [523.25, 659.25, 783.99, 987.77, 1046.5]
    notes.forEach((freq, i) => {
      const t = now + i * 0.10
      // Main note
      const osc = ctx.createOscillator(); const g = ctx.createGain()
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.18, t + 0.03)
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.5)
      osc.connect(g); g.connect(ctx.destination)
      osc.start(t); osc.stop(t + 0.55)
      // Sparkle shimmer (5th above)
      const osc2 = ctx.createOscillator(); const g2 = ctx.createGain()
      osc2.type = 'triangle'; osc2.frequency.setValueAtTime(freq * 1.5, t)
      g2.gain.setValueAtTime(0, t)
      g2.gain.linearRampToValueAtTime(0.06, t + 0.02)
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
      osc2.connect(g2); g2.connect(ctx.destination)
      osc2.start(t); osc2.stop(t + 0.25)
    })
    // Final sustained chord
    const chord = [523.25, 659.25, 783.99]
    chord.forEach(freq => {
      const t = now + 0.55
      const osc = ctx.createOscillator(); const g = ctx.createGain()
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t)
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.12, t + 0.05)
      g.gain.setValueAtTime(0.12, t + 0.6)
      g.gain.exponentialRampToValueAtTime(0.001, t + 1.2)
      osc.connect(g); g.connect(ctx.destination)
      osc.start(t); osc.stop(t + 1.25)
    })
    setTimeout(() => ctx.close(), 2500)
  } catch (_) {}
}

// ── Component ─────────────────────────────────────────────
export default function PerformanceModal({ earned, pet, levelUp, onClose }) {
  const hasPlayed = useRef(false)

  // Lock scroll
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const [showLevelUp, setShowLevelUp] = useState(false)

  // Play cheer once on mount; level-up fanfare fires 1.2s later
  useEffect(() => {
    if (!hasPlayed.current) {
      hasPlayed.current = true
      playCrowdCheer()
      if (levelUp) {
        setTimeout(() => {
          setShowLevelUp(true)
          playLevelUpSound()
        }, 1200)
      }
    }
  }, [])

  // Auto-close after 7s
  useEffect(() => {
    const id = setTimeout(onClose, 7000)
    return () => clearTimeout(id)
  }, [onClose])

  // Escape key
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="perf-overlay" onClick={onClose}>
      {/* Animated stage lights */}
      <div className="perf-lights" onClick={e => e.stopPropagation()}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="perf-light" />
        ))}
      </div>

      {/* Main content */}
      <div className="perf-content" onClick={e => e.stopPropagation()}>
        <div className="perf-title">🎉 Bravo!</div>
        <div className="perf-points">+{earned} ⭐ points earned</div>

        {showLevelUp && levelUp && (
          <div className="perf-levelup">
            <span className="perf-levelup__icon">{levelUp.icon}</span>
            <div className="perf-levelup__text">
              <span className="perf-levelup__name">{levelUp.name}</span>
              <span className="perf-levelup__label">leveled up to <strong>Level {levelUp.level}</strong>! 🌟</span>
            </div>
          </div>
        )}

        <div className="perf-notes">♩ ♪ ♫ ♬</div>

        {/* Pet cheering in the "crowd" */}
        {pet ? (
          <div>
            <div className="perf-crowd">
              <span className="perf-crowd-emoji">🙌</span>
              <span className="perf-crowd-emoji">👏</span>
              <span className="perf-pet">{pet.icon}</span>
              <span className="perf-crowd-emoji">👏</span>
              <span className="perf-crowd-emoji">🙌</span>
            </div>
            <div className="perf-pet-name">{pet.name} is cheering for you!</div>
          </div>
        ) : (
          <div className="perf-crowd">
            <span className="perf-crowd-emoji">🙌</span>
            <span className="perf-crowd-emoji">👏</span>
            <span className="perf-crowd-emoji">🎊</span>
            <span className="perf-crowd-emoji">👏</span>
            <span className="perf-crowd-emoji">🙌</span>
          </div>
        )}

        <button className="perf-close" onClick={onClose}>
          That's a wrap! 🎺
        </button>
      </div>
    </div>
  )
}
