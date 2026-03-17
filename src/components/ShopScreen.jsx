import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'
import GameModal from './GameModal'
import './ShopScreen.css'

export default function ShopScreen() {
  const {
    skins, points, buySkin, activeSkin, setActiveSkin,
    games, buyGame,
    pets, activePet, setActivePet, buyPet,
    streakSavers, buyStreakSaver,
  } = useApp()
  const { studentData } = useAuth()
  const firstName = studentData?.name?.split(' ')[0] || ''

  const [toast,       setToast]       = useState(null)
  const [playingGame, setPlayingGame] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  const handleBuySkin = (skin) => {
    const ok = buySkin(skin.id)
    if (ok) { showToast(`Unlocked ${skin.name}! 🎉`); setActiveSkin(skin.id) }
    else if (points < skin.cost) showToast(`Need ${skin.cost - points} more ⭐`)
  }

  const handleBuyGame = (game) => {
    const ok = buyGame(game.id)
    if (ok) showToast(`Unlocked ${game.name}! 🎮`)
    else if (points < game.cost) showToast(`Need ${game.cost - points} more ⭐`)
  }

  const handleBuyPet = (pet) => {
    const ok = buyPet(pet.id)
    if (ok) showToast(`${pet.name} joined your team! 🐾`)
    else if (points < pet.cost) showToast(`Need ${pet.cost - points} more ⭐`)
  }

  const handleBuyStreakSaver = () => {
    const ok = buyStreakSaver()
    if (ok) showToast('Streak Saver added! 🛡️')
    else showToast('Need 500 ⭐ to buy a Streak Saver')
  }

  return (
    <div className="shop-screen">
      <header className="shop-screen__header">
        <div className="header-logo">🎁</div>
        <div>
          <h1 className="header-title">{firstName ? `${firstName}'s Rewards` : 'Rewards'}</h1>
          <p className="header-sub">{firstName ? `You've earned this, ${firstName}! 🏆` : 'Spend your practice points'}</p>
        </div>
        <div className="shop-points">
          <span className="shop-points__val">⭐ {points.toLocaleString()}</span>
          <span className="shop-points__label">available</span>
        </div>
      </header>

      {toast && <div className="shop-toast">{toast}</div>}

      {/* ── Mini Games ─────────────────────────────────────── */}
      <section className="shop-section">
        <h2 className="shop-section__title">🎮 Mini Games</h2>
        <div className="game-card-grid">
          {games.map(game => (
            <GameCard
              key={game.id}
              game={game}
              canAfford={points >= game.cost}
              onBuy={() => handleBuyGame(game)}
              onPlay={() => setPlayingGame(game.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Practice Pets ──────────────────────────────────── */}
      <section className="shop-section">
        <h2 className="shop-section__title">🐾 Practice Pets</h2>
        <p className="shop-section__desc">Pets level up every time you practice!</p>
        <div className="pet-card-grid">
          {pets.map(pet => (
            <PetCard
              key={pet.id}
              pet={pet}
              isActive={activePet === pet.id}
              canAfford={points >= pet.cost}
              onBuy={() => handleBuyPet(pet)}
              onSelect={() => setActivePet(pet.id)}
            />
          ))}
        </div>
      </section>

      {/* ── Power-Ups ──────────────────────────────────────── */}
      <section className="shop-section">
        <h2 className="shop-section__title">⚡ Power-Ups</h2>
        <StreakSaverCard
          count={streakSavers}
          canAfford={points >= 500}
          onBuy={handleBuyStreakSaver}
        />
      </section>

      {/* ── Skins ──────────────────────────────────────────── */}
      <section className="shop-section">
        <h2 className="shop-section__title">🎨 Metronome Skins</h2>
        <div className="skin-grid">
          {skins.map(skin => (
            <SkinCard
              key={skin.id}
              skin={skin}
              isActive={activeSkin === skin.id}
              canAfford={points >= skin.cost}
              onBuy={() => handleBuySkin(skin)}
              onEquip={() => setActiveSkin(skin.id)}
            />
          ))}
        </div>
      </section>

      {playingGame && (
        <GameModal gameId={playingGame} onClose={() => setPlayingGame(null)} />
      )}
    </div>
  )
}

// ── GameCard ────────────────────────────────────────────────

function GameCard({ game, canAfford, onBuy, onPlay }) {
  return (
    <div className={`game-card ${!game.owned && !canAfford ? 'game-card--locked' : ''}`}>
      <div className="game-card__icon">{game.icon}</div>
      <div className="game-card__body">
        <span className="game-card__name">{game.name}</span>
        <span className="game-card__desc">{game.desc}</span>
      </div>
      <div className="game-card__action">
        {game.owned ? (
          <button className="shop-btn shop-btn--play" onClick={onPlay}>▶ Play</button>
        ) : (
          <button
            className={`shop-btn shop-btn--buy ${!canAfford ? 'shop-btn--cant-afford' : ''}`}
            onClick={onBuy}
            disabled={!canAfford}
          >
            {canAfford ? `⭐ ${game.cost}` : `🔒 ${game.cost}`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── GoldfishSVG ─────────────────────────────────────────────

function GoldfishSVG() {
  return (
    <svg viewBox="0 0 74 54" width="52" height="38" xmlns="http://www.w3.org/2000/svg" className="goldfish-svg">
      {/* Tail fan – forked */}
      <path d="M50,27 L67,13 L72,27 L67,41 Z" fill="#e07808"/>
      <line x1="59" y1="20" x2="50" y2="27" stroke="#c06008" strokeWidth="1.2" opacity="0.7"/>
      <line x1="59" y1="34" x2="50" y2="27" stroke="#c06008" strokeWidth="1.2" opacity="0.7"/>
      {/* Body */}
      <ellipse cx="31" cy="27" rx="26" ry="16" fill="#FFA500"/>
      {/* Belly sheen */}
      <ellipse cx="29" cy="31" rx="20" ry="8.5" fill="#FFD54F" opacity="0.52"/>
      {/* Scale arcs */}
      <path d="M19,15 Q26,12 33,15" stroke="#c96800" strokeWidth="1.2" fill="none" opacity="0.55"/>
      <path d="M33,15 Q40,12 47,16" stroke="#c96800" strokeWidth="1.2" fill="none" opacity="0.55"/>
      <path d="M13,22 Q20,19 27,22" stroke="#c96800" strokeWidth="1.2" fill="none" opacity="0.55"/>
      <path d="M27,22 Q34,19 41,22" stroke="#c96800" strokeWidth="1.2" fill="none" opacity="0.55"/>
      {/* Dorsal fin */}
      <path d="M22,11 Q32,2 44,12" stroke="#d07000" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
      {/* Pectoral fin */}
      <path d="M28,33 Q36,42 44,37" stroke="#d07000" strokeWidth="2.2" fill="none" strokeLinecap="round" opacity="0.75"/>
      {/* Eye */}
      <circle cx="11" cy="23" r="4.2" fill="white"/>
      <circle cx="10.5" cy="23" r="2.5" fill="#111"/>
      <circle cx="9.4" cy="21.8" r="1" fill="white"/>
      {/* Mouth */}
      <ellipse cx="4.5" cy="28" rx="2.8" ry="2.2" fill="#b84e00" opacity="0.82"/>
    </svg>
  )
}

// ── PetCard ─────────────────────────────────────────────────

function PetCard({ pet, isActive, canAfford, onBuy, onSelect }) {
  return (
    <div className={`pet-card ${isActive ? 'pet-card--active' : ''} ${!pet.owned && !canAfford ? 'pet-card--locked' : ''}`}>
      <div className="pet-card__icon">
        {pet.id === 'goldfish' ? <GoldfishSVG /> : pet.icon}
      </div>
      <div className="pet-card__instrument">{pet.instrument}</div>
      <div className="pet-card__body">
        <span className="pet-card__name">{pet.name}</span>
        <span className="pet-card__desc">{pet.desc}</span>
      </div>
      <div className="pet-card__action">
        {pet.owned ? (
          isActive ? (
            <button className="shop-btn shop-btn--active-pet" disabled>Active ✓</button>
          ) : (
            <button className="shop-btn shop-btn--select" onClick={onSelect}>Set Active</button>
          )
        ) : (
          <button
            className={`shop-btn shop-btn--buy ${!canAfford ? 'shop-btn--cant-afford' : ''}`}
            onClick={onBuy}
            disabled={!canAfford}
          >
            {canAfford ? `⭐ ${pet.cost}` : `🔒 ${pet.cost}`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── StreakSaverCard ─────────────────────────────────────────

function StreakSaverCard({ count, canAfford, onBuy }) {
  return (
    <div className="powerup-card">
      <div className="powerup-card__icon">🛡️</div>
      <div className="powerup-card__body">
        <span className="powerup-card__name">Streak Saver</span>
        <span className="powerup-card__desc">
          Take a day off without losing your streak.{' '}
          <strong>{count > 0 ? `You have ${count}.` : 'You have none.'}</strong>
        </span>
      </div>
      <div className="powerup-card__action">
        <button
          className={`shop-btn shop-btn--buy ${!canAfford ? 'shop-btn--cant-afford' : ''}`}
          onClick={onBuy}
          disabled={!canAfford}
        >
          {canAfford ? '⭐ 500' : '🔒 500'}
        </button>
      </div>
    </div>
  )
}

// ── SkinCard ────────────────────────────────────────────────

function SkinCard({ skin, isActive, canAfford, onBuy, onEquip }) {
  return (
    <div className={`skin-card ${isActive ? 'skin-card--active' : ''} ${!skin.owned && !canAfford ? 'skin-card--locked' : ''}`}>
      <div className="skin-preview" style={{ '--skin-color': skin.color }}>
        <div className="skin-preview__bpm">80</div>
        <div className="skin-preview__label">BPM</div>
      </div>
      <div className="skin-card__info">
        <span className="skin-card__name">{skin.name}</span>
        {isActive && <span className="skin-card__badge">Active</span>}
      </div>
      <div className="skin-card__action">
        {skin.owned ? (
          isActive ? (
            <button className="skin-btn skin-btn--equipped" disabled>Equipped ✓</button>
          ) : (
            <button className="skin-btn skin-btn--equip" onClick={onEquip}>Equip</button>
          )
        ) : (
          <button
            className={`skin-btn skin-btn--buy ${!canAfford ? 'skin-btn--cant-afford' : ''}`}
            onClick={onBuy}
            disabled={!canAfford}
          >
            {canAfford ? `⭐ ${skin.cost}` : `🔒 ${skin.cost}`}
          </button>
        )}
      </div>
    </div>
  )
}
