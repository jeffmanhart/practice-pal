export const PHASES = [
  {
    id: 'warmup',
    label: 'Warm-Up',
    icon: '🌡️',
    color: '#38bdf8',
    pct: 0.15,
    tips: [
      'Scales & arpeggios',
      'Long tones — focus on tone quality',
      'Slow, easy pieces you already know',
      'Lip slurs / basic technique patterns',
    ],
    desc: 'Get your body and mind ready to play. Don\'t rush.',
  },
  {
    id: 'technical',
    label: 'Technical Work',
    icon: '⚡',
    color: '#f59e0b',
    pct: 0.45,
    tips: [
      'Difficult passages — slow, then speed up',
      'Exercises & etudes',
      'Tricky rhythms or articulations',
      'Specific spots you want to improve',
    ],
    desc: 'The hard stuff. Go slow, be precise, then push the tempo.',
  },
  {
    id: 'repertoire',
    label: 'Repertoire',
    icon: '🎶',
    color: '#4ade80',
    pct: 0.40,
    tips: [
      'Full run-throughs of your pieces',
      'Practice performing — don\'t stop for mistakes',
      'Focus on musical expression & dynamics',
      'Record yourself and listen back',
    ],
    desc: 'Put it all together. Play like you\'re on stage.',
  },
]

// Minimum minutes before we show phase breakdown
export const MIN_MINUTES_FOR_PHASES = 8

export function calcPhases(totalSeconds) {
  const totalMins = totalSeconds / 60
  if (totalMins < MIN_MINUTES_FOR_PHASES) return null

  return PHASES.map(phase => {
    const secs = Math.round(totalSeconds * phase.pct)
    return { ...phase, seconds: secs }
  })
}
