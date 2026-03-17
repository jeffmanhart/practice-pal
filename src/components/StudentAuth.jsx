import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import './StudentAuth.css'

export default function StudentAuth({ onSkip }) {
  const {
    studentLogin, studentRegister,
    studentAuthLoading, studentAuthError, setStudentAuthError,
  } = useAuth()

  const [mode,      setMode]      = useState('login')
  const [name,      setName]      = useState('')
  const [email,     setEmail]     = useState('')
  const [pass,      setPass]      = useState('')
  const [classCode, setClassCode] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    setStudentAuthError(null)
    if (mode === 'login') studentLogin(email, pass)
    else                  studentRegister(name, email, pass, classCode)
  }

  const switchMode = () => {
    setMode(m => m === 'login' ? 'register' : 'login')
    setStudentAuthError(null)
  }

  return (
    <div className="student-auth">
      <div className="student-auth__card">
        <div className="student-auth__logo">🎵</div>
        <h1 className="student-auth__title">Practice Pal</h1>
        <p className="student-auth__sub">
          {mode === 'login' ? 'Sign in to track your practice!' : 'Join your class and start earning rewards!'}
        </p>

        <form className="student-auth__form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <input
              className="student-auth__input"
              type="text"
              placeholder="Your name (e.g. Alex)"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          )}

          <input
            className="student-auth__input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus={mode === 'login'}
            autoComplete="username"
          />

          <input
            className="student-auth__input"
            type="password"
            placeholder="Password (min 6 characters)"
            value={pass}
            onChange={e => setPass(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          {mode === 'register' && (
            <input
              className="student-auth__input student-auth__input--code"
              type="text"
              placeholder="Class code (ask your teacher)"
              value={classCode}
              onChange={e => setClassCode(e.target.value.toUpperCase())}
              maxLength={6}
              spellCheck={false}
            />
          )}

          {studentAuthError && (
            <p className="student-auth__error">{studentAuthError}</p>
          )}

          <button
            className="student-auth__btn student-auth__btn--primary"
            type="submit"
            disabled={studentAuthLoading}
          >
            {studentAuthLoading
              ? '⏳ Please wait…'
              : mode === 'login' ? '🎵 Sign In' : '🚀 Create Account'}
          </button>
        </form>

        <button className="student-auth__switch" onClick={switchMode}>
          {mode === 'login'
            ? "New here? Create a student account →"
            : "Already have an account? Sign in →"}
        </button>

        <div className="student-auth__divider"><span>or</span></div>

        <button className="student-auth__btn student-auth__btn--skip" onClick={onSkip}>
          Continue without account
        </button>
        <p className="student-auth__skip-hint">Progress saves on this device only</p>
      </div>
    </div>
  )
}
