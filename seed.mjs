/**
 * seed.mjs — Creates demo teacher + student accounts in Firebase
 * Run once: node seed.mjs
 */

import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth'
import { getFirestore, doc, setDoc } from 'firebase/firestore'

const firebaseConfig = {
  apiKey:            'AIzaSyC01pfch4MzlPSRWhWpOLUofEnTKtGyGCI',
  authDomain:        'practice-pal-90dfa.firebaseapp.com',
  projectId:         'practice-pal-90dfa',
  storageBucket:     'practice-pal-90dfa.firebasestorage.app',
  messagingSenderId: '198367848117',
  appId:             '1:198367848117:web:2ae4aac2dcee331dda80fc',
}

const app  = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db   = getFirestore(app)

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

const CLASS_CODE = 'ZKVRM6'  // Ms. Williams's class (registered via app UI)

const SESSIONS = [
  { id: 1, date: daysAgo(0), durationMinutes: 25, pointsEarned: 250 },
  { id: 2, date: daysAgo(1), durationMinutes: 20, pointsEarned: 200 },
  { id: 3, date: daysAgo(2), durationMinutes: 15, pointsEarned: 150 },
  { id: 4, date: daysAgo(3), durationMinutes: 12, pointsEarned: 120 },
  { id: 5, date: daysAgo(4), durationMinutes: 20, pointsEarned: 200 },
  { id: 6, date: daysAgo(5), durationMinutes: 10, pointsEarned: 100 },
  { id: 7, date: daysAgo(7), durationMinutes: 18, pointsEarned: 180 },
  { id: 8, date: daysAgo(9), durationMinutes: 22, pointsEarned: 220 },
]
// Total earned: 1420 pts
// Spent: Neon skin (50) + Flappy game (100) + Note Catcher (150) + Drum Dog pet (200) = 500
// Remaining: 920

async function getOrCreate(email, password, label) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    console.log(`✅ Created ${label}:`, cred.user.uid)
    return cred.user
  } catch (e) {
    if (e.code === 'auth/email-already-in-use') {
      const cred = await signInWithEmailAndPassword(auth, email, password)
      console.log(`ℹ️  ${label} already exists:`, cred.user.uid)
      return cred.user
    }
    throw e
  }
}

async function seed() {
  console.log('\n🌱 Seeding Firebase demo data...\n')

  // ── Demo Teacher ────────────────────────────────────────────
  const teacher = await getOrCreate(
    'demo.teacher@practicepal.com',
    'Demo1234!',
    'teacher'
  )

  const teacherData = {
    name:      'Ms. Williams',
    email:     'demo.teacher@practicepal.com',
    classCode: CLASS_CODE,
    createdAt: Date.now(),
  }
  await setDoc(doc(db, 'teachers', teacher.uid), teacherData)
  await setDoc(doc(db, 'users', teacher.uid), {
    role: 'teacher',
    ...teacherData,
  })
  console.log('📝 Teacher Firestore docs written')

  // ── Demo Student ────────────────────────────────────────────
  const student = await getOrCreate(
    'demo.student@practicepal.com',
    'Demo1234!',
    'student'
  )

  const studentUserData = {
    role:      'student',
    name:      'Jordan Lee',
    email:     'demo.student@practicepal.com',
    classCode: CLASS_CODE,
    createdAt: Date.now(),
  }
  await setDoc(doc(db, 'users', student.uid), studentUserData)

  await setDoc(doc(db, 'classes', CLASS_CODE, 'students', student.uid), {
    studentName: 'Jordan Lee',
    points:      920,
    sessions:    SESSIONS,
    streak:      6,
    lastActive:  Date.now(),
    unreviewed:  0,
    // Shop rewards already purchased
    ownedSkins:  ['default', 'neon'],
    activeSkin:  'neon',
    ownedGames:  ['flappy', 'catcher'],
    ownedPets:   [{ id: 'dog', xp: 90 }],
    activePet:   'dog',
  })
  console.log('📝 Student Firestore docs written')

  console.log('\n✨ Done!\n')
  console.log('  Class code :', CLASS_CODE)
  console.log('  Teacher    : demo.teacher@practicepal.com  /  Demo1234!')
  console.log('  Student    : demo.student@practicepal.com  /  Demo1234!\n')
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
}).finally(() => process.exit(0))
