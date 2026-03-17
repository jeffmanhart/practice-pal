import { initializeApp } from 'firebase/app'
import { getAuth }      from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage }   from 'firebase/storage'

// ─────────────────────────────────────────────────────────────
// SETUP STEPS:
//  1. console.firebase.google.com → create project
//  2. Authentication → Sign-in methods → enable Email/Password + Anonymous
//  3. Firestore Database → create (test mode is fine to start)
//  4. Storage → create (test mode)
//  5. Project Settings → Your apps → web app → copy config below
// ─────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey:            "AIzaSyC01pfch4MzlPSRWhWpOLUofEnTKtGyGCI",
  authDomain:        "practice-pal-90dfa.firebaseapp.com",
  projectId:         "practice-pal-90dfa",
  storageBucket:     "practice-pal-90dfa.firebasestorage.app",
  messagingSenderId: "198367848117",
  appId:             "1:198367848117:web:2ae4aac2dcee331dda80fc",
}

// True once you paste your real config above
export const firebaseReady = firebaseConfig.apiKey !== "YOUR_API_KEY"

const app        = firebaseReady ? initializeApp(firebaseConfig) : null
export const auth    = firebaseReady ? getAuth(app)               : null
export const db      = firebaseReady ? getFirestore(app)          : null
export const storage = firebaseReady ? getStorage(app)            : null
