import { useEffect } from 'react'
import FlappyTrombone from '../games/FlappyTrombone'
import NoteCatcher    from '../games/NoteCatcher'
import BrickBreaker   from '../games/BrickBreaker'
import MelodyTap      from '../games/MelodyTap'
import './GameModal.css'

const GAME_TITLES = {
  flappy:       'Flappy Trombone',
  catcher:      'Note Catcher',
  brickbreaker: 'Symphony Breaker',
  melodytap:    'Melody Tap',
}

const GAME_COMPONENTS = {
  flappy:       FlappyTrombone,
  catcher:      NoteCatcher,
  brickbreaker: BrickBreaker,
  melodytap:    MelodyTap,
}

export default function GameModal({ gameId, onClose }) {
  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Close on Escape key
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const GameComponent = GAME_COMPONENTS[gameId]
  if (!GameComponent) return null

  return (
    <div
      className="game-modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="game-modal-inner">
        <div className="game-modal-header">
          <span className="game-modal-title">{GAME_TITLES[gameId]}</span>
          <button className="game-modal-close" onClick={onClose} aria-label="Close game">✕</button>
        </div>
        <GameComponent />
      </div>
    </div>
  )
}
