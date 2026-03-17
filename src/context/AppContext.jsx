import { createContext, useContext, useState, useEffect } from 'react'
import { signInAnonymously } from 'firebase/auth'
import { doc, setDoc, getDoc, increment } from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage, firebaseReady } from '../firebase'
import { useAuth } from './AuthContext'

const AppContext = createContext(null)

const POINTS_PER_MINUTE = 10

// ── Shop data ──────────────────────────────────────────────

const DEFAULT_SKINS = [
  { id: 'default',  name: 'Classic',    color: '#e94560', cost: 0,    owned: true  },
  { id: 'neon',     name: 'Neon',       color: '#00f5ff', cost: 50,   owned: false },
  { id: 'gold',     name: 'Gold',       color: '#ffd700', cost: 100,  owned: false },
  { id: 'purple',   name: 'Purple',     color: '#a855f7', cost: 150,  owned: false },
  { id: 'fire',     name: 'Fire',       color: '#ff6b35', cost: 200,  owned: false },
  { id: 'galaxy',   name: 'Galaxy',     color: '#7c3aed', cost: 300,  owned: false },
  { id: 'ice',      name: 'Ice',        color: '#38bdf8', cost: 300,  owned: false },
  { id: 'toxic',    name: 'Toxic',      color: '#4ade80', cost: 400,  owned: false },
]

const DEFAULT_GAMES = [
  { id: 'flappy',       name: 'Flappy Trombone',  icon: '🎺', desc: 'Dodge the music stands!',           cost: 100, owned: false },
  { id: 'catcher',      name: 'Note Catcher',     icon: '🎵', desc: 'Catch the falling notes!',          cost: 150, owned: false },
  { id: 'brickbreaker', name: 'Symphony Breaker', icon: '🎼', desc: 'Break bricks, play the classics!',  cost: 200, owned: false },
  { id: 'melodytap',    name: 'Melody Tap',        icon: '🎹', desc: 'Tap the lanes, play the melody!',   cost: 175, owned: false },
]

const DEFAULT_PETS = [
  { id: 'dog', name: 'Drum Dog',    icon: '🐕', instrument: '🥁', desc: 'A loyal pup who keeps the beat.',    cost: 200, owned: false, xp: 0 },
  { id: 'cat', name: 'Piano Cat',   icon: '🐱', instrument: '🎹', desc: 'Cool and jazzy. Purrs in time.',      cost: 300, owned: false, xp: 0 },
  { id: 'owl',      name: 'Maestro Owl',    icon: '🦉', instrument: '🎼', desc: 'Wise conductor. Very distinguished.',        cost: 350, owned: false, xp: 0 },
  { id: 'goldfish', name: 'Opera Goldfish', icon: '🐡', instrument: '🎭', desc: 'Sings every scale in perfect soprano.',    cost: 250, owned: false, xp: 0 },
  { id: 'snake',    name: 'Slide Whistle Snake', icon: '🐍', instrument: '🎵', desc: 'Slithers through glissandos effortlessly.', cost: 275, owned: false, xp: 0 },
  { id: 'pig',      name: 'Piccolo Pig',   icon: '🐷', instrument: '🪈', desc: 'Tiny but mighty. Squeals in the highest register.', cost: 225, owned: false, xp: 0 },
]

// ── Pet level helpers ──────────────────────────────────────

const PET_XP_LEVELS = [0, 30, 90, 210, 450, 900]  // xp to reach each level (0-5)

export function getPetLevel(xp) {
  let lv = 0
  for (let i = 0; i < PET_XP_LEVELS.length; i++) {
    if (xp >= PET_XP_LEVELS[i]) lv = i
    else break
  }
  return lv
}

export function getPetProgress(xp) {
  const lv = getPetLevel(xp)
  if (lv >= PET_XP_LEVELS.length - 1) return { level: lv, pct: 1, atMax: true }
  const lo = PET_XP_LEVELS[lv], hi = PET_XP_LEVELS[lv + 1]
  return { level: lv, pct: (xp - lo) / (hi - lo), atMax: false }
}

// ── Streak helpers ─────────────────────────────────────────

export function calcStreak(sessions, savedDays = []) {
  if (sessions.length === 0 && savedDays.length === 0) return 0
  const days = new Set([
    ...sessions.map(s => new Date(s.date).toLocaleDateString()),
    ...savedDays.map(d => new Date(d).toLocaleDateString()),
  ])
  let streak = 0
  const d = new Date()
  // If today isn't in set, start checking from yesterday
  if (!days.has(d.toLocaleDateString())) d.setDate(d.getDate() - 1)
  while (days.has(d.toLocaleDateString())) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}

// ── Achievement definitions ────────────────────────────────

export const ACHIEVEMENTS_DEF = [
  { id: 'first_session', name: 'First Note',      icon: '🎵', desc: 'Complete your first practice session' },
  { id: 'sessions_5',    name: 'Warming Up',      icon: '🌡️',  desc: 'Complete 5 practice sessions' },
  { id: 'sessions_20',   name: 'Consistent',      icon: '🎯', desc: 'Complete 20 practice sessions' },
  { id: 'streak_3',      name: 'Hat Trick',        icon: '🎩', desc: 'Practice 3 days in a row' },
  { id: 'streak_7',      name: 'Week Warrior',     icon: '⚡', desc: 'Practice 7 days in a row' },
  { id: 'total_60min',   name: 'Hour Power',       icon: '⏱️',  desc: 'Practice for 60 minutes total' },
  { id: 'total_300min',  name: 'Scale Master',     icon: '🎶', desc: 'Practice for 5 hours total' },
  { id: 'session_30min', name: 'Marathon',         icon: '🏃', desc: 'Complete a 30-minute session' },
  { id: 'points_500',    name: 'High Achiever',    icon: '🏆', desc: 'Earn 500 practice points' },
  { id: 'speed_demon',   name: 'Speed Demon',      icon: '🔥', desc: 'Earn 200+ points in a single day' },
  { id: 'perfect_pitch', name: 'Perfect Pitch',    icon: '🎸', desc: 'Unlock a mini game' },
  { id: 'pet_owner',     name: 'Best Friend',      icon: '🐾', desc: 'Adopt a practice pet' },
]

export function checkAchievements(sessions, points, games, streak) {
  const totalMins = sessions.reduce((s, x) => s + x.durationMinutes, 0)
  const dayPts = {}
  sessions.forEach(s => {
    const k = new Date(s.date).toDateString()
    dayPts[k] = (dayPts[k] || 0) + s.pointsEarned
  })
  const maxDay = Math.max(0, ...Object.values(dayPts))
  return {
    first_session: sessions.length >= 1,
    sessions_5:    sessions.length >= 5,
    sessions_20:   sessions.length >= 20,
    streak_3:      streak >= 3,
    streak_7:      streak >= 7,
    total_60min:   totalMins >= 60,
    total_300min:  totalMins >= 300,
    session_30min: sessions.some(s => s.durationMinutes >= 30),
    points_500:    points >= 500,
    speed_demon:   maxDay >= 200,
    perfect_pitch: games.some(g => g.owned),
    pet_owner:     false,  // set dynamically
  }
}

// ── Persistence helpers ────────────────────────────────────

function load(key, fallback) {
  try {
    const v = localStorage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}

// ── Provider ───────────────────────────────────────────────

export function AppProvider({ children }) {
  const { studentUser, studentData } = useAuth()

  const [points,      setPoints]      = useState(() => load('pr_points', 0))
  const [sessions,    setSessions]    = useState(() => load('pr_sessions', []))
  const [skins,       setSkins]       = useState(() => load('pr_skins', DEFAULT_SKINS))
  const [activeSkin,  setActiveSkin]  = useState(() => load('pr_activeSkin', 'default'))
  const [games,       setGames]       = useState(() => {
    const stored   = load('pr_games', DEFAULT_GAMES)
    const storedIds = new Set(stored.map(g => g.id))
    // Merge any new games from DEFAULT_GAMES that aren't yet in storage
    return [...stored, ...DEFAULT_GAMES.filter(g => !storedIds.has(g.id))]
  })
  const [pets,        setPets]        = useState(() => load('pr_pets', DEFAULT_PETS))
  const [activePet,   setActivePet]   = useState(() => load('pr_activePet', null))
  const [streakSavers,setStreakSavers] = useState(() => load('pr_streakSavers', 0))
  const [savedDays,   setSavedDays]   = useState(() => load('pr_savedDays', []))
  // Session-only — not persisted (blob URLs don't survive reload)
  const [recordings,  setRecordings]  = useState([])

  useEffect(() => { localStorage.setItem('pr_points',       JSON.stringify(points))      }, [points])
  useEffect(() => { localStorage.setItem('pr_sessions',     JSON.stringify(sessions))    }, [sessions])
  useEffect(() => { localStorage.setItem('pr_skins',        JSON.stringify(skins))       }, [skins])
  useEffect(() => { localStorage.setItem('pr_activeSkin',   JSON.stringify(activeSkin))  }, [activeSkin])
  useEffect(() => { localStorage.setItem('pr_games',        JSON.stringify(games))       }, [games])
  useEffect(() => { localStorage.setItem('pr_pets',         JSON.stringify(pets))        }, [pets])
  useEffect(() => { localStorage.setItem('pr_activePet',    JSON.stringify(activePet))   }, [activePet])
  useEffect(() => { localStorage.setItem('pr_streakSavers', JSON.stringify(streakSavers))}, [streakSavers])
  useEffect(() => { localStorage.setItem('pr_savedDays',    JSON.stringify(savedDays))   }, [savedDays])

  // When a student logs in, seed points/sessions/streak from Firestore so the
  // server is always the source of truth (overrides any stale localStorage cache)
  useEffect(() => {
    if (!studentUser || !studentData?.classCode || !firebaseReady || !db) return
    const uid = studentUser.uid
    const code = studentData.classCode
    getDoc(doc(db, 'classes', code, 'students', uid)).then(snap => {
      if (!snap.exists()) return
      const d = snap.data()
      if (d.points   !== undefined) setPoints(d.points)
      if (d.sessions !== undefined) setSessions(d.sessions)
      if (d.streak   !== undefined) {
        // streak lives in savedDays indirectly; update points/sessions is enough
        // for the teacher view — streak recalculates from sessions on the student side
      }
    }).catch(() => {})
  }, [studentUser?.uid])

  const logSession = (durationSeconds) => {
    const mins        = Math.max(1, Math.round(durationSeconds / 60))
    const earned      = mins * POINTS_PER_MINUTE
    const session     = { id: Date.now(), date: new Date().toISOString(), durationMinutes: mins, pointsEarned: earned }
    const newSessions = [session, ...sessions]
    const newPoints   = points + earned
    const newStreak   = calcStreak(newSessions, savedDays)
    setSessions(newSessions)
    setPoints(newPoints)
    setPets(prev => prev.map(p => p.owned ? { ...p, xp: p.xp + mins } : p))
    syncToTeacher(newSessions, newPoints, newStreak)   // no-op if not configured

    // Detect if the active pet leveled up this session
    let levelUp = null
    if (activePet) {
      const ap = pets.find(p => p.id === activePet)
      if (ap) {
        const oldLv = getPetLevel(ap.xp)
        const newLv = getPetLevel(ap.xp + mins)
        if (newLv > oldLv) levelUp = { name: ap.name, icon: ap.icon, level: newLv }
      }
    }

    return { earned, levelUp }
  }

  // ── Firebase: sync practice stats to teacher's view ───
  const syncToTeacher = async (newSessions, newPoints, newStreak) => {
    const classCode   = localStorage.getItem('pr_class_code')
    const studentName = localStorage.getItem('pr_student_name') || 'Student'
    if (!classCode || !firebaseReady || !db || !auth) return
    try {
      if (!auth.currentUser) await signInAnonymously(auth)
      const uid = auth.currentUser.uid
      localStorage.setItem('pr_student_uid', uid)
      await setDoc(
        doc(db, 'classes', classCode, 'students', uid),
        {
          studentName,
          points:     newPoints,
          sessions:   newSessions.slice(0, 50),
          streak:     newStreak,
          lastActive: Date.now(),
        },
        { merge: true }
      )
    } catch (e) {
      console.warn('Teacher sync skipped:', e.message)
    }
  }

  // ── Firebase: upload a recording blob → Storage + Firestore
  const uploadRecordingToTeacher = async (rec) => {
    const classCode   = localStorage.getItem('pr_class_code')
    const studentName = localStorage.getItem('pr_student_name') || 'Student'
    if (!classCode)       return { error: 'No class code set. Add it in Dashboard → Settings.' }
    if (!firebaseReady)   return { error: 'Firebase not configured yet. See src/firebase.js.' }
    try {
      if (!auth.currentUser) await signInAnonymously(auth)
      const uid     = auth.currentUser.uid
      const recId   = String(rec.id)

      // Upload audio file to Firebase Storage
      const fileRef = ref(storage, `classes/${classCode}/${uid}/${recId}.webm`)
      const snap    = await uploadBytes(fileRef, rec.blob, { contentType: 'audio/webm' })
      const downloadUrl = await getDownloadURL(snap.ref)

      // Save metadata to Firestore
      await setDoc(
        doc(db, 'classes', classCode, 'students', uid, 'recordings', recId),
        { studentName, downloadUrl, timestamp: rec.timestamp, durationSecs: rec.durationSecs, isNew: true, sentAt: Date.now() }
      )
      // Increment unreviewed count on student doc (for teacher badge)
      await setDoc(
        doc(db, 'classes', classCode, 'students', uid),
        { unreviewed: increment(1) },
        { merge: true }
      )
      return { success: true }
    } catch (e) {
      console.error('Upload failed:', e)
      return { error: e.message }
    }
  }

  const buySkin = (skinId) => {
    const skin = skins.find(s => s.id === skinId)
    if (!skin || skin.owned || points < skin.cost) return false
    setPoints(prev => prev - skin.cost)
    setSkins(prev => prev.map(s => s.id === skinId ? { ...s, owned: true } : s))
    return true
  }

  const buyGame = (gameId) => {
    const game = games.find(g => g.id === gameId)
    if (!game || game.owned || points < game.cost) return false
    setPoints(prev => prev - game.cost)
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, owned: true } : g))
    return true
  }

  const buyPet = (petId) => {
    const pet = pets.find(p => p.id === petId)
    if (!pet || pet.owned || points < pet.cost) return false
    setPoints(prev => prev - pet.cost)
    setPets(prev => prev.map(p => p.id === petId ? { ...p, owned: true } : p))
    if (!activePet) setActivePet(petId)
    return true
  }

  const addRecording    = (rec) => setRecordings(prev => [rec, ...prev])
  const removeRecording = (id)  => setRecordings(prev => {
    const r = prev.find(x => x.id === id)
    if (r) URL.revokeObjectURL(r.url)
    return prev.filter(x => x.id !== id)
  })

  const relockGame = (gameId) => {
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, owned: false } : g))
  }

  const buyStreakSaver = () => {
    const COST = 500
    if (points < COST) return false
    setPoints(prev => prev - COST)
    setStreakSavers(prev => prev + 1)
    return true
  }

  const useStreakSaver = () => {
    if (streakSavers <= 0) return false
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const key = yesterday.toISOString().split('T')[0]
    if (savedDays.includes(key)) return false
    setSavedDays(prev => [...prev, key])
    setStreakSavers(prev => prev - 1)
    return true
  }

  const streak = calcStreak(sessions, savedDays)
  const currentSkin = skins.find(s => s.id === activeSkin) || skins[0]
  const currentPet  = pets.find(p => p.id === activePet && p.owned) || null

  return (
    <AppContext.Provider value={{
      points, sessions, streak,
      skins, activeSkin, currentSkin,
      games,
      pets, activePet, currentPet, setActivePet,
      streakSavers, savedDays,
      recordings, addRecording, removeRecording,
      logSession, uploadRecordingToTeacher, buySkin, setActiveSkin,
      buyGame, relockGame, buyPet, buyStreakSaver, useStreakSaver,
      POINTS_PER_MINUTE,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
