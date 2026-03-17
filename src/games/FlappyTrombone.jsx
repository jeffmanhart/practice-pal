import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'
import './games.css'

const W = 360, H = 500
const GRAVITY    = 0.48
const FLAP_V     = -9.2
const PIPE_W     = 56
const PIPE_GAP   = 158
const PIPE_EVERY = 112   // frames between pipes
const INVINCIBLE_FRAMES = 110  // ~1.8s of invincibility after losing a life

// ── Audio singleton ───────────────────────────────────────
let _ac = null
function getAC() {
  if (!_ac || _ac.state === 'closed') {
    _ac = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (_ac.state === 'suspended') _ac.resume()
  return _ac
}

function playHitSound() {
  try {
    const ac  = getAC()
    const now = ac.currentTime
    const osc  = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(160, now)
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.28)
    gain.gain.setValueAtTime(0.38, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)
    osc.connect(gain); gain.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.35)
  } catch (_) {}
}

// ── Component ─────────────────────────────────────────────
export default function FlappyTrombone() {
  const { relockGame } = useApp()
  const relockRef = useRef(relockGame)
  relockRef.current = relockGame   // keep fresh every render

  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const gsRef     = useRef({
    phase:      'idle',
    bird:       { x: 88, y: H / 2, vy: 0 },
    pipes:      [],
    frame:      0,
    score:      0,
    speed:      2.4,
    lives:      3,
    invincible: 0,
    outOfLives: false,
  })
  const actionRef = useRef(null)
  const [uiPhase, setUiPhase] = useState('idle')
  const [uiBest,  setUiBest]  = useState(() => +localStorage.getItem('pr_flappy_best') || 0)

  // Always keep actionRef fresh
  actionRef.current = () => {
    const g = gsRef.current
    if (g.phase === 'idle') {
      g.bird       = { x: 88, y: H / 2, vy: -3 }
      g.pipes      = []
      g.frame      = 0
      g.score      = 0
      g.speed      = 2.4
      g.lives      = 3
      g.invincible = 0
      g.outOfLives = false
      g.phase      = 'playing'
      setUiPhase('playing')
    } else if (g.phase === 'playing') {
      g.bird.vy = FLAP_V
    }
    // 'dead' with outOfLives: do nothing — game is re-locked
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    const drawBg = () => {
      ctx.fillStyle = '#0d1520'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = 'rgba(255,255,255,0.035)'
      ctx.lineWidth = 1
      for (let sy = 20; sy < H; sy += 52) {
        for (let l = 0; l < 5; l++) {
          ctx.beginPath()
          ctx.moveTo(0, sy + l * 8)
          ctx.lineTo(W, sy + l * 8)
          ctx.stroke()
        }
      }
    }

    const drawPipe = (pipe) => {
      const botY = pipe.topH + PIPE_GAP
      ctx.fillStyle = '#15386b'
      ctx.fillRect(pipe.x, 0, PIPE_W, pipe.topH - 16)
      ctx.fillStyle = '#1f52a0'
      ctx.fillRect(pipe.x - 5, pipe.topH - 22, PIPE_W + 10, 22)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(pipe.x + 4, 0, 4, pipe.topH - 16)
      ctx.fillStyle = '#15386b'
      ctx.fillRect(pipe.x, botY + 16, PIPE_W, H - botY - 16)
      ctx.fillStyle = '#1f52a0'
      ctx.fillRect(pipe.x - 5, botY, PIPE_W + 10, 22)
      ctx.fillStyle = 'rgba(255,255,255,0.06)'
      ctx.fillRect(pipe.x + 4, botY + 16, 4, H - botY - 16)
      if (pipe.topH > 40) {
        ctx.fillStyle = 'rgba(255,255,255,0.11)'
        ctx.font = '14px serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('♩', pipe.x + PIPE_W / 2, pipe.topH / 2)
      }
    }

    const drawBird = (b, invincible) => {
      // Flash bird while invincible (every 6 frames)
      if (invincible > 0 && Math.floor(invincible / 6) % 2 === 0) return
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(Math.max(-0.45, Math.min(0.7, b.vy * 0.055)))
      ctx.font = '32px serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('🎺', 0, 0)
      ctx.restore()
    }

    const drawHUD = (g) => {
      // Score pill at top
      ctx.fillStyle = 'rgba(0,0,0,0.45)'
      ctx.beginPath()
      ctx.arc(W / 2 - 30, 34, 18, Math.PI / 2, -Math.PI / 2)
      ctx.arc(W / 2 + 30, 34, 18, -Math.PI / 2, Math.PI / 2)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 22px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(g.score, W / 2, 34)

      // Hearts strip at bottom
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, H - 26, W, 26)
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = g.lives > 1 ? '#f472b6' : '#e94560'
      ctx.font = 'bold 14px system-ui, sans-serif'
      const heartsStr = Array.from({ length: 3 }, (_, i) => i < g.lives ? '♥' : '♡').join(' ')
      ctx.fillText(heartsStr, W - 10, H - 13)
    }

    const draw = () => {
      const g = gsRef.current
      drawBg()

      if (g.phase === 'idle') {
        ctx.font = '52px serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🎺', W / 2, H / 2 - 52)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 22px system-ui, sans-serif'
        ctx.fillText('Flappy Trombone', W / 2, H / 2 + 10)
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.font = '14px system-ui, sans-serif'
        ctx.fillText('Tap or press Space to start', W / 2, H / 2 + 46)
        return
      }

      g.pipes.forEach(drawPipe)
      drawBird(g.bird, g.invincible)
      drawHUD(g)

      if (g.phase === 'dead') {
        ctx.fillStyle = 'rgba(0,0,0,0.72)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 28px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('💀 Game Over', W / 2, H / 2 - 60)
        ctx.font = '20px system-ui, sans-serif'
        ctx.fillStyle = '#ffd700'
        ctx.fillText(`Score: ${g.score}`, W / 2, H / 2 - 18)
        const best = +localStorage.getItem('pr_flappy_best') || 0
        ctx.fillStyle = 'rgba(255,255,255,0.65)'
        ctx.font = '15px system-ui, sans-serif'
        ctx.fillText(`Best: ${best}`, W / 2, H / 2 + 18)
        ctx.fillStyle = '#f472b6'
        ctx.font = 'bold 14px system-ui, sans-serif'
        ctx.fillText('No lives left! Unlock more in Rewards.', W / 2, H / 2 + 58)
      }
    }

    const update = () => {
      const g = gsRef.current
      if (g.phase !== 'playing') return

      g.frame++
      g.bird.vy += GRAVITY
      g.bird.y  += g.bird.vy
      g.speed = 2.4 + g.score * 0.08

      if (g.frame % PIPE_EVERY === 0) {
        const minTop = 55, maxTop = H - PIPE_GAP - 55
        g.pipes.push({ x: W + 16, topH: minTop + Math.random() * (maxTop - minTop), scored: false })
      }

      for (const p of g.pipes) {
        p.x -= g.speed
        if (!p.scored && p.x + PIPE_W < g.bird.x) { p.scored = true; g.score++ }
      }
      g.pipes = g.pipes.filter(p => p.x > -80)

      // Collision
      const bx = g.bird.x - 13, by = g.bird.y - 11, bw = 26, bh = 22
      const dead =
        g.bird.y + 16 > H ||
        g.bird.y - 16 < 0 ||
        g.pipes.some(p =>
          !(bx + bw < p.x || bx > p.x + PIPE_W) &&
          (by < p.topH - 14 || by + bh > p.topH + PIPE_GAP + 14)
        )

      if (dead && g.invincible === 0) {
        g.lives--
        playHitSound()
        if (g.lives <= 0) {
          // All lives gone — game over and re-lock
          g.phase      = 'dead'
          g.outOfLives = true
          setUiPhase('dead')
          const nb = Math.max(+localStorage.getItem('pr_flappy_best') || 0, g.score)
          localStorage.setItem('pr_flappy_best', String(nb))
          setUiBest(nb)
          relockRef.current('flappy')
        } else {
          // Respawn with invincibility
          g.bird.y     = H / 2
          g.bird.vy    = -3
          g.invincible = INVINCIBLE_FRAMES
        }
      }

      if (g.invincible > 0) g.invincible--
    }

    const loop = () => { update(); draw(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  useEffect(() => {
    const onKey = e => {
      if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); actionRef.current() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="game-wrap">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="game-canvas"
        onClick={() => actionRef.current()}
      />
      {uiPhase !== 'idle' && <div className="game-stat">🏆 Best: {uiBest}</div>}
      <p className="game-hint">Tap / Space to flap</p>
    </div>
  )
}
