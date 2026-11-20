import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { camera, type CameraPhoto } from '../lib/about'
import { motor, sfx, type Beep, type Sfx } from '../lib/cameraSound'
import CloseButton from './CloseButton'
import { useDialogFocus } from '../lib/dialogFocus'

/*
 * The camera from the about box, opened: the back of a silver Sony Cyber-shot, working the way one did.
 *
 *  POWER (on top)    on and off, with its chime
 *  shutter (on top)  press and hold to focus (pi-pip), let go to take the picture. In playback it goes back to shooting
 *  ▶ (playback)     between looking at the pictures and taking them
 *  W / T             zoom: in shooting, the lens; in playback, into a picture, and W at the widest is the 9-up index
 *  the control pad   ▲ DISP (what's shown on the screen), ◀ self-timer, ▶ flash, ▼ macro; in playback ◀ ▶ step
 *                    through the pictures (or move about a zoomed one), ● picks
 *  MENU              colour mode, grid lines, beeps; in playback, a slideshow
 *  🗑                deletes a picture: the visitor's own, that is, since mine are protected
 *
 * Shooting uses the visitor's own camera, asked for only when they switch to shooting. What they take stays in the
 * page for as long as it's open, like a memory card, and is never sent anywhere.
 */

type Shot = CameraPhoto & { mine?: boolean }
const roll: Shot[] = [] // the visitor's own pictures

type Color = 'Normal' | 'Vivid' | 'Sepia' | 'B&W'
const TINT: Record<Color, string> = { Normal: '', Vivid: 'saturate(1.45) contrast(1.08)', Sepia: 'sepia(0.85) contrast(1.05)', 'B&W': 'grayscale(1) contrast(1.1)' }
type Flash = 'Auto' | 'On' | 'Off'
type Settings = { color: Color; grid: boolean; beep: Beep; flash: Flash; timer: 0 | 2 | 10; macro: boolean }
// kept from one opening to the next, as a camera keeps them
const kept: Settings = { color: 'Normal', grid: false, beep: 'On', flash: 'Auto', timer: 0, macro: false }

type Item = { label: string; value?: string; change?: (d: 1 | -1) => void; act?: () => void }
type Pad = 'up' | 'down' | 'left' | 'right'

const ZOOMS = [1, 1.5, 2, 3, 4, 6, 8] // playback zoom steps
const MAX_ZOOM = 4 // the lens: a 4x zoom
const cycle = <T,>(list: readonly T[], v: T, d = 1) => list[(list.indexOf(v) + d + list.length) % list.length]
const fileNo = (s: Shot, i: number) => `${s.mine ? 101 : 100}-${String(i + 1).padStart(4, '0')}`
// the date (and time, when it's known) the way the camera wrote it: 2022 10 17  6:36PM
const stamp = ({ taken: d, timed }: Shot) =>
  d ? `${d.getFullYear()} ${d.getMonth() + 1} ${d.getDate()}${timed ? `  ${((d.getHours() + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')}${d.getHours() < 12 ? 'AM' : 'PM'}` : ''}` : ''

/** Fetches the first pictures as the box comes near, so the camera opens with them ready. */
export function preloadCamera() {
  camera.photos.slice(0, 2).forEach((p) => (new Image().src = p.src))
  camera.photos.slice(0, 9).forEach((p) => (new Image().src = p.thumb))
}

// ---------------------------------------------------------------- the little icons on the screen and the body

const I = {
  play: <path d="M3 2v8l7-4z" fill="currentColor" />,
  flash: <path d="M7 1 3 7h3l-1 4 4-6H6z" fill="currentColor" />,
  timer: (
    <>
      <circle cx="6" cy="6.6" r="4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M6 4.4v2.4l1.6 1M4.6 1h2.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </>
  ),
  macro: <path d="M6 11V6.4M6 6.4C3.2 6.4 2.6 4 2.8 1.8L4.6 3 6 1l1.4 2 1.8-1.2C9.4 4 8.8 6.4 6 6.4ZM6 9c-1.6-.2-2.6-1-3-2.2M6 9c1.6-.2 2.6-1 3-2.2" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />,
  trash: <path d="M2.5 3.2h7M4.6 3.2V2h2.8v1.2M3.4 3.2l.5 7h4.2l.5-7M5.1 5v3.4M6.9 5v3.4" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />,
  key: <path d="M4 7.6a2.4 2.4 0 1 1 1.7-.7L10.4 11.6M8.6 9.8 9.8 8.6" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />,
  wide: <path d="M1.5 3h3v3h-3zM7.5 3h3v3h-3zM1.5 7.5h3v3h-3zM7.5 7.5h3v3h-3z" fill="currentColor" />,
  tele: (
    <>
      <circle cx="5" cy="5" r="3.3" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="m7.4 7.4 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  warn: <path d="M6 1.2 11 10.4H1zM6 4.6v2.8M6 8.6v.3" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />,
}
const Ico = ({ i, className }: { i: React.ReactNode; className?: string }) => (
  <svg className={className ?? 'cam-ico'} viewBox="0 0 12 12" aria-hidden>
    {i}
  </svg>
)

function Battery({ level }: { level: number }) {
  const bars = Math.max(1, Math.round(level * 3))
  return (
    <span className="lcd__battery" aria-label={`battery ${Math.round(level * 100)}%`}>
      {[0, 1, 2].map((k) => (
        <i key={k} className={k < bars ? 'is-on' : ''} />
      ))}
    </span>
  )
}

export default function CameraViewer({ onClose }: { onClose: () => void }) {
  const [power, setPower] = useState<'off' | 'boot' | 'on'>('boot')
  const [mode, setMode] = useState<'shoot' | 'play'>('play')
  const [shots, setShots] = useState<Shot[]>(() => [...camera.photos, ...roll])
  const [at, setAt] = useState(0) // the picture on show
  const [grid, setGrid] = useState(false) // the 9-up index
  const [pz, setPz] = useState(1) // playback zoom
  const [pan, setPan] = useState({ x: 0, y: 0 }) // where a zoomed picture's looked at, as fractions of it from its middle
  const [osd, setOsd] = useState(true) // DISP: the screen's information on or off
  const [menu, setMenu] = useState<number | null>(null) // the highlighted row, while the menu's up
  const [ask, setAsk] = useState<0 | 1 | null>(null) // the delete prompt: Delete or Cancel highlighted
  const [note, setNote] = useState<{ text: string; warn?: boolean; n: number } | null>(null)
  const [lens, setLens] = useState<'idle' | 'asking' | 'live' | 'error'>('idle')
  const [zoom, setZoom] = useState(1)
  const [zooming, setZooming] = useState(false) // the zoom bar's showing
  const [focus, setFocus] = useState<'idle' | 'locked'>('idle')
  const [review, setReview] = useState<string | null>(null) // the picture just taken, shown for a moment
  const [blink, setBlink] = useState(false) // the screen going dark as the shutter fires
  const [count, setCount] = useState<number | null>(null) // the self-timer, counting down
  const [flashing, setFlashing] = useState(false)
  const [slides, setSlides] = useState(false)
  const [press, setPress] = useState<Pad | 'ok' | null>(null) // which way the pad's being pushed, to tip it that way
  const [set, setSet] = useState<Settings>(() => ({ ...kept }))
  const [battery, setBattery] = useState(0.85)
  const [leaving, setLeaving] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const wantLens = useRef(false)
  const timers = useRef<number[]>([])
  const zoomer = useRef<{ raf: number; stop: () => void } | null>(null)
  const shutterDown = useRef(false)

  const shot = shots[at]
  const on = power === 'on'
  const say = (s: Sfx) => sfx(s, set.beep)
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  const tell = (text: string, warn = false) => setNote({ text, warn, n: Date.now() })

  useEffect(() => {
    Object.assign(kept, set)
  }, [set])

  // ----- the lens: the visitor's camera, only while shooting -----
  const lensOff = () => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    setLens('idle')
  }
  const lensOn = async () => {
    if (stream.current) return setLens('live')
    if (!navigator.mediaDevices?.getUserMedia) return setLens('error')
    setLens('asking')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      if (!wantLens.current) return s.getTracks().forEach((t) => t.stop()) // switched away while it was asking
      stream.current = s
      setLens('live')
    } catch {
      setLens('error')
    }
  }
  useEffect(() => {
    wantLens.current = on && mode === 'shoot'
    if (wantLens.current) {
      if (lens === 'idle') void lensOn()
    } else if (lens !== 'idle') lensOff()
  }, [on, mode]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const v = video.current
    if (lens === 'live' && v && stream.current && v.srcObject !== stream.current) {
      v.srcObject = stream.current
      v.play().catch(() => {})
    }
  })

  // ----- power -----
  useEffect(() => {
    if (power !== 'boot') return
    const t = window.setTimeout(() => {
      setPower('on')
      if (mode === 'shoot') say('lens')
    }, 950)
    return () => window.clearTimeout(t)
  }, [power]) // eslint-disable-line react-hooks/exhaustive-deps
  const powerOn = (into: 'shoot' | 'play') => {
    setMode(into)
    setPower('boot')
    say('on')
  }
  const powerOff = () => {
    stopAll()
    setPower('off')
    say('off')
  }
  // everything that's under way stops: the timer, the slideshow, the menu, a zoom
  const stopAll = () => {
    timers.current.forEach(window.clearTimeout)
    timers.current = []
    setCount(null)
    setSlides(false)
    setMenu(null)
    setAsk(null)
    setReview(null)
    setFocus('idle')
    zoomEnd()
  }

  // ----- shooting -----
  const darkScene = () => {
    const v = video.current
    if (!v?.videoWidth) return false
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 12
    const x = c.getContext('2d', { willReadFrequently: true })!
    x.drawImage(v, 0, 0, 16, 12)
    const d = x.getImageData(0, 0, 16, 12).data
    let sum = 0
    for (let k = 0; k < d.length; k += 4) sum += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2]
    return sum / (d.length / 4) / 255 < 0.28
  }
  const capture = () => {
    const v = video.current
    if (lens !== 'live' || !v?.videoWidth) return tell('Camera error', true)
    const fire = set.flash === 'On' || (set.flash === 'Auto' && darkScene())
    say('shutter')
    setBlink(true)
    later(() => setBlink(false), 140)
    if (fire) {
      setFlashing(true)
      later(() => setFlashing(false), 260)
    }
    // the frame as the screen shows it: 4:3, cropped to the zoom, in the colour mode
    const [vw, vh] = [v.videoWidth, v.videoHeight]
    let [cw, ch] = vw / vh > 4 / 3 ? [vh * (4 / 3), vh] : [vw, vw * (3 / 4)]
    cw /= zoom
    ch /= zoom
    const out = document.createElement('canvas')
    out.width = Math.round(Math.min(cw, 1600))
    out.height = Math.round((out.width * 3) / 4)
    const x = out.getContext('2d')!
    x.filter = [TINT[set.color], fire ? 'brightness(1.12)' : ''].join(' ').trim() || 'none'
    x.drawImage(v, (vw - cw) / 2, (vh - ch) / 2, cw, ch, 0, 0, out.width, out.height)
    out.toBlob(
      (b) => {
        if (!b) return
        const url = URL.createObjectURL(b)
        roll.push({ src: url, thumb: url, taken: new Date(), timed: true, mine: true })
        setShots([...camera.photos, ...roll])
        setReview(url)
        later(() => setReview(null), 1500)
      },
      'image/jpeg',
      0.9,
    )
  }
  // half-press: focus. Full press: the picture (after the self-timer, if it's set)
  const half = () => {
    if (!on || count !== null) return
    if (mode === 'play' || menu !== null) {
      // in playback (or a menu), a half-press goes back to shooting, as it did
      stopAll()
      setMode('shoot')
      setGrid(false)
      say('lens')
      return
    }
    if (lens !== 'live') return
    shutterDown.current = true
    later(() => {
      if (!shutterDown.current) return
      setFocus('locked')
      say('focus')
    }, 220)
  }
  const full = () => {
    const was = shutterDown.current
    shutterDown.current = false
    if (!on || mode !== 'shoot' || lens !== 'live') return setFocus('idle')
    if (count !== null) {
      // pressing it again while the self-timer runs cancels it
      timers.current.forEach(window.clearTimeout)
      setCount(null)
      return say('beep')
    }
    if (!was) return
    if (!set.timer) {
      capture()
      return later(() => setFocus('idle'), 300)
    }
    // the self-timer: a beep a second, quickening for the last two
    const n = set.timer
    setCount(n)
    setFocus('idle')
    for (let k = 1; k <= n; k++) {
      later(() => {
        if (k === n) {
          setCount(null)
          return capture()
        }
        setCount(n - k)
        say('tick')
        if (n - k <= 2) {
          later(() => say('tick'), 250)
          later(() => say('tick'), 500)
        }
      }, k * 1000)
    }
    say('tick')
  }

  // ----- zoom: held down, it keeps going -----
  const zoomStart = (d: 1 | -1) => {
    if (!on) return
    if (mode === 'play') {
      say('beep')
      if (menu !== null || ask !== null) return
      if (grid) return d > 0 && setGrid(false)
      const k = ZOOMS.indexOf(pz)
      if (d < 0 && pz === 1) {
        setGrid(true)
        return
      }
      const next = ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, k + d))]
      setPz(next)
      setPan((p) => keepIn(p, next))
      return
    }
    if (lens !== 'live' || zoomer.current) return
    const stop = (zoom > 1 || d > 0) && (zoom < MAX_ZOOM || d < 0) ? motor(set.beep) : () => {}
    setZooming(true)
    let last = performance.now()
    const step = (t: number) => {
      const dt = (t - last) / 1000
      last = t
      setZoom((z) => Math.min(MAX_ZOOM, Math.max(1, z * Math.exp(d * 1.1 * dt))))
      zoomer.current!.raf = requestAnimationFrame(step)
    }
    zoomer.current = { raf: requestAnimationFrame(step), stop }
  }
  const zoomEnd = () => {
    if (!zoomer.current) return
    cancelAnimationFrame(zoomer.current.raf)
    zoomer.current.stop()
    zoomer.current = null
    later(() => setZooming(false), 1200)
  }
  const keepIn = (p: { x: number; y: number }, z: number) => {
    const lim = (1 - 1 / z) / 2
    return { x: Math.min(lim, Math.max(-lim, p.x)), y: Math.min(lim, Math.max(-lim, p.y)) }
  }

  // ----- the menu -----
  const items = (): Item[] => {
    const beep: Item = { label: 'Beep', value: set.beep, change: (d) => setSet((s) => ({ ...s, beep: cycle(['On', 'Shutter', 'Off'] as const, s.beep, d) })) }
    if (mode === 'play')
      return [
        {
          label: 'Slideshow',
          value: 'Start',
          act: () => {
            setMenu(null)
            if (!shots.length) return tell('No images')
            setSlides(true)
            setGrid(false)
            setPz(1)
          },
        },
        { label: 'Protect', value: shot?.mine ? 'Off' : 'On', act: () => tell(shot?.mine ? 'Only mine are protected' : 'This image is protected') },
        beep,
      ]
    return [
      { label: 'Color Mode', value: set.color, change: (d) => setSet((s) => ({ ...s, color: cycle(['Normal', 'Vivid', 'Sepia', 'B&W'] as const, s.color, d) })) },
      { label: 'Grid Line', value: set.grid ? 'On' : 'Off', change: () => setSet((s) => ({ ...s, grid: !s.grid })) },
      { label: 'Flash', value: set.flash, change: (d) => setSet((s) => ({ ...s, flash: cycle(['Auto', 'On', 'Off'] as const, s.flash, d) })) },
      beep,
    ]
  }

  // ----- the buttons -----
  const pad = (dir: Pad | 'ok') => {
    if (!on) return
    setPress(dir)
    later(() => setPress(null), 130)
    if (slides) {
      setSlides(false)
      return say('beep')
    }
    if (ask !== null) {
      say('beep')
      if (dir === 'up' || dir === 'down') return setAsk(ask ? 0 : 1)
      if (dir === 'ok') {
        if (ask === 0) {
          const s = shots[at]
          const k = roll.indexOf(s)
          if (k >= 0) {
            roll.splice(k, 1)
            URL.revokeObjectURL(s.src)
          }
          const left = [...camera.photos, ...roll]
          setShots(left)
          setAt((a) => Math.min(a, Math.max(0, left.length - 1)))
          tell('Deleted')
        }
        setAsk(null)
      }
      return
    }
    if (menu !== null) {
      say('beep')
      const list = items()
      if (dir === 'up') setMenu((menu - 1 + list.length) % list.length)
      else if (dir === 'down') setMenu((menu + 1) % list.length)
      else if (dir === 'left' || dir === 'right') list[menu].change?.(dir === 'left' ? -1 : 1)
      else if (list[menu].act) list[menu].act!()
      else setMenu(null)
      return
    }
    if (mode === 'play') {
      if (!shots.length) return say('error')
      say('beep')
      const n = shots.length
      if (grid) {
        const d = { left: -1, right: 1, up: -3, down: 3, ok: 0 }[dir]
        if (dir === 'ok') return setGrid(false)
        return setAt((a) => Math.min(n - 1, Math.max(0, a + d)))
      }
      if (pz > 1) {
        if (dir === 'ok') {
          setPz(1)
          return setPan({ x: 0, y: 0 })
        }
        const s = 0.12 / pz
        const d = { left: [-s, 0], right: [s, 0], up: [0, -s], down: [0, s] }[dir]
        return setPan((p) => keepIn({ x: p.x + d[0], y: p.y + d[1] }, pz))
      }
      if (dir === 'left') return setAt((a) => (a - 1 + n) % n)
      if (dir === 'right') return setAt((a) => (a + 1) % n)
      if (dir === 'up') return setOsd((o) => !o)
      return
    }
    // shooting
    say('beep')
    if (dir === 'up') setOsd((o) => !o)
    else if (dir === 'right') {
      const flash = cycle(['Auto', 'On', 'Off'] as const, set.flash)
      setSet((s) => ({ ...s, flash }))
      tell(`Flash: ${flash}`)
    } else if (dir === 'left') {
      const timer = cycle([0, 10, 2] as const, set.timer)
      setSet((s) => ({ ...s, timer }))
      tell(timer ? `Self-timer: ${timer} sec` : 'Self-timer: Off')
    } else if (dir === 'down') {
      setSet((s) => ({ ...s, macro: !s.macro }))
      tell(set.macro ? 'Macro: Off' : 'Macro: On')
    }
  }
  const menuButton = () => {
    if (!on) return
    say('beep')
    setSlides(false)
    setAsk(null)
    setMenu(menu === null ? 0 : null)
  }
  const playback = () => {
    if (power === 'off') return powerOn('play')
    if (!on) return
    say('beep')
    stopAll()
    if (mode === 'play') {
      setMode('shoot')
      say('lens')
    } else {
      setMode('play')
      setAt(Math.max(0, shots.length - 1)) // the newest picture first, as a camera does
      setPz(1)
      setPan({ x: 0, y: 0 })
      setGrid(false)
    }
  }
  const trash = () => {
    if (!on) return
    if (mode !== 'play' || menu !== null || !shot) return say('beep')
    if (!shot.mine) {
      say('error')
      return tell('This image is protected', true)
    }
    say('beep')
    setGrid(false)
    setAsk(1)
  }
  const dialog = useRef<HTMLDivElement>(null)
  useDialogFocus(dialog)
  const close = () => {
    stopAll()
    lensOff()
    setLeaving(true)
    window.setTimeout(onClose, 220)
  }

  // the slideshow: on to the next picture every few seconds, round and round
  useEffect(() => {
    if (!slides) return
    const t = window.setInterval(() => setAt((a) => (a + 1) % Math.max(1, shots.length)), 2800)
    return () => window.clearInterval(t)
  }, [slides, shots.length])

  // a message goes away by itself
  useEffect(() => {
    if (!note) return
    const t = window.setTimeout(() => setNote(null), 1700)
    return () => window.clearTimeout(t)
  }, [note])

  // the battery: the real one, if the browser will say
  useEffect(() => {
    const n = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }
    n.getBattery?.().then((b) => setBattery(b.level)).catch(() => {})
    const ts = timers.current
    return () => {
      ts.forEach(window.clearTimeout)
      stream.current?.getTracks().forEach((t) => t.stop())
      if (zoomer.current) {
        cancelAnimationFrame(zoomer.current.raf)
        zoomer.current.stop()
      }
    }
  }, [])

  // keys: arrows are the pad, ↵ is ●, space the shutter, M the menu, P playback, + and − zoom, ⌫ deletes, esc closes
  const api = useRef({ pad, menuButton, playback, trash, half, full, zoomStart, zoomEnd, close })
  useLayoutEffect(() => {
    api.current = { pad, menuButton, playback, trash, half, full, zoomStart, zoomEnd, close }
  })
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const a = api.current
      const k: Record<string, () => void> = {
        ArrowUp: () => a.pad('up'),
        ArrowDown: () => a.pad('down'),
        ArrowLeft: () => a.pad('left'),
        ArrowRight: () => a.pad('right'),
        Enter: () => a.pad('ok'),
        m: () => a.menuButton(),
        p: () => a.playback(),
        Backspace: () => a.trash(),
        Delete: () => a.trash(),
        Escape: () => a.close(),
      }
      if (e.key === ' ') {
        e.preventDefault()
        if (!e.repeat) a.half()
        return
      }
      if ((e.key === '+' || e.key === '=' || e.key === '-') && !e.repeat) {
        e.preventDefault()
        return a.zoomStart(e.key === '-' ? -1 : 1)
      }
      const fn = k[e.key] ?? k[e.key.toLowerCase()]
      if (fn && !(e.target instanceof HTMLButtonElement && e.key === 'Enter')) {
        e.preventDefault()
        fn()
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        e.preventDefault() // not a click on whichever button has focus as well
        api.current.full()
      }
      if (e.key === '+' || e.key === '=' || e.key === '-') api.current.zoomEnd()
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      document.documentElement.style.overflow = ''
    }
  }, [])

  // a button on the body: it beeps from its own handler, and a keyboard press of it (Enter, space) works too
  const hold = (start: () => void, end: () => void) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      start()
    },
    onPointerUp: end,
    onPointerCancel: end,
    onClick: (e: React.MouseEvent) => {
      if (e.detail !== 0) return // a pointer's handled above
      start()
      window.setTimeout(end, 300)
    },
  })
  const tap = (fn: () => void) => ({ onClick: fn })

  // ----- what's on the screen -----
  const list = menu !== null ? items() : []
  const page = Math.floor(at / 9) * 9
  const remaining = Math.max(0, 1586 - roll.length)

  const lcd = () => {
    if (power === 'off') return null
    if (power === 'boot') return <div className="lcd__boot">SONY</div>
    if (mode === 'play') {
      if (!shots.length) return <p className="lcd__empty">No images</p>
      if (grid)
        return (
          <div className="lcd__grid">
            {shots.slice(page, page + 9).map((s, k) => (
              <span key={s.src} className={page + k === at ? 'is-on' : ''}>
                <img src={s.thumb} alt="" draggable={false} />
              </span>
            ))}
          </div>
        )
      return (
        <>
          <div className="lcd__photo" style={{ transform: `scale(${pz}) translate(${-pan.x * 100}%, ${-pan.y * 100}%)` }}>
            <img key={shot.src} className={slides ? 'is-fading' : ''} src={shot.src} alt={`picture ${at + 1} of ${shots.length}`} draggable={false} />
          </div>
          {pz > 1 && (
            <>
              <span className="lcd__tag lcd__tag--zoom">×{pz.toFixed(1)}</span>
              <span className="lcd__map">
                <i style={{ width: `${100 / pz}%`, height: `${100 / pz}%`, left: `${(0.5 + pan.x - 0.5 / pz) * 100}%`, top: `${(0.5 + pan.y - 0.5 / pz) * 100}%` }} />
              </span>
            </>
          )}
          {osd && pz === 1 && !slides && (
            <div className="lcd__osd">
              <span className="lcd__tl">
                <Ico i={I.play} />
                {fileNo(shot, at)}
                {!shot.mine && <Ico i={I.key} />}
              </span>
              <span className="lcd__tr">
                <Battery level={battery} />
                <span>12M</span>
                <span>
                  {at + 1}/{shots.length}
                </span>
              </span>
              <span className="lcd__bl">{stamp(shot)}</span>
              <span className="lcd__br">◀▶ BACK/NEXT</span>
            </div>
          )}
        </>
      )
    }
    // shooting
    return (
      <>
        {lens === 'live' && (
          <video ref={video} className="lcd__live" muted playsInline style={{ scale: String(zoom), filter: TINT[set.color] || undefined }} />
        )}
        {lens === 'asking' && <p className="lcd__empty">Allow the camera in your browser to shoot</p>}
        {lens === 'error' && (
          <p className="lcd__empty lcd__empty--warn">
            <Ico i={I.warn} />
            Camera error
            <small>Allow camera access, then turn the power off and on again</small>
          </p>
        )}
        {set.grid && lens === 'live' && <div className="lcd__lines" />}
        {lens === 'live' && count === null && (
          <div className={`lcd__af${focus === 'locked' ? ' is-locked' : ''}`}>
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
        {count !== null && <span className="lcd__count">{count}</span>}
        {osd && (
          <div className="lcd__osd">
            <span className="lcd__tl">
              <span className="lcd__iauto">iAuto</span>
              <span className={`lcd__flash is-${set.flash.toLowerCase()}`}>
                <Ico i={I.flash} />
                {set.flash === 'Auto' && <b>A</b>}
              </span>
              {set.timer > 0 && (
                <span>
                  <Ico i={I.timer} />
                  {set.timer}
                </span>
              )}
              {set.macro && <Ico i={I.macro} />}
            </span>
            <span className="lcd__tr">
              <Battery level={battery} />
              <span>12M</span>
              <span>{remaining}</span>
            </span>
            {set.color !== 'Normal' && <span className="lcd__bl">{set.color}</span>}
          </div>
        )}
        {zooming && (
          <span className="lcd__zoom">
            W
            <i>
              <b style={{ width: `${((zoom - 1) / (MAX_ZOOM - 1)) * 100}%` }} />
            </i>
            T<small>×{zoom.toFixed(1)}</small>
          </span>
        )}
        {review && <img className="lcd__review" src={review} alt="the picture just taken" />}
      </>
    )
  }

  return createPortal(
    <div ref={dialog} tabIndex={-1} className={`lightbox camview${leaving ? ' is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label="my camera" onClick={close}>
      {flashing && <div className="cam-flash" aria-hidden />}
      <CloseButton onClose={close} />
      <div className="cam" onClick={(e) => e.stopPropagation()}>
        {/* on top: the power button, its lamp, and the shutter */}
        <button type="button" className={`cam__power${power !== 'off' ? ' is-on' : ''}`} aria-label={power === 'off' ? 'Power on' : 'Power off'} onClick={() => (power === 'off' ? powerOn('play') : powerOff())}>
          <span>POWER</span>
        </button>
        <button type="button" className="cam__shutter" aria-label="Shutter" {...hold(half, full)} onPointerLeave={() => shutterDown.current && setFocus('idle')} />

        <div className="cam__body">
          <div className="cam__bezel">
            <div className={`lcd${on ? ' is-on' : ''}${blink ? ' is-blink' : ''}`} aria-live="polite">
              {lcd()}
              {menu !== null && (
                <div className="lcd__menu">
                  <p className="lcd__menu-title">{mode === 'play' ? 'Playback menu' : 'Shooting menu'}</p>
                  <ul>
                    {list.map((it, k) => (
                      <li key={it.label} className={k === menu ? 'is-on' : ''}>
                        <span>{it.label}</span>
                        <span>{it.change && k === menu ? `◀ ${it.value} ▶` : it.value}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="lcd__menu-help">▲▼ select · ◀▶ change · MENU exit</p>
                </div>
              )}
              {ask !== null && (
                <div className="lcd__ask">
                  <p>Delete this image?</p>
                  <span className={ask === 0 ? 'is-on' : ''}>Delete</span>
                  <span className={ask === 1 ? 'is-on' : ''}>Cancel</span>
                </div>
              )}
              {note && on && (
                <p key={note.n} className={`lcd__note${note.warn ? ' is-warn' : ''}`}>
                  {note.warn && <Ico i={I.key} />}
                  {note.text}
                </p>
              )}
            </div>
          </div>
          <span className="cam__brand">Cyber-shot</span>

          {/* the zoom lever */}
          <div className="cam__zoom">
            <button type="button" aria-label="Zoom out (W)" {...hold(() => zoomStart(-1), zoomEnd)}>
              W<Ico i={I.wide} />
            </button>
            <button type="button" aria-label="Zoom in (T)" {...hold(() => zoomStart(1), zoomEnd)}>
              <Ico i={I.tele} />T
            </button>
          </div>

          <button type="button" className={`cam__btn cam__play${mode === 'play' && on ? ' is-lit' : ''}`} aria-label="Playback" {...tap(playback)}>
            <span className="cam__play-ico">
              <Ico i={I.play} />
            </span>
          </button>
          <span className="cam__speaker" aria-hidden />

          {/* the control pad: a ring that tips the way it's pressed, with the centre button in it */}
          <div className={`cam__pad${press ? ` is-${press}` : ''}`}>
            <span className="cam__ring" aria-hidden>
              <span className="cam__lbl cam__lbl--up">DISP</span>
              <Ico i={I.flash} className="cam__lbl cam__lbl--right" />
              <Ico i={I.macro} className="cam__lbl cam__lbl--down" />
              <Ico i={I.timer} className="cam__lbl cam__lbl--left" />
            </span>
            <button type="button" className="cam__dir cam__dir--up" aria-label="Up (DISP)" onClick={() => pad('up')} />
            <button type="button" className="cam__dir cam__dir--right" aria-label="Right (flash)" onClick={() => pad('right')} />
            <button type="button" className="cam__dir cam__dir--down" aria-label="Down (macro)" onClick={() => pad('down')} />
            <button type="button" className="cam__dir cam__dir--left" aria-label="Left (self-timer)" onClick={() => pad('left')} />
            <button type="button" className="cam__ok" aria-label="OK" onClick={() => pad('ok')} />
          </div>

          <button type="button" className="cam__btn cam__menu" {...tap(menuButton)}>
            <span>MENU</span>
          </button>
          <button type="button" className="cam__btn cam__trash" aria-label="Delete" {...tap(trash)}>
            <Ico i={I.trash} />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
