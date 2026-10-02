export type Sound = 'beep' | 'beeps' | 'classical' | 'victory'

let ctx: AudioContext | undefined

// Browsers only allow audio after a user gesture; call this from a click handler.
export function unlock(): AudioContext {
  ctx ??= new AudioContext()
  void ctx.resume()
  return ctx
}

function tone(ac: AudioContext, freq: number, start: number, dur: number) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.2, start)
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
  osc.connect(gain).connect(ac.destination)
  osc.start(start)
  osc.stop(start + dur)
}

const [C, D, E, F, G] = [261.63, 293.66, 329.63, 349.23, 392.0]
// Opening phrase of Beethoven's "Ode to Joy" as [frequency, beats].
const ODE: [number, number][] = [
  [E, 1], [E, 1], [F, 1], [G, 1], [G, 1], [F, 1], [E, 1], [D, 1],
  [C, 1], [C, 1], [D, 1], [E, 1], [E, 1.5], [D, 0.5], [D, 2],
]
const BEAT = 0.5 // seconds

export function play(sound: Sound) {
  const ac = unlock()
  let t = ac.currentTime
  if (sound === 'beep') return tone(ac, 880, t, 0.3)
  if (sound === 'beeps') {
    for (let i = 0; i < 5; i++) tone(ac, 880, t + i * 0.25, 0.15)
    return
  }
  if (sound === 'victory') {
    // Rising C major arpeggio, then the full chord held.
    const chord = [523.25, 659.25, 783.99, 1046.5]
    chord.forEach((freq, i) => tone(ac, freq, t + i * 0.12, 0.12))
    for (const freq of chord) tone(ac, freq, t + 0.48, 1.2)
    return
  }
  for (const [freq, beats] of ODE) {
    tone(ac, freq, t, beats * BEAT * 0.95)
    t += beats * BEAT
  }
}
