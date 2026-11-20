// The flip sound is whichever file in media starts with "flip". Drop one in to replace the built-in synthesized flip.
const files = import.meta.glob('../../media/flip*.{mp3,wav,ogg,m4a,aac}', {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>
const src = Object.values(files)[0]

let audio: HTMLAudioElement | undefined
let ctx: AudioContext | undefined

/**
 * The audio, if it may make a sound right now. Audio that hasn't been woken by a tap yet would hold the sound and
 * let it out at the next tap, with nothing happening. So while asleep it only plays inside a tap (which wakes it);
 * otherwise it stays quiet.
 */
function live() {
  ctx ??= new AudioContext()
  const awake = ctx.state === 'running'
  if (!awake) void ctx.resume()
  return awake || (navigator.userActivation?.isActive ?? true) ? ctx : null
}

/** A burst of noise through a filter, rising over `rise` seconds and dying away over the rest. */
function rustle({ dur, rise, type, from, to, q, gain }: { dur: number; rise: number; type: BiquadFilterType; from: number; to: number; q: number; gain: number }) {
  const c = live()
  if (!c) return
  const t = c.currentTime
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const data = buf.getChannelData(0)
  // mostly a hiss, with the odd louder grain: paper crackles
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (Math.random() < 0.025 ? 1 : 0.45)
  const noise = c.createBufferSource()
  noise.buffer = buf
  const filter = c.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(from, t)
  filter.frequency.exponentialRampToValueAtTime(to, t + dur)
  const amp = c.createGain()
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.exponentialRampToValueAtTime(gain, t + rise)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  noise.connect(filter).connect(amp).connect(c.destination)
  noise.start(t)
}

// A short filtered noise burst with a quick pitch drop, like a flipped switch or card.
function synth() {
  const ctx = live()
  if (!ctx) return
  const t = ctx.currentTime
  const len = Math.floor(ctx.sampleRate * 0.12)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2
  const noise = ctx.createBufferSource()
  noise.buffer = buf
  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.Q.value = 1.2
  filter.frequency.setValueAtTime(3200, t)
  filter.frequency.exponentialRampToValueAtTime(900, t + 0.1)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.5, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  noise.connect(filter).connect(gain).connect(ctx.destination)
  noise.start(t)
}

// Browsers only let sound start from a tap, click or key — never from a scroll. So the scroll-tripped lever (see
// Work.tsx) can only be heard once something on the page has been tapped. Every tap wakes the audio if it's
// asleep (a silent blip, which is what iOS wants), including after the phone has put it back to sleep.
function wake() {
  try {
    if (src) {
      if (!audio) {
        audio = new Audio(src)
        audio.load()
      }
      return
    }
    ctx ??= new AudioContext()
    if (ctx.state === 'running') return
    const blip = ctx.createBufferSource()
    blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate)
    blip.connect(ctx.destination)
    blip.start()
    void ctx.resume()
  } catch {
    // sound is a nicety
  }
}
if (typeof window !== 'undefined') {
  for (const t of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click', 'keydown']) addEventListener(t, wake, { capture: true, passive: true })
}

export function playFlip() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  try {
    if (src) {
      audio ??= new Audio(src)
      audio.currentTime = 0
      audio.play().catch(() => {})
    } else synth()
  } catch {
    // sound is a nicety; never break the toggle
  }
}

/** A sketchbook page turning over: a soft swish, brightest as the page lifts and dropping as it lands. */
export function playPage() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  try {
    rustle({ dur: 0.34, rise: 0.06, type: 'bandpass', from: 3800, to: 1300, q: 0.8, gain: 0.14 })
  } catch {
    // a nicety
  }
}

/** The sketchbook's hard cover, opening or closing: a dull little thump. */
export function playCover() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  try {
    rustle({ dur: 0.16, rise: 0.008, type: 'lowpass', from: 900, to: 240, q: 0.7, gain: 0.32 })
  } catch {
    // a nicety
  }
}
