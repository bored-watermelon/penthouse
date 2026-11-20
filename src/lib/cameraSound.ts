// The camera's sounds (CameraViewer.tsx), made up on the spot rather than recorded: the high little "pi" of every
// button, the double beep of the focus locking, the shutter, the zoom motor, and the chime as it powers on.

/** The camera's own Beep setting: every sound, only the shutter, or none. */
export type Beep = 'On' | 'Shutter' | 'Off'
export type Sfx = 'beep' | 'focus' | 'shutter' | 'on' | 'off' | 'error' | 'tick' | 'lens'

let ctx: AudioContext | null = null
function audio() {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(c: AudioContext, at: number, f: number, dur: number, gain = 0.05, type: OscillatorType = 'square') {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.value = f
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004)
  g.gain.setValueAtTime(gain, at + dur * 0.7)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(c.destination)
  o.start(at)
  o.stop(at + dur + 0.02)
}

function hiss(c: AudioContext, at: number, dur: number, type: BiquadFilterType, from: number, to: number, gain: number) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2
  const n = c.createBufferSource()
  n.buffer = buf
  const f = c.createBiquadFilter()
  f.type = type
  f.Q.value = 1
  f.frequency.setValueAtTime(from, at)
  f.frequency.exponentialRampToValueAtTime(to, at + dur)
  const g = c.createGain()
  g.gain.value = gain
  n.connect(f).connect(g).connect(c.destination)
  n.start(at)
}

/** A whirr, for as long as it's left running: the zoom (and the lens coming out). Call what it returns to stop it. */
export function motor(beep: Beep, pitch = 150) {
  const c = beep === 'On' ? audio() : null
  if (!c) return () => {}
  const t = c.currentTime
  const o = c.createOscillator()
  o.type = 'sawtooth'
  o.frequency.value = pitch
  const wobble = c.createOscillator()
  wobble.frequency.value = 23
  const depth = c.createGain()
  depth.gain.value = 12
  wobble.connect(depth).connect(o.frequency)
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = 650
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.03, t + 0.04)
  o.connect(f).connect(g).connect(c.destination)
  o.start(t)
  wobble.start(t)
  return () => {
    const e = c.currentTime
    g.gain.cancelScheduledValues(e)
    g.gain.setValueAtTime(g.gain.value, e)
    g.gain.exponentialRampToValueAtTime(0.0001, e + 0.06)
    o.stop(e + 0.08)
    wobble.stop(e + 0.08)
  }
}

export function sfx(kind: Sfx, beep: Beep) {
  if (beep === 'Off' || (beep === 'Shutter' && kind !== 'shutter')) return
  const c = audio()
  if (!c) return
  const t = c.currentTime + 0.005
  switch (kind) {
    case 'beep': // every button
      return tone(c, t, 2730, 0.045)
    case 'tick': // the self-timer counting down
      return tone(c, t, 2730, 0.07, 0.045)
    case 'focus': // the focus locking: "pi-pip"
      tone(c, t, 2730, 0.04)
      return tone(c, t + 0.075, 2730, 0.05)
    case 'error': // something it can't do
      tone(c, t, 880, 0.09, 0.05)
      return tone(c, t + 0.13, 880, 0.09, 0.05)
    case 'on': // powering on: three notes up
      return [1318.5, 1760, 2093].forEach((f, k) => tone(c, t + k * 0.085, f, 0.17, 0.06, 'sine'))
    case 'off': // and down
      return [1760, 1174.7].forEach((f, k) => tone(c, t + k * 0.1, f, 0.18, 0.06, 'sine'))
    case 'shutter': // the shutter, opening and closing: two clicks of noise and a little thud
      hiss(c, t, 0.05, 'bandpass', 4200, 2400, 0.55)
      tone(c, t, 170, 0.03, 0.08, 'triangle')
      return hiss(c, t + 0.085, 0.07, 'bandpass', 2700, 1300, 0.42)
    case 'lens': {
      // the lens running out
      const stop = motor(beep, 190)
      window.setTimeout(stop, 420)
      return
    }
  }
}
