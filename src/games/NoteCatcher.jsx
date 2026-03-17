import { useEffect, useRef, useState } from 'react'
import './games.css'

const W          = 360, H = 500
const CATCHER_W  = 64
const CATCHER_SPD = 5
const NOTE_SYMS  = ['♩', '♪', '♫', '♬']
const NOTE_COLORS = ['#ffd700', '#4ade80', '#38bdf8', '#f472b6']
const NOTE_PTS    = [1, 2, 3, 4]

// ── Audio singleton ───────────────────────────────────────
let _ac = null
function getAC() {
  if (!_ac || _ac.state === 'closed') {
    _ac = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (_ac.state === 'suspended') _ac.resume()
  return _ac
}

function playCatchSound(pts) {
  try {
    const ac  = getAC()
    const now = ac.currentTime
    // Higher pts = higher bell pitch: C5 E5 G5 C6
    const freqs = [523.25, 659.25, 783.99, 1046.50]
    const freq  = freqs[Math.min(pts - 1, 3)]

    // Main bell tone
    const osc  = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, now)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.32, now + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55)
    osc.connect(gain); gain.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.6)

    // Bright upper harmonic sparkle
    const osc2  = ac.createOscillator()
    const gain2 = ac.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(freq * 2.5, now)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.linearRampToValueAtTime(0.10, now + 0.01)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
    osc2.connect(gain2); gain2.connect(ac.destination)
    osc2.start(now); osc2.stop(now + 0.25)
  } catch (_) {}
}

function playMissSound() {
  try {
    const ac  = getAC()
    const now = ac.currentTime
    const osc  = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(98, now)   // G2 — deep low thud
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.40, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85)
    osc.connect(gain); gain.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.9)
  } catch (_) {}
}

// ── Component ─────────────────────────────────────────────
export default function NoteCatcher() {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const gsRef     = useRef({
    phase:   'idle',
    catcher: { x: W / 2 },
    notes:   [],
    frame:   0,
    score:   0,
    lives:   3,
    speed:   1.8,
    keys:    { left: false, right: false },
  })
  const actionRef = useRef(null)
  const [uiPhase, setUiPhase] = useState('idle')
  const [uiBest,  setUiBest]  = useState(() => +localStorage.getItem('pr_catcher_best') || 0)

  actionRef.current = () => {
    const g = gsRef.current
    if (g.phase === 'idle' || g.phase === 'dead') {
      g.catcher = { x: W / 2 }
      g.notes   = []
      g.frame   = 0
      g.score   = 0
      g.lives   = 3
      g.speed   = 1.8
      g.phase   = 'playing'
      setUiPhase('playing')
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    const drawBg = () => {
      ctx.fillStyle = '#0d1520'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'
      ctx.lineWidth = 1
      for (let sy = 20; sy < H - 60; sy += 52) {
        for (let l = 0; l < 5; l++) {
          ctx.beginPath()
          ctx.moveTo(0, sy + l * 8)
          ctx.lineTo(W, sy + l * 8)
          ctx.stroke()
        }
      }
    }

    const draw = () => {
      const g = gsRef.current
      drawBg()

      if (g.phase === 'idle') {
        ctx.font = '50px serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🎵', W / 2, H / 2 - 52)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 22px system-ui, sans-serif'
        ctx.fillText('Note Catcher', W / 2, H / 2 + 10)
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = '14px system-ui, sans-serif'
        ctx.fillText('Tap / Arrow keys to play', W / 2, H / 2 + 46)
        return
      }

      // Draw notes
      for (const n of g.notes) {
        ctx.globalAlpha = n.flash > 0 ? n.flash / 8 : 1
        ctx.fillStyle   = n.color
        ctx.font = '26px serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(n.sym, n.x, n.y)
        if (n.flash > 0) {
          ctx.font = `bold ${10 + (8 - n.flash) * 2}px system-ui, sans-serif`
          ctx.fillText(`+${n.pts}`, n.x + 18, n.y - 12)
        }
        ctx.globalAlpha = 1
      }

      // Draw catcher (gold trombone bell ellipse)
      const cx = g.catcher.x, cy = H - 46
      ctx.fillStyle = '#b8860b'
      ctx.beginPath()
      ctx.ellipse(cx, cy + 4, CATCHER_W / 2, 10, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffd700'
      ctx.beginPath()
      ctx.ellipse(cx, cy, CATCHER_W / 2, 10, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffe570'
      ctx.beginPath()
      ctx.ellipse(cx - 8, cy - 3, CATCHER_W / 2 - 20, 4, -0.3, 0, Math.PI * 2)
      ctx.fill()

      // HUD strip
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, H - 26, W, 26)
      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 14px system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`⭐ ${g.score}`, 12, H - 13)
      ctx.textAlign = 'right'
      ctx.fillStyle = g.lives > 1 ? '#f472b6' : '#e94560'
      const heartsStr = Array.from({ length: 3 }, (_, i) => i < g.lives ? '♥' : '♡').join(' ')
      ctx.fillText(heartsStr, W - 10, H - 13)

      if (g.phase === 'dead') {
        ctx.fillStyle = 'rgba(0,0,0,0.62)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 28px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('💀 Game Over', W / 2, H / 2 - 52)
        ctx.font = '20px system-ui, sans-serif'
        ctx.fillStyle = '#ffd700'
        ctx.fillText(`Score: ${g.score}`, W / 2, H / 2 - 10)
        const best = +localStorage.getItem('pr_catcher_best') || 0
        ctx.fillStyle = 'rgba(255,255,255,0.65)'
        ctx.font = '15px system-ui, sans-serif'
        ctx.fillText(`Best: ${best}`, W / 2, H / 2 + 24)
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.font = '14px system-ui, sans-serif'
        ctx.fillText('Tap to try again', W / 2, H / 2 + 58)
      }
    }

    const update = () => {
      const g = gsRef.current
      if (g.phase !== 'playing') return

      g.frame++
      g.speed = 1.8 + g.score * 0.04

      if (g.keys.left)  g.catcher.x = Math.max(CATCHER_W / 2, g.catcher.x - CATCHER_SPD)
      if (g.keys.right) g.catcher.x = Math.min(W - CATCHER_W / 2, g.catcher.x + CATCHER_SPD)

      const interval = Math.max(45, 90 - Math.floor(g.score * 1.5))
      if (g.frame % interval === 0) {
        const i = Math.floor(Math.random() * NOTE_SYMS.length)
        g.notes.push({ id: g.frame + Math.random(), x: 22 + Math.random() * (W - 44), y: -16, sym: NOTE_SYMS[i], color: NOTE_COLORS[i], pts: NOTE_PTS[i], flash: 0 })
      }

      const catchY   = H - 46
      const survived = []
      for (const n of g.notes) {
        if (n.flash > 0) { n.flash--; if (n.flash > 0) survived.push(n); continue }
        n.y += g.speed
        const hit = n.y > catchY - 18 && n.y < catchY + 18 && Math.abs(n.x - g.catcher.x) < CATCHER_W / 2 + 8
        if (hit) {
          g.score += n.pts
          n.flash = 8
          survived.push(n)
          playCatchSound(n.pts)
        } else if (n.y > H) {
          g.lives--
          playMissSound()
          if (g.lives <= 0) {
            g.phase = 'dead'
            setUiPhase('dead')
            const nb = Math.max(+localStorage.getItem('pr_catcher_best') || 0, g.score)
            localStorage.setItem('pr_catcher_best', String(nb))
            setUiBest(nb)
          }
        } else {
          survived.push(n)
        }
      }
      g.notes = survived
    }

    const loop = () => { update(); draw(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    const onKey = e => {
      const g = gsRef.current
      if (e.code === 'ArrowLeft'  || e.code === 'KeyA') { e.preventDefault(); g.keys.left  = true }
      if (e.code === 'ArrowRight' || e.code === 'KeyD') { e.preventDefault(); g.keys.right = true }
      if (e.code === 'Space') { e.preventDefault(); actionRef.current() }
    }
    const onUp = e => {
      const g = gsRef.current
      if (e.code === 'ArrowLeft'  || e.code === 'KeyA') g.keys.left  = false
      if (e.code === 'ArrowRight' || e.code === 'KeyD') g.keys.right = false
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup',   onUp)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onUp) }
  }, [])

  const onTouchStart = () => { if (gsRef.current.phase !== 'playing') actionRef.current() }
  const onTouchMove  = e => {
    if (gsRef.current.phase !== 'playing') return
    e.preventDefault()
    const rect = canvasRef.current.getBoundingClientRect()
    const relX = e.touches[0].clientX - rect.left
    gsRef.current.catcher.x = Math.max(CATCHER_W / 2, Math.min(W - CATCHER_W / 2, relX * (W / rect.width)))
  }

  return (
    <div className="game-wrap">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="game-canvas"
        onClick={() => { if (gsRef.current.phase !== 'playing') actionRef.current() }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      />
      {uiPhase !== 'idle' && <div className="game-stat">🏆 Best: {uiBest}</div>}
      <p className="game-hint">← → or A/D to move catcher</p>
    </div>
  )
}
