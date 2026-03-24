import { createContext, useContext, useState, useEffect, useRef } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  doc, setDoc, getDoc,
  collection, onSnapshot, updateDoc, increment, arrayUnion,
} from 'firebase/firestore'
import { auth, db, firebaseReady } from '../firebase'

const AuthContext = createContext(null)

// role stored in users/{uid}: 'teacher' | 'student'

function genClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ── Demo / static login data ────────────────────────────────
// Login with email "teacher" and password "teacher" to use demo mode.
// No Firebase required.

const DEMO_TEACHER = {
  name: 'Ms. Johnson',
  email: 'teacher@demo.com',
  classCode: 'DEMO01',
  createdAt: Date.now(),
}

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const DEMO_STUDENTS = [
  {
    id: 'demo_alex',
    studentName: 'Alex Chen',
    streak: 5,
    points: 340,
    lastActive: Date.now() - 1 * 3600000,
    unreviewed: 2,
    sessions: [
      { id: 1, date: daysAgo(0), durationMinutes: 25, pointsEarned: 250 },
      { id: 2, date: daysAgo(1), durationMinutes: 20, pointsEarned: 200 },
      { id: 3, date: daysAgo(2), durationMinutes: 30, pointsEarned: 300 },
      { id: 4, date: daysAgo(3), durationMinutes: 15, pointsEarned: 150 },
      { id: 5, date: daysAgo(4), durationMinutes: 20, pointsEarned: 200 },
    ],
  },
  {
    id: 'demo_sam',
    studentName: 'Sam Rivera',
    streak: 2,
    points: 180,
    lastActive: Date.now() - 26 * 3600000,
    unreviewed: 0,
    sessions: [
      { id: 6, date: daysAgo(1), durationMinutes: 18, pointsEarned: 180 },
      { id: 7, date: daysAgo(2), durationMinutes: 22, pointsEarned: 220 },
      { id: 8, date: daysAgo(5), durationMinutes: 10, pointsEarned: 100 },
    ],
  },
  {
    id: 'demo_taylor',
    studentName: 'Taylor Kim',
    streak: 0,
    points: 60,
    lastActive: Date.now() - 4 * 86400000,
    unreviewed: 1,
    sessions: [
      { id: 9,  date: daysAgo(4), durationMinutes: 6,  pointsEarned: 60 },
    ],
  },
]

const DEMO_RECORDINGS = {
  demo_alex: [
    {
      id: 'drec1',
      studentName: 'Alex Chen',
      downloadUrl: null,
      timestamp: daysAgo(0),
      durationSecs: 93,
      isNew: true,
      sentAt: Date.now() - 3600000,
    },
    {
      id: 'drec2',
      studentName: 'Alex Chen',
      downloadUrl: null,
      timestamp: daysAgo(1),
      durationSecs: 47,
      isNew: true,
      sentAt: Date.now() - 27 * 3600000,
    },
    {
      id: 'drec3',
      studentName: 'Alex Chen',
      downloadUrl: null,
      timestamp: daysAgo(3),
      durationSecs: 120,
      isNew: false,
      sentAt: Date.now() - 75 * 3600000,
    },
  ],
  demo_sam: [],
  demo_taylor: [
    {
      id: 'drec4',
      studentName: 'Taylor Kim',
      downloadUrl: null,
      timestamp: daysAgo(4),
      durationSecs: 61,
      isNew: true,
      sentAt: Date.now() - 4 * 86400000,
    },
  ],
}

// ── Provider ────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [teacherUser,       setTeacherUser]       = useState(null)
  const [teacherData,       setTeacherData]        = useState(null)
  const [students,          setStudents]           = useState([])
  const [authLoading,       setAuthLoading]        = useState(false)
  const [authError,         setAuthError]          = useState(null)
  const [studentUser,       setStudentUser]        = useState(null)
  const [studentData,       setStudentData]        = useState(null)
  const [studentAuthLoading,setStudentAuthLoading] = useState(false)
  const [studentAuthError,  setStudentAuthError]   = useState(null)
  // true once onAuthStateChanged has fired (or Firebase not configured)
  const [authInitialized,   setAuthInitialized]   = useState(!firebaseReady)
  const demoMode = useRef(false)

  // ── Listen for auth state ───────────────────────────────
  useEffect(() => {
    if (!firebaseReady) return
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (demoMode.current) { setAuthInitialized(true); return }
      if (user && !user.isAnonymous) {
        // Check users collection to determine role
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        if (userSnap.exists() && userSnap.data().role === 'student') {
          const data = userSnap.data()
          setStudentUser(user)
          setStudentData(data)
          // Sync to localStorage so AppContext syncToTeacher can read them
          if (data.name)      localStorage.setItem('pr_student_name', data.name)
          if (data.classCode) localStorage.setItem('pr_class_code',   data.classCode)
          setTeacherUser(null); setTeacherData(null); setStudents([])
        } else {
          // Teacher (or legacy teacher without users doc)
          setTeacherUser(user)
          const snap = await getDoc(doc(db, 'teachers', user.uid))
          if (snap.exists()) setTeacherData(snap.data())
          setStudentUser(null); setStudentData(null)
        }
      } else {
        setTeacherUser(null); setTeacherData(null); setStudents([])
        setStudentUser(null); setStudentData(null)
      }
      setAuthInitialized(true)
    })
    return unsub
  }, [])

  // ── Real-time student list when teacher is logged in ───
  useEffect(() => {
    if (demoMode.current) return
    if (!teacherData?.classCode || !firebaseReady) return
    const q = collection(db, 'classes', teacherData.classCode, 'students')
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      list.sort((a, b) => (b.lastActive || 0) - (a.lastActive || 0))
      setStudents(list)
    })
    return unsub
  }, [teacherData?.classCode])

  // ── Teacher register ───────────────────────────────────
  const register = async (name, email, password) => {
    if (!firebaseReady) { setAuthError('Firebase not configured yet. See src/firebase.js.'); return }
    setAuthLoading(true); setAuthError(null)
    try {
      const cred      = await createUserWithEmailAndPassword(auth, email, password)
      const classCode = genClassCode()
      const data      = { name, email, classCode, createdAt: Date.now() }
      await setDoc(doc(db, 'teachers', cred.user.uid), data)
      await setDoc(doc(db, 'users', cred.user.uid), { role: 'teacher', name, email, createdAt: Date.now() })
      // Set both together so TeacherDashboard never sees teacherUser without teacherData
      setTeacherUser(cred.user)
      setTeacherData(data)
    } catch (e) {
      setAuthError(e.message.replace('Firebase: ', '').replace(/\s\(auth.*\)/, ''))
    }
    setAuthLoading(false)
  }

  // ── Student register ────────────────────────────────────
  const studentRegister = async (name, email, password, classCode) => {
    if (!firebaseReady) { setStudentAuthError('Firebase not configured. See src/firebase.js.'); return }
    setStudentAuthLoading(true); setStudentAuthError(null)
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password)
      const code = classCode.trim().toUpperCase()
      const data = { role: 'student', name, email, classCode: code, createdAt: Date.now() }
      await setDoc(doc(db, 'users', cred.user.uid), data)
      // Create the student's class document immediately so they appear on the
      // teacher's dashboard right away (without waiting for a practice session)
      await setDoc(
        doc(db, 'classes', code, 'students', cred.user.uid),
        { studentName: name, points: 0, sessions: [], streak: 0, lastActive: Date.now(), unreviewed: 0 },
        { merge: true }
      )
      // Set student state and clear any teacher state that onAuthStateChanged may have
      // set during the race before the users doc was written
      setStudentUser(cred.user)
      setStudentData(data)
      setTeacherUser(null)
      setTeacherData(null)
      setStudents([])
      localStorage.setItem('pr_student_name', name)
      localStorage.setItem('pr_class_code',   code)
    } catch (e) {
      setStudentAuthError(e.message.replace('Firebase: ', '').replace(/\s\(auth.*\)/, ''))
    }
    setStudentAuthLoading(false)
  }

  // ── Student login ────────────────────────────────────────
  const studentLogin = async (email, password) => {
    if (!firebaseReady) { setStudentAuthError('Firebase not configured. See src/firebase.js.'); return }
    setStudentAuthLoading(true); setStudentAuthError(null)
    try {
      const cred     = await signInWithEmailAndPassword(auth, email, password)
      const userSnap = await getDoc(doc(db, 'users', cred.user.uid))
      if (userSnap.exists() && userSnap.data().role === 'teacher') {
        setStudentAuthError('That\'s a teacher account — use the Teacher portal instead.')
        await signOut(auth)
        return
      }
      // If this student has a class code but no class doc yet (registered before the fix),
      // seed their class doc now so they appear on the teacher's dashboard
      if (userSnap.exists()) {
        const { classCode: code, name } = userSnap.data()
        if (code) {
          const classDocRef = doc(db, 'classes', code, 'students', cred.user.uid)
          const classSnap   = await getDoc(classDocRef)
          if (!classSnap.exists()) {
            await setDoc(classDocRef, {
              studentName: name || email,
              points: 0, sessions: [], streak: 0,
              lastActive: Date.now(), unreviewed: 0,
            })
          }
        }
      }
      // onAuthStateChanged will set studentUser/studentData
    } catch (e) {
      const code = e?.code || ''
      if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setStudentAuthError('Incorrect email or password.')
      } else if (code === 'auth/network-request-failed') {
        setStudentAuthError('Network error — check your internet connection and try again.')
      } else if (code === 'auth/too-many-requests') {
        setStudentAuthError('Too many attempts. Please wait a few minutes and try again.')
      } else {
        setStudentAuthError('Sign-in failed. Please try again.')
      }
    }
    setStudentAuthLoading(false)
  }

  // ── Student logout ───────────────────────────────────────
  const studentLogout = () => signOut(auth)

  // ── Teacher login ──────────────────────────────────────
  const login = async (email, password) => {
    setAuthLoading(true); setAuthError(null)

    // ── Demo / static login ──────────────────────────────
    if (email.trim().toLowerCase() === 'teacher' && password === 'teacher') {
      demoMode.current = true
      setTeacherUser({ uid: 'demo', email: 'teacher@demo.com', isDemo: true })
      setTeacherData(DEMO_TEACHER)
      setStudents(DEMO_STUDENTS)
      setAuthLoading(false)
      return
    }

    if (!firebaseReady) {
      setAuthError('Firebase not configured. Use "teacher" / "teacher" to test with demo data.')
      setAuthLoading(false)
      return
    }
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch {
      setAuthError('Incorrect email or password.')
    }
    setAuthLoading(false)
  }

  // ── Logout ─────────────────────────────────────────────
  const logout = () => {
    if (demoMode.current) {
      demoMode.current = false
      setTeacherUser(null)
      setTeacherData(null)
      setStudents([])
      return
    }
    signOut(auth)
  }

  // ── Mark a recording as reviewed ──────────────────────
  const markReviewed = async (classCode, studentId, recId) => {
    if (demoMode.current) {
      // Update demo state in-memory
      const recs = DEMO_RECORDINGS[studentId]
      if (recs) {
        const rec = recs.find(r => r.id === recId)
        if (rec) rec.isNew = false
      }
      const student = DEMO_STUDENTS.find(s => s.id === studentId)
      if (student && student.unreviewed > 0) student.unreviewed -= 1
      // Force re-render of student list
      setStudents([...DEMO_STUDENTS])
      return
    }
    if (!firebaseReady) return
    try {
      await updateDoc(
        doc(db, 'classes', classCode, 'students', studentId, 'recordings', recId),
        { isNew: false }
      )
      await updateDoc(
        doc(db, 'classes', classCode, 'students', studentId),
        { unreviewed: increment(-1) }
      )
    } catch (e) {
      console.error('markReviewed failed:', e)
    }
  }

  // ── Teacher: award bonus points to a student ──────────
  const teacherAwardPoints = async (studentId, amount, reason) => {
    if (demoMode.current) {
      const student = DEMO_STUDENTS.find(s => s.id === studentId)
      if (student) {
        student.points = (student.points || 0) + amount
        student.lastAwardNote = reason || ''
        student.lastAwardTs   = Date.now()
      }
      setStudents([...DEMO_STUDENTS])
      return { success: true }
    }
    if (!firebaseReady) return { error: 'Firebase not configured' }
    try {
      const cc = teacherData?.classCode
      await updateDoc(doc(db, 'classes', cc, 'students', studentId), {
        points: increment(amount),
        lastAwardNote: reason || '',
        lastAwardTs: Date.now(),
      })
      return { success: true }
    } catch (e) { return { error: e.message } }
  }

  // ── Teacher: award an achievement badge ─────────────
  const teacherAwardAchievement = async (studentId, achievementId) => {
    if (demoMode.current) {
      const student = DEMO_STUDENTS.find(s => s.id === studentId)
      if (student) {
        if (!student.teacherBadges) student.teacherBadges = []
        if (!student.teacherBadges.includes(achievementId))
          student.teacherBadges.push(achievementId)
      }
      setStudents([...DEMO_STUDENTS])
      return { success: true }
    }
    if (!firebaseReady) return { error: 'Firebase not configured' }
    try {
      const cc = teacherData?.classCode
      await updateDoc(doc(db, 'classes', cc, 'students', studentId), {
        teacherBadges: arrayUnion(achievementId),
      })
      return { success: true }
    } catch (e) { return { error: e.message } }
  }

  // ── Teacher: grade a recording with points + feedback ──
  const teacherGradeRecording = async (classCode, studentId, recId, points, feedback) => {
    if (demoMode.current) {
      const recs = DEMO_RECORDINGS[studentId]
      if (recs) {
        const rec = recs.find(r => r.id === recId)
        if (rec) { rec.teacherPoints = points; rec.teacherFeedback = feedback; rec.graded = true }
      }
      const student = DEMO_STUDENTS.find(s => s.id === studentId)
      if (student) student.points = (student.points || 0) + points
      setStudents([...DEMO_STUDENTS])
      return { success: true }
    }
    if (!firebaseReady) return { error: 'Firebase not configured' }
    try {
      await updateDoc(
        doc(db, 'classes', classCode, 'students', studentId, 'recordings', recId),
        { teacherPoints: points, teacherFeedback: feedback, graded: true }
      )
      await updateDoc(
        doc(db, 'classes', classCode, 'students', studentId),
        { points: increment(points) }
      )
      return { success: true }
    } catch (e) { return { error: e.message } }
  }

  // ── Subscribe to a student's recordings ───────────────
  const listenStudentRecordings = (classCode, studentId, callback) => {
    if (demoMode.current) {
      const recs = (DEMO_RECORDINGS[studentId] || []).slice().sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))
      callback(recs)
      return () => {}
    }
    if (!firebaseReady) return () => {}
    const q = collection(db, 'classes', classCode, 'students', studentId, 'recordings')
    return onSnapshot(q, (snap) => {
      const recs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      recs.sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))
      callback(recs)
    })
  }

  return (
    <AuthContext.Provider value={{
      teacherUser, teacherData, students,
      authLoading, authError, setAuthError,
      register, login, logout,
      studentUser, studentData,
      studentAuthLoading, studentAuthError, setStudentAuthError,
      studentRegister, studentLogin, studentLogout,
      authInitialized,
      markReviewed, listenStudentRecordings,
      teacherAwardPoints, teacherAwardAchievement, teacherGradeRecording,
      isDemoMode: demoMode,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
