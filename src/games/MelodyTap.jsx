import { useEffect, useRef, useState, useCallback } from 'react'
import './games.css'

const W          = 360
const H          = 520
const LANES      = 4
const LANE_W     = W / LANES          // 90
const NOTE_H     = 62
const HIT_Y      = H - 90             // center of hit target
const HIT_WIN    = 40                 // ±px for valid hit
const PERFECT_WIN = 16                // ±px for "Perfect!"
const FALL_SPEED = 3.2
const SPAWN_FRAMES = 44               // frames between note spawns

const LANE_COLORS = ['#e94560', '#f97316', '#4ade80', '#38bdf8']
const LANE_DIM    = ['rgba(233,69,96,0.12)', 'rgba(249,115,22,0.12)',
                     'rgba(74,222,128,0.12)', 'rgba(56,189,248,0.12)']
const LANE_KEYS   = ['A', 'S', 'D', 'F']
const LANE_NAMES  = ['C', 'D', 'E', 'G']
const LANE_FREQS  = [261.63, 293.66, 329.63, 392.0]

// Songs encoded as lane indices 0–3
const SONGS = [
  {
    name: 'Twinkle Twinkle', emoji: '⭐',
    notes: [0,0,3,3,3,3,3, 2,2,2,2,1,1,0, 3,3,2,2,2,2,1,
            3,3,2,2,2,2,1, 0,0,3,3,3,3,3, 2,2,2,2,1,1,0],
  },
  {
    name: 'Ode to Joy', emoji: '🎵',
    notes: [2,2,3,3,3,2,1,0, 0,1,2,2,1,1,
            2,2,3,3,3,2,1,0, 0,1,2,1,0,0],
  },
  {
    name: 'Hot Cross Buns', emoji: '🥐',
    notes: [2,1,0, 2,1,0, 0,0,0,0, 1,1,1,1, 2,1,0],
  },
  {
    name: 'Mary Had a Little Lamb', emoji: '🐑',
    notes: [2,1,0,1,2,2,2, 1,1,1, 2,3,3,
            2,1,0,1,2,2,2, 2,1,1,2,1,0],
  },
]

// ── Audio ─────────────────────────────────────────────────────
let _ac = null
function getAC() {
  if (!_ac || _ac.state === 'closed') _ac = new (window.AudioContext || window.webkitAudioContext)()
  if (_ac.state === 'suspended') _ac.resume()
  return _ac
}

function playLaneNote(lane) {
  try {
    const ac = getAC(), now = ac.currentTime
    const freq = LANE_FREQS[lane]
    const osc = ac.createOscillator(), gain = ac.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, now)
    gain.gain.setValueAtTime(0, now)
    gain.gain.linearRampToValueAtTime(0.28, now + 0.01)
    gain.gain.setValueAtTime(0.28, now + 0.1)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38)
    osc.connect(gain); gain.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.4)
    // Octave harmonic
    const osc2 = ac.createOscillator(), gain2 = ac.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(freq * 2, now)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.linearRampToValueAtTime(0.09, now + 0.008)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    osc2.connect(gain2); gain2.connect(ac.destination)
    osc2.start(now); osc2.stop(now + 0.22)
  } catch (_) {}
}

function playSongComplete() {
  try {
    const ac = getAC(), now = ac.currentTime
    // Ascending arpeggio C D E G C
    const notes = [261.63, 293.66, 329.63, 392.0, 523.25]
    notes.forEach((freq, i) => {
      const t = now + i * 0.1
      const osc = ac.createOscillator(), gain = ac.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(i === 4 ? 0.35 : 0.22, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + (i === 4 ? 0.9 : 0.25))
      osc.connect(gain); gain.connect(ac.destination)
      osc.start(t); osc.stop(t + 1)
    })
  } catch (_) {}
}

function playMissSound() {
  try {
    const ac = getAC(), now = ac.currentTime
    const osc = ac.createOscillator(), gain = ac.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(130, now)
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.18)
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
    osc.connect(gain); gain.connect(ac.destination)
    osc.start(now); osc.stop(now + 0.22)
  } catch (_) {}
}

// ── Game state factory ─────────────────────────────────────────
function makeGS(songIdx) {
  return {
    phase:      'playing',
    songIdx,
    noteQueue:  [...SONGS[songIdx].notes],
    activeNotes:[],
    nextNoteIdx: 0,
    spawnTimer: 20,
    score:      0,
    combo:      0,
    maxCombo:   0,
    hits:       0,
    totalNotes: SONGS[songIdx].notes.length,
    frame:      0,
    feedbacks:  [],
    pressedAge: [0, 0, 0, 0],
    pressedLanes: new Set(),
  }
}

// ── Manual roundRect fallback ──────────────────────────────────
function rrect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y);  ctx.quadraticCurveTo(x + w, y,     x + w, y + r)
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h);  ctx.quadraticCurveTo(x,     y + h, x,     y + h - r)
  ctx.lineTo(x, y + r);      ctx.quadraticCurveTo(x,     y,     x + r, y)
  ctx.closePath()
}

// ── Component ─────────────────────────────────────────────────
export default function MelodyTap() {
  const canvasRef = useRef(null)
  const rafRef    = useRef(null)
  const gsRef     = useRef(null)

  const [uiPhase,  setUiPhase]  = useState('songSelect')
  const [uiScore,  setUiScore]  = useState(0)
  const [uiSong,   setUiSong]   = useState('')
  const [uiBest,   setUiBest]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('pr_melodytap_best') || '{}') } catch { return {} }
  })
  // keep a ref to uiBest so gameover handler can read current value
  const uiBestRef = useRef(uiBest)
  useEffect(() => { uiBestRef.current = uiBest }, [uiBest])

  // ── Hit a lane ───────────────────────────────────────────────
  const hitLane = useCallback((lane) => {
    const g = gsRef.current
    if (!g || g.phase !== 'playing') return

    // Visual press
    g.pressedLanes.add(lane)
    g.pressedAge[lane] = 0

    // Find best hittable note in this lane
    let best = null, bestDist = Infinity
    for (const n of g.activeNotes) {
      if (n.lane !== lane || n.hit || n.missed) continue
      const dist = Math.abs(n.y - HIT_Y)
      if (dist < HIT_WIN && dist < bestDist) { best = n; bestDist = dist }
    }

    if (best) {
      best.hit = true
      const perfect = bestDist < PERFECT_WIN
      const pts = (perfect ? 100 : 50) * (1 + Math.floor(g.combo / 5))
      g.score += pts
      g.combo++
      g.hits++
      if (g.combo > g.maxCombo) g.maxCombo = g.combo
      playLaneNote(lane)
      g.feedbacks.push({
        x: lane * LANE_W + LANE_W / 2,
        y: HIT_Y - 28,
        text: perfect ? '✨ Perfect!' : 'Good',
        color: perfect ? '#ffd700' : '#4ade80',
        age: 0, maxAge: 40,
      })
      setUiScore(g.score)
    }
  }, [])

  // ── Game loop ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const draw = () => {
      const g = gsRef.current

      // Background
      ctx.fillStyle = '#080f1a'
      ctx.fillRect(0, 0, W, H)

      // Lane backgrounds + dividers + labels
      for (let i = 0; i < LANES; i++) {
        const lx = i * LANE_W
        ctx.fillStyle = LANE_DIM[i]
        ctx.fillRect(lx, 0, LANE_W, H)
        // Divider
        ctx.fillStyle = 'rgba(255,255,255,0.05)'
        ctx.fillRect(lx + LANE_W - 1, 0, 1, H)
        // Key label
        ctx.fillStyle = 'rgba(255,255,255,0.28)'
        ctx.font = 'bold 13px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(LANE_KEYS[i], lx + LANE_W / 2, H - 24)
        ctx.fillStyle = 'rgba(255,255,255,0.16)'
        ctx.font = '10px system-ui, sans-serif'
        ctx.fillText(LANE_NAMES[i], lx + LANE_W / 2, H - 10)
      }

      if (!g) return

      // Hit zone bar
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, HIT_Y + NOTE_H / 2)
      ctx.lineTo(W, HIT_Y + NOTE_H / 2)
      ctx.stroke()

      // Hit pads + press flash
      for (let i = 0; i < LANES; i++) {
        const cx = i * LANE_W + LANE_W / 2
        const cy = HIT_Y + NOTE_H / 2

        if (g.pressedLanes.has(i)) {
          const a = Math.max(0, 1 - g.pressedAge[i] / 10)
          ctx.fillStyle = LANE_COLORS[i] + Math.round(a * 80).toString(16).padStart(2, '0')
          ctx.fillRect(i * LANE_W, HIT_Y - HIT_WIN, LANE_W, NOTE_H + HIT_WIN * 2)
        }

        ctx.strokeStyle = LANE_COLORS[i]
        ctx.lineWidth = 3
        ctx.globalAlpha = 0.65
        ctx.beginPath()
        ctx.arc(cx, cy, 20, 0, Math.PI * 2)
        ctx.stroke()
        ctx.globalAlpha = 1
      }

      // Notes
      for (const n of g.activeNotes) {
        if (n.hit) continue
        const nx = n.lane * LANE_W + 4
        const ny = n.y - NOTE_H / 2
        const alpha = n.missed ? Math.max(0, 1 - n.missAge / 18) : 1
        ctx.globalAlpha = alpha

        // Body
        ctx.fillStyle = LANE_COLORS[n.lane]
        rrect(ctx, nx, ny, LANE_W - 8, NOTE_H, 9)
        ctx.fill()

        // Shine strip
        ctx.fillStyle = 'rgba(255,255,255,0.22)'
        rrect(ctx, nx + 5, ny + 5, LANE_W - 18, NOTE_H / 3, 4)
        ctx.fill()

        ctx.globalAlpha = 1
      }

      // Feedback labels
      for (const fb of g.feedbacks) {
        const a = 1 - fb.age / fb.maxAge
        ctx.globalAlpha = a
        ctx.fillStyle = fb.color
        ctx.font = 'bold 15px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(fb.text, fb.x, fb.y - fb.age * 0.7)
        ctx.globalAlpha = 1
      }

      // HUD top bar
      ctx.fillStyle = 'rgba(0,0,0,0.55)'
      ctx.fillRect(0, 0, W, 38)
      ctx.fillStyle = '#ffd700'
      ctx.font = 'bold 17px system-ui, sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`⭐ ${g.score}`, 10, 19)
      if (g.combo > 1) {
        ctx.fillStyle = '#f97316'
        ctx.font = 'bold 13px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${g.combo}× combo`, W / 2, 19)
      }
      const remaining = (g.noteQueue.length - g.nextNoteIdx)
        + g.activeNotes.filter(n => !n.hit && !n.missed).length
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.font = '12px system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`${remaining} left`, W - 10, 19)
    }

    const update = () => {
      const g = gsRef.current
      if (!g || g.phase !== 'playing') return
      g.frame++

      // Spawn
      g.spawnTimer--
      if (g.spawnTimer <= 0 && g.nextNoteIdx < g.noteQueue.length) {
        g.activeNotes.push({
          lane: g.noteQueue[g.nextNoteIdx],
          y: -NOTE_H / 2,
          hit: false,
          missed: false,
          missAge: 0,
        })
        g.nextNoteIdx++
        g.spawnTimer = SPAWN_FRAMES
      }

      // Move
      for (const n of g.activeNotes) {
        if (!n.hit) {
          n.y += FALL_SPEED
          if (n.missed) n.missAge++
        }
      }

      // Detect misses
      for (const n of g.activeNotes) {
        if (!n.hit && !n.missed && n.y > HIT_Y + HIT_WIN + NOTE_H / 2) {
          n.missed = true
          g.combo = 0
          playMissSound()
          g.feedbacks.push({
            x: n.lane * LANE_W + LANE_W / 2,
            y: HIT_Y - 10,
            text: 'Miss',
            color: '#e94560',
            age: 0, maxAge: 28,
          })
        }
      }

      // Cull: hit notes (no longer needed) + notes that fell off screen
      g.activeNotes = g.activeNotes.filter(n => !n.hit && n.y < H + NOTE_H + 10)

      // Age feedbacks
      for (const fb of g.feedbacks) fb.age++
      g.feedbacks = g.feedbacks.filter(fb => fb.age < fb.maxAge)

      // Age pressed lanes
      for (let i = 0; i < LANES; i++) {
        if (g.pressedLanes.has(i)) {
          g.pressedAge[i]++
          if (g.pressedAge[i] > 10) g.pressedLanes.delete(i)
        }
      }

      // Song complete?
      if (g.nextNoteIdx >= g.noteQueue.length && g.activeNotes.length === 0) {
        g.phase = 'gameover'
        playSongComplete()
        const songName = SONGS[g.songIdx].name
        const prev = uiBestRef.current[songName] || 0
        const isNewBest = g.score > prev
        if (isNewBest) {
          const nb = { ...uiBestRef.current, [songName]: g.score }
          setUiBest(nb)
          localStorage.setItem('pr_melodytap_best', JSON.stringify(nb))
        }
        setUiPhase('gameover')
        setUiScore(g.score)
      }
    }

    const loop = () => {
      update()
      draw()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)

    const onKeyDown = e => {
      const map = { a:0, s:1, d:2, f:3, A:0, S:1, D:2, F:3 }
      if (e.key in map) { e.preventDefault(); hitLane(map[e.key]) }
    }
    window.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [hitLane])

  // ── Handlers ─────────────────────────────────────────────────
  const startSong = idx => {
    gsRef.current = makeGS(idx)
    setUiPhase('playing')
    setUiScore(0)
    setUiSong(SONGS[idx].name)
  }

  const onCanvasClick = e => {
    const rect = e.target.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (W / rect.width)
    hitLane(Math.min(LANES - 1, Math.max(0, Math.floor(x / LANE_W))))
  }

  const onCanvasTouch = e => {
    e.preventDefault()
    for (const t of e.changedTouches) {
      const rect = e.target.getBoundingClientRect()
      const x = (t.clientX - rect.left) * (W / rect.width)
      hitLane(Math.min(LANES - 1, Math.max(0, Math.floor(x / LANE_W))))
    }
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="game-wrap">
      <h2 className="game-title">🎹 Melody Tap</h2>

      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="game-canvas"
        onClick={onCanvasClick}
        onTouchStart={onCanvasTouch}
      />

      {/* Song select overlay */}
      {uiPhase === 'songSelect' && (
        <div className="melodytap-overlay">
          <p className="melodytap-overlay__subtitle">Choose a song</p>
          {SONGS.map((s, i) => (
            <button key={i} className="melodytap-song-btn" onClick={() => startSong(i)}>
              <span className="melodytap-song-btn__emoji">{s.emoji}</span>
              <span className="melodytap-song-btn__name">{s.name}</span>
              {uiBest[s.name]
                ? <span className="melodytap-song-btn__best">Best: {uiBest[s.name]}</span>
                : null}
            </button>
          ))}
          <p className="game-hint" style={{ marginTop: 8 }}>Tap A S D F to hit the lanes</p>
        </div>
      )}

      {/* Song complete overlay */}
      {uiPhase === 'gameover' && gsRef.current && (() => {
        const g = gsRef.current
        const pct = g.totalNotes > 0 ? g.hits / g.totalNotes : 0
        const stars = pct >= 0.95 ? 3 : pct >= 0.75 ? 2 : pct >= 0.5 ? 1 : 0
        const isNewBest = uiBest[SONGS[g.songIdx].name] === g.score && g.score > 0
        return (
          <div className="melodytap-overlay">
            <div className="melodytap-complete__stars">
              {[1,2,3].map(n => (
                <span key={n} className={`melodytap-star${n <= stars ? ' melodytap-star--lit' : ''}`}>★</span>
              ))}
            </div>
            <h3 className="melodytap-overlay__title">
              {stars === 3 ? '🎉 Perfect!' : stars === 2 ? '🎵 Great job!' : stars === 1 ? '👍 Nice try!' : 'Keep practicing!'}
            </h3>
            <p className="melodytap-overlay__score">{uiScore} pts</p>
            <div className="melodytap-complete__stats">
              <span>{Math.round(pct * 100)}% accuracy</span>
              <span>·</span>
              <span>Best combo: {g.maxCombo}×</span>
            </div>
            {isNewBest && <p className="melodytap-complete__newbest">🏆 New best score!</p>}
            <button className="melodytap-song-btn" style={{ marginTop: 8 }} onClick={() => startSong(g.songIdx)}>
              🔁 Play Again
            </button>
            <button
              className="melodytap-song-btn melodytap-song-btn--ghost"
              onClick={() => { gsRef.current = null; setUiPhase('songSelect') }}
            >
              🎵 Change Song
            </button>
          </div>
        )
      })()}

      {uiPhase === 'playing' && (
        <p className="game-hint">{uiSong} · tap A S D F or click lanes</p>
      )}
    </div>
  )
}
