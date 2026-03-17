import { useState } from 'react'
import { AppProvider } from './context/AppContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import NavBar from './components/NavBar'
import PracticeScreen from './components/PracticeScreen'
import ProgressScreen from './components/ProgressScreen'
import ShopScreen from './components/ShopScreen'
import DashboardScreen from './components/DashboardScreen'
import TeacherView from './components/TeacherView'
import PortalSelect from './components/PortalSelect'
import StudentAuth from './components/StudentAuth'
import './App.css'

// ── Student app shell ──────────────────────────────────────
function AppShell({ onSwitchPortal }) {
  const [tab, setTab] = useState('practice')

  return (
    <div className="app-shell">
      <NavBar active={tab} onChange={setTab} />
      <main className="app-main">
        {tab === 'practice'  && <PracticeScreen />}
        {tab === 'progress'  && <ProgressScreen />}
        {tab === 'shop'      && <ShopScreen />}
        {tab === 'dashboard' && <DashboardScreen />}
      </main>
      {/* Subtle portal-switch pill — lets students jump to teacher portal */}
      <button
        className="portal-switch-pill"
        onClick={onSwitchPortal}
        title="Switch between Student and Teacher portals"
      >
        ⇄ Switch Portal
      </button>
    </div>
  )
}

// ── Portal router — shown before the app ──────────────────
function PortalRouter() {
  const { studentUser, authInitialized } = useAuth()
  const [portal,   setPortal]   = useState(() => localStorage.getItem('pr_portal') || null)
  const [skipAuth, setSkipAuth] = useState(() => !!localStorage.getItem('pr_skip_auth'))

  const selectPortal = (p) => { localStorage.setItem('pr_portal', p); setPortal(p) }
  const switchPortal = () => { localStorage.removeItem('pr_portal'); setPortal(null) }

  if (!portal) return <PortalSelect onSelect={selectPortal} />
  if (portal === 'teacher') return <TeacherView standalone onSwitchPortal={switchPortal} />

  // Student portal — wait for Firebase auth to initialize, then check login
  if (!authInitialized) return <div className="auth-loading">🎵</div>
  if (!studentUser && !skipAuth) {
    return (
      <StudentAuth
        onSkip={() => {
          localStorage.setItem('pr_skip_auth', '1')
          setSkipAuth(true)
        }}
      />
    )
  }
  return <AppShell onSwitchPortal={switchPortal} />
}

// ── Root ───────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <PortalRouter />
      </AppProvider>
    </AuthProvider>
  )
}
