import './PortalSelect.css'

export default function PortalSelect({ onSelect }) {
  return (
    <div className="portal-select">
      <div className="portal-select__card">
        <div className="portal-select__logo">🎵</div>
        <h1 className="portal-select__title">Practice Pal</h1>
        <p className="portal-select__sub">How are you using the app today?</p>

        <div className="portal-select__options">
          <button
            className="portal-btn portal-btn--student"
            onClick={() => onSelect('student')}
          >
            <span className="portal-btn__icon">🎺</span>
            <span className="portal-btn__label">I'm a Student</span>
            <span className="portal-btn__desc">Track practice sessions, earn points &amp; rewards</span>
          </button>

          <button
            className="portal-btn portal-btn--teacher"
            onClick={() => onSelect('teacher')}
          >
            <span className="portal-btn__icon">👩‍🏫</span>
            <span className="portal-btn__label">I'm a Teacher</span>
            <span className="portal-btn__desc">View students, grade recordings, award points</span>
          </button>
        </div>
      </div>
    </div>
  )
}
