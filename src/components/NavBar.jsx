import './NavBar.css'
import { useApp } from '../context/AppContext'
import { useAuth } from '../context/AuthContext'

const TABS = [
  { id: 'practice',  label: 'Practice',  icon: '🎺' },
  { id: 'progress',  label: 'Progress',  icon: '📈' },
  { id: 'shop',      label: 'Rewards',   icon: '🎁' },
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
]

export default function NavBar({ active, onChange }) {
  const { points } = useApp()
  const { studentUser, studentData, studentLogout } = useAuth()

  return (
    <nav className="navbar">
      <div className="navbar__points">
        <span className="navbar__points-icon">⭐</span>
        <span className="navbar__points-val">{points.toLocaleString()}</span>
        <span className="navbar__points-label">pts</span>
      </div>
      <div className="navbar__tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-tab ${active === t.id ? 'nav-tab--active' : ''}`}
            onClick={() => onChange(t.id)}
          >
            <span className="nav-tab__icon">{t.icon}</span>
            <span className="nav-tab__label">{t.label}</span>
          </button>
        ))}
      </div>
      {studentUser && (
        <div className="navbar__user">
          <span className="navbar__user-name">{studentData?.name || studentUser.email}</span>
          <button className="navbar__signout" onClick={studentLogout} title="Sign out">↩</button>
        </div>
      )}
    </nav>
  )
}
