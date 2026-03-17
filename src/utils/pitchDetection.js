// Autocorrelation-based pitch detection
// Works well for sustained single notes (trombone, trumpet, voice, etc.)

const NOTE_STRINGS = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']

export function detectPitch(buffer, sampleRate) {
  const SIZE = buffer.length

  // RMS — reject silence
  let rms = 0
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i]
  rms = Math.sqrt(rms / SIZE)
  if (rms < 0.015) return null // too quiet

  // Autocorrelation
  const MAX_SAMPLES = Math.floor(SIZE / 2)
  let bestOffset = -1
  let bestCorrelation = 0
  let lastCorrelation = 1
  let foundGoodCorrelation = false

  for (let offset = 1; offset < MAX_SAMPLES; offset++) {
    let correlation = 0
    for (let i = 0; i < MAX_SAMPLES; i++) {
      correlation += Math.abs(buffer[i] - buffer[i + offset])
    }
    correlation = 1 - correlation / MAX_SAMPLES

    if (correlation > 0.9 && correlation > lastCorrelation) {
      foundGoodCorrelation = true
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation
        bestOffset = offset
      }
    } else if (foundGoodCorrelation) {
      // Parabolic interpolation for sub-sample accuracy
      const shift =
        (bestOffset > 0 && bestOffset < MAX_SAMPLES - 1)
          ? (correlationAt(buffer, MAX_SAMPLES, bestOffset + 1) -
             correlationAt(buffer, MAX_SAMPLES, bestOffset - 1)) /
            (2 * (2 * correlationAt(buffer, MAX_SAMPLES, bestOffset) -
                  correlationAt(buffer, MAX_SAMPLES, bestOffset - 1) -
                  correlationAt(buffer, MAX_SAMPLES, bestOffset + 1)))
          : 0
      return sampleRate / (bestOffset + shift)
    }
    lastCorrelation = correlation
  }

  if (bestCorrelation > 0.01) return sampleRate / bestOffset
  return null
}

function correlationAt(buf, maxSamples, offset) {
  let c = 0
  for (let i = 0; i < maxSamples; i++) {
    c += Math.abs(buf[i] - buf[i + offset])
  }
  return 1 - c / maxSamples
}

export function freqToNote(freq) {
  if (!freq || freq < 20) return null
  // A4 = 440 Hz, MIDI note 69
  const semitones = 12 * Math.log2(freq / 440)
  const midiNote  = Math.round(semitones) + 69
  const cents     = Math.round((semitones - Math.round(semitones)) * 100)
  const octave    = Math.floor(midiNote / 12) - 1
  const name      = NOTE_STRINGS[((midiNote % 12) + 12) % 12]
  const idealFreq = 440 * Math.pow(2, (midiNote - 69) / 12)

  return { name, octave, cents, freq: Math.round(freq * 10) / 10, idealFreq }
}
