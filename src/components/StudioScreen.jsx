import { useState } from 'react'
import Tuner from './Tuner'
import Recorder from './Recorder'
import './StudioScreen.css'

export default function StudioScreen() {
  // null | 'tuner' | 'recorder'
  const [micOwner, setMicOwner] = useState(null)

  return (
    <div className="studio-screen">
      <header className="studio-screen__header">
        <div className="header-logo">🎙</div>
        <div>
          <h1 className="header-title">Studio</h1>
          <p className="header-sub">Tune up and record your takes</p>
        </div>
      </header>

      <div className="studio-screen__grid">
        <Tuner    micOwner={micOwner} setMicOwner={setMicOwner} />
        <Recorder micOwner={micOwner} setMicOwner={setMicOwner} />
      </div>
    </div>
  )
}
