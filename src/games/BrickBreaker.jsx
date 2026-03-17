import { useEffect, useRef, useState } from 'react'
import './games.css'

const W          = 360, H = 520
const PADDLE_W   = 70, PADDLE_H = 10, PADDLE_Y = H - 38
const BALL_R     = 7
const BRICK_COLS = 7, BRICK_ROWS = 5
const BRICK_W    = 44, BRICK_H = 18, BRICK_PAD = 4
const BRICK_OFF_X = Math.round((W - (BRICK_COLS * (BRICK_W + BRICK_PAD) - BRICK_PAD)) / 2)
const BRICK_OFF_Y = 52
const INIT_SPEED  = 3.6
const MAX_SPEED   = 9

// ── Row notes: C major pentatonic, one pitch per row ─────────
// Row 0 (top, hardest) = highest note; row 4 (bottom) = lowest
// Any combination always sounds musical — no sequencing needed
const ROW_NOTES = [
  1046.5,  // C6  — top row
   783.99, // G5
   659.25, // E5
   523.25, // C5
   392.0,  // G4  — bottom row
]

// ── Audio ─────────────────────────────────────────────────────
let _ac = null
function getAC() {
  if (!_ac || _ac.state === 'closed') {
    _ac = new (window.AudioContext || window.webkitAudioContext)()
  }
  if (_ac.state === 'suspended') _ac.resume()
  return _ac
}

function playBrickNote(freq) {
  try {
    const ac = getAC(), now = ac.currentTime
    // Main tone
    const osc  = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.22, now + 0.012)
    gain.gain.setValueAtTime(0.22, now + 0.14)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.30)
    osc.connect(gain); gain.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.32)
    // Soft upper harmonic
    const osc2  = ac.createOscillator()
    const gain2 = ac.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(freq * 2, now)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.linearRampToValueAtTime(0.07, now + 0.01)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
    osc2.connect(gain2); gain2.connect(ac.destination)
    osc2.start(now); osc2.stop(now + 0.16)
  } catch (_) {}
}

function playPaddleHit() {
  try {
    const ac = getAC(), now = ac.currentTime
    const osc = ac.createOscillator(); const gain = ac.createGain()
    osc.type = 'sine'; osc.frequency.setValueAtTime(260, now)
    gain.gain.setValueAtTime(0.09, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
    osc.connect(gain); gain.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.08)
  } catch (_) {}
}

function playLoseBall() {
  try {
    const ac = getAC(), now = ac.currentTime
    const osc = ac.createOscillator(); const gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(110, now)
    osc.frequency.linearRampToValueAtTime(55, now + 0.5)
    gain.gain.setValueAtTime(0.28, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5)
    osc.connect(gain); gain.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.55)
  } catch (_) {}
}

// ── Brick factory ─────────────────────────────────────────────
const ROW_COLORS = ['#e94560','#f97316','#fbbf24','#4ade80','#38bdf8']

function makeBricks() {
  const bricks = []
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: BRICK_OFF_X + c * (BRICK_W + BRICK_PAD),
        y: BRICK_OFF_Y + r * (BRICK_H + BRICK_PAD),
        alive: true,
        color: ROW_COLORS[r],
        row: r,
      })
    }
  }
  return bricks
}

// ── Component ─────────────────────────────────────────────────
export default function BrickBreaker() {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const gsRef     = useRef({
    phase:   'idle',
    paddle:  { x: W / 2 },
    ball:    { x: W / 2, y: PADDLE_Y - BALL_R - 2, vx: 2.2, vy: -INIT_SPEED },
    bricks:  makeBricks(),
    lives:   3,
    score:   0,
    frame:   0,
    wave:    0,
    keys:    { left: false, right: false },
  })
  const actionRef  = useRef(null)
  const [uiPhase,  setUiPhase]  = useState('idle')
  const [uiBest,   setUiBest]   = useState(() => +localStorage.getItem('pr_breaker_best') || 0)

  actionRef.current = () => {
    const g = gsRef.current
    if (g.phase === 'idle' || g.phase === 'dead') {
      g.paddle  = { x: W / 2 }
      g.ball    = { x: W / 2, y: PADDLE_Y - BALL_R - 2, vx: 2.2, vy: -INIT_SPEED }
      g.bricks  = makeBricks()
      g.lives   = 3
      g.score   = 0
      g.frame   = 0
      g.wave    = 0
      g.phase   = 'playing'
      setUiPhase('playing')
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')

    const drawBg = () => {
      ctx.fillStyle = '#08101c'
      ctx.fillRect(0, 0, W, H)
      // Subtle grid lines
      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += 40) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
      }
      for (let y = 0; y < H; y += 40) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
      }
    }

    const roundRect = (x, y, w, h, r) => {
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
    }

    const draw = () => {
      const g = gsRef.current
      drawBg()

      if (g.phase === 'idle') {
        ctx.font = '52px serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('🎼', W / 2, H / 2 - 62)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 22px system-ui, sans-serif'
        ctx.fillText('Symphony Breaker', W / 2, H / 2 - 12)
        ctx.fillStyle = 'rgba(255,255,255,0.45)'
        ctx.font = '13px system-ui, sans-serif'
        ctx.fillText('Each brick plays the next note!', W / 2, H / 2 + 22)
        ctx.fillText('Tap / Space to start', W / 2, H / 2 + 46)
        return
      }

      // Bricks
      for (const b of g.bricks) {
        if (!b.alive) continue
        ctx.fillStyle = b.color
        roundRect(b.x, b.y, BRICK_W, BRICK_H, 4); ctx.fill()
        // Highlight sheen
        ctx.fillStyle = 'rgba(255,255,255,0.22)'
        roundRect(b.x + 3, b.y + 2, BRICK_W - 6, BRICK_H / 2 - 2, 3); ctx.fill()
      }

      // Ball glow
      const grd = ctx.createRadialGradient(g.ball.x, g.ball.y, 1, g.ball.x, g.ball.y, BALL_R * 3)
      grd.addColorStop(0, 'rgba(255,255,255,0.18)')
      grd.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = grd
      ctx.beginPath()
      ctx.arc(g.ball.x, g.ball.y, BALL_R * 3, 0, Math.PI * 2)
      ctx.fill()
      // Ball
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(g.ball.x, g.ball.y, BALL_R, 0, Math.PI * 2)
      ctx.fill()

      // Paddle
      const px = g.paddle.x
      ctx.fillStyle = '#2563eb'
      roundRect(px - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H, 5); ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.28)'
      roundRect(px - PADDLE_W / 2 + 4, PADDLE_Y + 2, PADDLE_W - 8, PADDLE_H / 2 - 1, 3); ctx.fill()

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, H - 26, W, 26)
      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 13px system-ui, sans-serif'
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(`⭐ ${g.score}`, 10, H - 13)
      ctx.textAlign = 'right'
      ctx.fillStyle = g.lives > 1 ? '#f472b6' : '#e94560'
      ctx.font = 'bold 14px system-ui, sans-serif'
      ctx.fillText(Array.from({ length: 3 }, (_, i) => i < g.lives ? '♥' : '♡').join(' '), W - 10, H - 13)

      if (g.phase === 'dead') {
        ctx.fillStyle = 'rgba(0,0,0,0.68)'
        ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 28px system-ui, sans-serif'
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText('💀 Game Over', W / 2, H / 2 - 54)
        ctx.fillStyle = '#ffd700'
        ctx.font = '20px system-ui, sans-serif'
        ctx.fillText(`Score: ${g.score}`, W / 2, H / 2 - 12)
        const best = +localStorage.getItem('pr_breaker_best') || 0
        ctx.fillStyle = 'rgba(255,255,255,0.55)'
        ctx.font = '14px system-ui, sans-serif'
        ctx.fillText(`Best: ${best}`, W / 2, H / 2 + 22)
        ctx.fillStyle = 'rgba(255,255,255,0.38)'
        ctx.fillText('Tap to try again', W / 2, H / 2 + 56)
      }
    }

    const update = () => {
      const g = gsRef.current
      if (g.phase !== 'playing') return
      g.frame++

      // Paddle input
      if (g.keys.left)  g.paddle.x = Math.max(PADDLE_W / 2, g.paddle.x - 5)
      if (g.keys.right) g.paddle.x = Math.min(W - PADDLE_W / 2, g.paddle.x + 5)

      // Ball
      g.ball.x += g.ball.vx
      g.ball.y += g.ball.vy

      // Wall bounces
      if (g.ball.x - BALL_R < 0) {
        g.ball.x = BALL_R; g.ball.vx = Math.abs(g.ball.vx)
      }
      if (g.ball.x + BALL_R > W) {
        g.ball.x = W - BALL_R; g.ball.vx = -Math.abs(g.ball.vx)
      }
      if (g.ball.y - BALL_R < 0) {
        g.ball.y = BALL_R; g.ball.vy = Math.abs(g.ball.vy)
      }

      // Ball lost
      if (g.ball.y - BALL_R > H) {
        g.lives--
        playLoseBall()
        if (g.lives <= 0) {
          g.phase = 'dead'
          setUiPhase('dead')
          const nb = Math.max(+localStorage.getItem('pr_breaker_best') || 0, g.score)
          localStorage.setItem('pr_breaker_best', String(nb))
          setUiBest(nb)
        } else {
          g.ball = { x: g.paddle.x, y: PADDLE_Y - BALL_R - 2, vx: 2.2, vy: -INIT_SPEED }
        }
        return
      }

      // Paddle bounce
      const pdx = g.ball.x - g.paddle.x
      if (
        g.ball.vy > 0 &&
        g.ball.y + BALL_R >= PADDLE_Y &&
        g.ball.y + BALL_R <= PADDLE_Y + PADDLE_H + 5 &&
        Math.abs(pdx) < PADDLE_W / 2 + BALL_R
      ) {
        const spd = Math.sqrt(g.ball.vx ** 2 + g.ball.vy ** 2)
        g.ball.vy = -Math.abs(g.ball.vy)
        g.ball.vx = (pdx / (PADDLE_W / 2)) * 4.2
        // Normalise to keep speed
        const newSpd = Math.sqrt(g.ball.vx ** 2 + g.ball.vy ** 2)
        const ratio = spd / newSpd
        g.ball.vx *= ratio
        g.ball.vy *= ratio
        playPaddleHit()
      }

      // Brick collision
      for (const b of g.bricks) {
        if (!b.alive) continue
        if (
          g.ball.x + BALL_R > b.x &&
          g.ball.x - BALL_R < b.x + BRICK_W &&
          g.ball.y + BALL_R > b.y &&
          g.ball.y - BALL_R < b.y + BRICK_H
        ) {
          b.alive = false
          g.score += 10

          // Play the note for this brick's row
          playBrickNote(ROW_NOTES[b.row])

          // Bounce direction: determine which face was hit
          const oL = (g.ball.x + BALL_R) - b.x
          const oR = (b.x + BRICK_W) - (g.ball.x - BALL_R)
          const oT = (g.ball.y + BALL_R) - b.y
          const oB = (b.y + BRICK_H) - (g.ball.y - BALL_R)
          const mH = Math.min(oL, oR)
          const mV = Math.min(oT, oB)
          if (mH < mV) g.ball.vx = -g.ball.vx
          else         g.ball.vy = -g.ball.vy
          break // one brick per frame
        }
      }

      // Wave clear — spawn new bricks + speed up
      if (g.bricks.every(b => !b.alive)) {
        g.wave++
        g.bricks = makeBricks()
        const spd = Math.sqrt(g.ball.vx ** 2 + g.ball.vy ** 2)
        const newSpd = Math.min(spd + 0.35, MAX_SPEED)
        const ratio  = newSpd / spd
        g.ball.vx *= ratio
        g.ball.vy *= ratio
      }
    }

    const loop = () => { update(); draw(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // Keyboard controls
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

  // Mouse / touch paddle
  const setPaddleX = (clientX, rect) => {
    const relX = clientX - rect.left
    gsRef.current.paddle.x = Math.max(PADDLE_W / 2, Math.min(W - PADDLE_W / 2, relX * (W / rect.width)))
  }
  const onMouseMove  = e => { if (gsRef.current.phase === 'playing') setPaddleX(e.clientX, canvasRef.current.getBoundingClientRect()) }
  const onTouchStart = e => { if (gsRef.current.phase !== 'playing') actionRef.current() }
  const onTouchMove  = e => {
    if (gsRef.current.phase !== 'playing') return
    e.preventDefault()
    setPaddleX(e.touches[0].clientX, canvasRef.current.getBoundingClientRect())
  }

  return (
    <div className="game-wrap">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="game-canvas"
        onClick={() => { if (gsRef.current.phase !== 'playing') actionRef.current() }}
        onMouseMove={onMouseMove}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
      />
      {uiPhase !== 'idle' && <div className="game-stat">🏆 Best: {uiBest}</div>}
      <p className="game-hint">← → or A/D or mouse to move paddle</p>
    </div>
  )
}
