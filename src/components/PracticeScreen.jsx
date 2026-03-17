import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { getPetProgress } from '../context/AppContext'
import PracticeTimer from './PracticeTimer'
import Metronome from './Metronome'
import Recorder from './Recorder'
import Tuner from './Tuner'
import PerformanceModal from './PerformanceModal'
import './PracticeScreen.css'

export default function PracticeScreen() {
  const { logSession, currentSkin, currentPet } = useApp()
  const [lastEarned,      setLastEarned]      = useState(null)
  const [micOwner,        setMicOwner]        = useState(null)
  const [tunerOpen,       setTunerOpen]       = useState(false)
  const [showPerformance, setShowPerformance] = useState(false)
  const [perfEarned,      setPerfEarned]      = useState(0)
  const [perfLevelUp,     setPerfLevelUp]     = useState(null)

  const handleSessionComplete = (seconds) => {
    const { earned, levelUp } = logSession(seconds)
    setLastEarned(earned)
    setPerfEarned(earned)
    setPerfLevelUp(levelUp)
    setTimeout(() => setLastEarned(null), 4000)
    setShowPerformance(true)
  }

  const handleTunerToggle = () => setTunerOpen(o => !o)

  return (
    <div className="practice-screen">
      <header className="practice-screen__header">
        <div className="header-logo">🎺</div>
        <div>
          <h1 className="header-title">Practice Time</h1>
          <p className="header-sub">Let's make some music!</p>
        </div>
        {currentPet && <PetBadge pet={currentPet} />}
      </header>

      {lastEarned && (
        <div className="earned-toast">
          🎉 Session complete! +{lastEarned} ⭐ points earned
        </div>
      )}

      <div className="practice-screen__grid">
        <PracticeTimer onSessionComplete={handleSessionComplete} />
        <Metronome skinColor={currentSkin.color} />
      </div>

      {/* Recorder sits below the grid, full width */}
      <Recorder micOwner={micOwner} setMicOwner={setMicOwner} />

      {/* Collapsible Tuner */}
      <div className="tuner-section">
        <button
          className={`tuner-toggle-bar ${tunerOpen ? 'tuner-toggle-bar--open' : ''}`}
          onClick={handleTunerToggle}
        >
          <span className="tuner-toggle-bar__label">🎸 Chromatic Tuner</span>
          <span className="tuner-toggle-bar__chevron">{tunerOpen ? '▲' : '▼'}</span>
        </button>
        {tunerOpen && (
          <div className="tuner-section__body">
            <Tuner micOwner={micOwner} setMicOwner={setMicOwner} />
          </div>
        )}
      </div>

      {showPerformance && (
        <PerformanceModal
          earned={perfEarned}
          pet={currentPet}
          levelUp={perfLevelUp}
          onClose={() => setShowPerformance(false)}
        />
      )}
    </div>
  )
}

function PetBadge({ pet }) {
  const { level } = getPetProgress(pet.xp)
  return (
    <div className="pet-badge" title={`${pet.name} — Lv ${level}`}>
      <span className="pet-badge__icon">{pet.icon}</span>
      <div className="pet-badge__info">
        <span className="pet-badge__name">{pet.name}</span>
        <span className="pet-badge__level">Lv {level}</span>
      </div>
    </div>
  )
}
