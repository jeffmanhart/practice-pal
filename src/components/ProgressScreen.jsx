import { useApp, ACHIEVEMENTS_DEF, checkAchievements } from '../context/AppContext'
import './ProgressScreen.css'

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export default function ProgressScreen() {
  const { sessions, points, streak, POINTS_PER_MINUTE, games, streakSavers, useStreakSaver } = useApp()

  const totalMins     = sessions.reduce((sum, s) => sum + s.durationMinutes, 0)
  const totalSessions = sessions.length

  const achieved = checkAchievements(sessions, points, games, streak)

  const handleUseStreakSaver = () => {
    const ok = useStreakSaver()
    if (!ok && streakSavers <= 0) alert('No Streak Savers left — get one in Rewards!')
  }

  return (
    <div className="progress-screen">
      <header className="progress-screen__header">
        <div className="header-logo">📈</div>
        <div>
          <h1 className="header-title">Your Progress</h1>
          <p className="header-sub">Keep it up!</p>
        </div>
      </header>

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-card__val">{totalSessions}</span>
          <span className="stat-card__label">Sessions</span>
        </div>
        <div className="stat-card">
          <span className="stat-card__val">{totalMins}</span>
          <span className="stat-card__label">Minutes</span>
        </div>
        <div className="stat-card stat-card--gold">
          <span className="stat-card__val">⭐ {points.toLocaleString()}</span>
          <span className="stat-card__label">Points</span>
        </div>
        <div className="stat-card stat-card--streak">
          <span className="stat-card__val">🔥 {streak}</span>
          <span className="stat-card__label">Day Streak</span>
        </div>
      </div>

      {/* Streak Saver status */}
      <div className="streak-saver-bar">
        <span className="streak-saver-bar__info">
          🛡️ Streak Savers: <strong>{streakSavers}</strong>
        </span>
        <button
          className={`streak-saver-bar__btn ${streakSavers <= 0 ? 'streak-saver-bar__btn--disabled' : ''}`}
          onClick={handleUseStreakSaver}
          disabled={streakSavers <= 0}
        >
          Use Today
        </button>
      </div>

      <div className="earning-tip">
        Earn <strong>{POINTS_PER_MINUTE} points</strong> per minute of practice
      </div>

      {/* Trophy Case */}
      <section className="trophy-section">
        <h2 className="trophy-section__title">🏆 Trophy Case</h2>
        <div className="achievement-grid">
          {ACHIEVEMENTS_DEF.map(a => {
            const unlocked = !!achieved[a.id]
            return (
              <div key={a.id} className={`achievement-badge ${unlocked ? 'achievement-badge--unlocked' : 'achievement-badge--locked'}`}>
                <div className="achievement-badge__icon">{a.icon}</div>
                <div className="achievement-badge__name">{a.name}</div>
                <div className="achievement-badge__desc">{a.desc}</div>
                {unlocked && <div className="achievement-badge__check">✓</div>}
              </div>
            )
          })}
        </div>
      </section>

      {/* Session log */}
      <section className="sessions">
        <h2 className="sessions__title">Recent Sessions</h2>
        {sessions.length === 0 ? (
          <div className="sessions__empty">
            No sessions yet — start the timer and practice! 🎺
          </div>
        ) : (
          <div className="sessions__list">
            {sessions.map(s => (
              <div key={s.id} className="session-row">
                <div className="session-row__left">
                  <span className="session-row__icon">🎵</span>
                  <div>
                    <div className="session-row__duration">{s.durationMinutes} min</div>
                    <div className="session-row__date">{formatDate(s.date)}</div>
                  </div>
                </div>
                <div className="session-row__points">+{s.pointsEarned} ⭐</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
