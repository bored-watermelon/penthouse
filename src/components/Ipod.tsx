import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { songs, type Song } from '../lib/about'

/*
 * The iPod from the about box, opened: a 5th-generation iPod, working the way it did. The click wheel scrolls
 * (drag round it, or use a trackpad, or the arrow keys), MENU goes back, the centre button picks, and the four
 * buttons on the ring play, pause and skip. Its songs are whatever is in about/opened assets/songs.
 */

type Screen = 'main' | 'music' | 'songs' | 'artists' | 'artist' | 'extras' | 'settings' | 'about' | 'now' | 'clock'
type Entry = { id: Screen; sel: number; off: number; artist?: string } // sel: highlighted row, off: first row showing
type Row = { label: string; go?: () => void; more?: boolean; value?: string }
type Repeat = 'Off' | 'One' | 'All'

const ROWS = 5 // rows that fit whole on the screen (a sixth peeks in under them, as on the real thing)
const STEP = Math.PI / 10 // one click of the wheel: 18° of turn
const OWNER = 'Sneha’s iPod'

const artists = [...new Set(songs.map((s) => s.artist))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
const byArtist = (a: string) => songs.filter((s) => s.artist === a)
const time = (s: number) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')
const shuffled = <T,>(list: T[]) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// The wheel's click: a tiny burst of noise, like the one the iPod played through its own little speaker.
let sound: AudioContext | null = null
function click() {
  try {
    sound ??= new AudioContext()
    const n = Math.floor(sound.sampleRate * 0.004)
    const buf = sound.createBuffer(1, n, sound.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3
    const src = sound.createBufferSource()
    const gain = sound.createGain()
    gain.gain.value = 0.35
    src.buffer = buf
    src.connect(gain).connect(sound.destination)
    src.start()
  } catch {
    /* no audio: no click */
  }
}

function Chevron() {
  return (
    <svg className="ipod__more" viewBox="0 0 8 12" aria-hidden>
      <path d="M1.5 1.5 6 6l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** A menu row. The highlighted one scrolls a title that's too long to fit, back and forth, like the iPod did. */
function MenuRow({ row, on }: { row: Row; on: boolean }) {
  const text = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState(0)
  useLayoutEffect(() => {
    const t = text.current
    setShift(on && t ? Math.max(0, t.scrollWidth - t.clientWidth) : 0)
  }, [on, row.label])
  return (
    <li className={`ipod__row${on ? ' is-on' : ''}`}>
      <span ref={text} className="ipod__label">
        <span className={shift ? 'is-long' : ''} style={{ '--shift': `-${shift}px` } as React.CSSProperties}>
          {row.label}
        </span>
      </span>
      {row.value && <span className="ipod__value">{row.value}</span>}
      {row.more && <Chevron />}
    </li>
  )
}

export default function Ipod({ onClose }: { onClose: () => void }) {
  const [, render] = useReducer((n: number) => n + 1, 0)
  // where you are: a stack of screens, like the iPod's own menus (kept in a ref so a fast spin never loses a click)
  const nav = useRef<Entry[]>([{ id: 'main', sel: 0, off: 0 }])
  const audio = useRef<HTMLAudioElement>(null)
  const wheel = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [queue, setQueue] = useState<Song[]>([])
  const [at, setAt] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [clock, setClock] = useState({ cur: 0, dur: 0 })
  const volume = useRef(0.7)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<Repeat>('Off')
  const [clicker, setClicker] = useState(true)
  // on Now Playing the wheel sets the volume; a press of the centre switches it to scrubbing through the song
  const [dial, setDial] = useState<{ mode: 'volume' | 'scrub'; until: number } | null>(null)
  const [lit, setLit] = useState(true)
  const [battery, setBattery] = useState(0.8)
  const [now, setNow] = useState(() => new Date())
  const [leaving, setLeaving] = useState(false)
  const idle = useRef(0)
  const song = queue[at]
  const top = nav.current[nav.current.length - 1]

  // ----- the backlight: on at any touch, off after a while left alone -----
  const wake = () => {
    setLit(true)
    window.clearTimeout(idle.current)
    idle.current = window.setTimeout(() => setLit(false), 12000)
  }

  // ----- playing -----
  const load = (list: Song[], i: number, go = true) => {
    const a = audio.current!
    const s = list[i]
    if (!s) return
    setQueue(list)
    setAt(i)
    if (a.dataset.id !== s.id) {
      a.src = s.src
      a.dataset.id = s.id
    } else a.currentTime = 0
    a.volume = volume.current
    // straight from the tap, so a phone lets it play
    if (go) a.play().catch(() => {})
  }
  const playFrom = (list: Song[], i: number) => {
    if (shuffle) {
      const rest = shuffled(list.filter((_, k) => k !== i))
      load([list[i], ...rest], 0)
    } else load(list, i)
    push({ id: 'now' })
  }
  const toggle = () => {
    const a = audio.current!
    if (!song) {
      if (songs.length) playFrom(songs, 0)
      return
    }
    if (a.paused) a.play().catch(() => {})
    else a.pause()
  }
  const next = (ended = false) => {
    const a = audio.current!
    if (!song) return
    if (ended && repeat === 'One') {
      a.currentTime = 0
      a.play().catch(() => {})
      return
    }
    if (at + 1 < queue.length) load(queue, at + 1, ended || !a.paused)
    else if (repeat === 'All') load(queue, 0, ended || !a.paused)
    else if (ended) {
      // the end of the list: stop, back at the start of the last song
      a.currentTime = 0
      setPlaying(false)
    }
  }
  const prev = () => {
    const a = audio.current!
    if (!song) return
    if (a.currentTime > 3 || at === 0) a.currentTime = 0 // a little way in, ⏮ goes back to the start first
    else load(queue, at - 1, !a.paused)
  }

  // ----- the menus -----
  const push = (e: Omit<Entry, 'sel' | 'off'>) => {
    nav.current = [...nav.current, { sel: 0, off: 0, ...e }]
    render()
  }
  const back = () => {
    if (nav.current.length > 1) {
      nav.current = nav.current.slice(0, -1)
      setDial(null)
      render()
    }
  }
  const menu = (e: Entry): { title: string; rows: Row[]; empty?: string } | null => {
    switch (e.id) {
      case 'main':
        return {
          title: 'iPod',
          rows: [
            { label: 'Music', more: true, go: () => push({ id: 'music' }) },
            { label: 'Extras', more: true, go: () => push({ id: 'extras' }) },
            { label: 'Settings', more: true, go: () => push({ id: 'settings' }) },
            { label: 'Shuffle Songs', go: () => songs.length && (load(shuffled(songs), 0), push({ id: 'now' })) },
            { label: 'Backlight', go: () => wake() },
            ...(song ? [{ label: 'Now Playing', more: true, go: () => push({ id: 'now' }) }] : []),
          ],
        }
      case 'music':
        return {
          title: 'Music',
          rows: [
            { label: 'All Songs', more: true, go: () => push({ id: 'songs' }) },
            { label: 'Artists', more: true, go: () => push({ id: 'artists' }) },
          ],
        }
      case 'songs':
        return { title: 'All Songs', rows: songs.map((s, i) => ({ label: s.title, go: () => playFrom(songs, i) })), empty: 'No songs yet' }
      case 'artists':
        return { title: 'Artists', rows: artists.map((a) => ({ label: a, more: true, go: () => push({ id: 'artist', artist: a }) })), empty: 'No artists yet' }
      case 'artist': {
        const list = byArtist(e.artist!)
        return { title: e.artist!, rows: list.map((s, i) => ({ label: s.title, go: () => playFrom(list, i) })) }
      }
      case 'extras':
        return { title: 'Extras', rows: [{ label: 'Clock', more: true, go: () => push({ id: 'clock' }) }] }
      case 'settings':
        return {
          title: 'Settings',
          rows: [
            { label: 'About', more: true, go: () => push({ id: 'about' }) },
            { label: 'Shuffle', value: shuffle ? 'Songs' : 'Off', go: () => setShuffle((v) => !v) },
            { label: 'Repeat', value: repeat, go: () => setRepeat((r) => (r === 'Off' ? 'One' : r === 'One' ? 'All' : 'Off')) },
            { label: 'Clicker', value: clicker ? 'On' : 'Off', go: () => setClicker((v) => !v) },
          ],
        }
      default:
        return null
    }
  }

  // ----- the controls -----
  const scroll = (d: 1 | -1) => {
    wake()
    const t = nav.current[nav.current.length - 1]
    const m = menu(t)
    if (m) {
      const sel = Math.min(m.rows.length - 1, Math.max(0, t.sel + d))
      if (sel === t.sel) return // at the end of the list: no click, as on the iPod
      t.sel = sel
      if (sel < t.off) t.off = sel
      if (sel > t.off + ROWS - 1) t.off = sel - ROWS + 1
      if (clicker) {
        click()
        navigator.vibrate?.(2)
      }
      render()
      return
    }
    if (t.id === 'now' && song) {
      const a = audio.current!
      if (dial?.mode === 'scrub') {
        a.currentTime = Math.min(Math.max(0, a.currentTime + d * Math.max(2, (a.duration || 0) / 60)), (a.duration || 0) - 0.5)
        setDial({ mode: 'scrub', until: Date.now() + 3000 })
      } else {
        volume.current = Math.min(1, Math.max(0, volume.current + d * 0.0625))
        a.volume = volume.current
        setDial({ mode: 'volume', until: Date.now() + 1500 })
      }
      if (clicker) click()
    }
  }
  const select = () => {
    wake()
    const t = nav.current[nav.current.length - 1]
    const m = menu(t)
    if (m) {
      m.rows[t.sel]?.go?.()
      render()
    } else if (t.id === 'now' && song) setDial(dial?.mode === 'scrub' ? null : { mode: 'scrub', until: Date.now() + 3000 })
  }
  const press = (button: 'menu' | 'next' | 'prev' | 'play') => {
    wake()
    if (button === 'menu') back()
    else if (button === 'next') next()
    else if (button === 'prev') prev()
    else toggle()
  }
  const close = () => {
    setLeaving(true)
    window.setTimeout(onClose, 220)
  }
  // the handlers below live for the whole visit; they reach the current ones through this
  const api = useRef({ scroll, select, press, close })
  api.current = { scroll, select, press, close }

  // the volume or scrub bar goes away by itself after a moment
  useEffect(() => {
    if (!dial) return
    const t = window.setTimeout(() => setDial(null), dial.until - Date.now())
    return () => window.clearTimeout(t)
  }, [dial])

  // keys: ↑ ↓ scroll, ↵ picks, ← → skip, space plays or pauses, ⌫ goes back, esc closes
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const k: Record<string, () => void> = {
        ArrowDown: () => api.current.scroll(1),
        ArrowUp: () => api.current.scroll(-1),
        Enter: () => api.current.select(),
        ArrowRight: () => api.current.press('next'),
        ArrowLeft: () => api.current.press('prev'),
        ' ': () => api.current.press('play'),
        Backspace: () => api.current.press('menu'),
        Escape: () => api.current.close(),
      }
      if (k[e.key]) {
        e.preventDefault()
        k[e.key]()
      }
    }
    window.addEventListener('keydown', on)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', on)
      document.documentElement.style.overflow = ''
    }
  }, [])

  // a trackpad or mouse wheel turns the click wheel too
  useEffect(() => {
    const el = body.current!
    let acc = 0
    const on = (e: WheelEvent) => {
      e.preventDefault()
      acc += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX
      while (acc >= 36) {
        api.current.scroll(1)
        acc -= 36
      }
      while (acc <= -36) {
        api.current.scroll(-1)
        acc += 36
      }
    }
    el.addEventListener('wheel', on, { passive: false })
    return () => el.removeEventListener('wheel', on)
  }, [])

  // the battery: the real one, if the browser will say
  useEffect(() => {
    const nav2 = navigator as Navigator & { getBattery?: () => Promise<{ level: number }> }
    nav2.getBattery?.().then((b) => setBattery(b.level)).catch(() => {})
    wake()
    const t = window.setInterval(() => setNow(new Date()), 1000)
    return () => {
      window.clearInterval(t)
      window.clearTimeout(idle.current)
      audio.current?.pause() // put the iPod back in the box and it stops
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // the phone's lock screen and headphone buttons know what's playing
  useEffect(() => {
    const ms = navigator.mediaSession
    if (!ms || !song) return
    ms.metadata = new MediaMetadata({ title: song.title, artist: song.artist, album: OWNER })
    ms.setActionHandler('play', () => api.current.press('play'))
    ms.setActionHandler('pause', () => api.current.press('play'))
    ms.setActionHandler('nexttrack', () => api.current.press('next'))
    ms.setActionHandler('previoustrack', () => api.current.press('prev'))
  }, [song])

  // ----- the click wheel: drag round the ring to scroll, press a spot on it for that button -----
  const spin = useRef<{ id: number; a: number; acc: number; turned: number; button: 'menu' | 'next' | 'prev' | 'play' } | null>(null)
  const [held, setHeld] = useState<string | null>(null)
  const angle = (e: React.PointerEvent) => {
    const r = wheel.current!.getBoundingClientRect()
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
  }
  const onWheelDown = (e: React.PointerEvent) => {
    const a = angle(e)
    const q = Math.PI / 4
    const button = a > -3 * q && a < -q ? 'menu' : a >= -q && a <= q ? 'next' : a > q && a < 3 * q ? 'play' : 'prev'
    spin.current = { id: e.pointerId, a, acc: 0, turned: 0, button }
    setHeld(button)
    wheel.current!.setPointerCapture(e.pointerId)
  }
  const onWheelMove = (e: React.PointerEvent) => {
    const s = spin.current
    if (!s || s.id !== e.pointerId) return
    const a = angle(e)
    let d = a - s.a
    if (d > Math.PI) d -= 2 * Math.PI
    if (d < -Math.PI) d += 2 * Math.PI
    s.a = a
    s.acc += d
    s.turned += Math.abs(d)
    if (s.turned > 0.2) setHeld(null)
    // clockwise scrolls down the list, anticlockwise up
    while (s.acc >= STEP) {
      api.current.scroll(1)
      s.acc -= STEP
    }
    while (s.acc <= -STEP) {
      api.current.scroll(-1)
      s.acc += STEP
    }
  }
  const onWheelUp = (e: React.PointerEvent) => {
    const s = spin.current
    if (!s || s.id !== e.pointerId) return
    spin.current = null
    setHeld(null)
    if (s.turned < 0.2) api.current.press(s.button) // barely turned: that was a press
  }

  // ----- what's on the screen -----
  const m = menu(top)
  const lastBars = Math.max(1, Math.round(battery * 4))
  const title = m?.title ?? (top.id === 'now' ? 'Now Playing' : top.id === 'clock' ? 'Clock' : 'About')
  const progress = clock.dur ? clock.cur / clock.dur : 0

  return createPortal(
    <div className={`lightbox ipodview${leaving ? ' is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label={OWNER} onClick={close}>
      <div className="ipod" ref={body} onClick={(e) => e.stopPropagation()}>
        <audio
          ref={audio}
          preload="auto"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => next(true)}
          onTimeUpdate={(e) => setClock({ cur: e.currentTarget.currentTime, dur: e.currentTarget.duration })}
          onLoadedMetadata={(e) => setClock({ cur: 0, dur: e.currentTarget.duration })}
        />

        <div className={`ipod__screen${lit ? '' : ' is-dim'}`} aria-live="polite">
          <div className="ipod__bar">
            <span className="ipod__state" aria-label={playing ? 'playing' : song ? 'paused' : undefined}>
              {playing ? (
                <svg viewBox="0 0 10 10" aria-hidden>
                  <path d="M1.5 1v8l7-4z" fill="currentColor" />
                </svg>
              ) : song ? (
                <svg viewBox="0 0 10 10" aria-hidden>
                  <path d="M1.5 1h2.6v8H1.5zM5.9 1h2.6v8H5.9z" fill="currentColor" />
                </svg>
              ) : null}
            </span>
            <span className="ipod__title">{title}</span>
            <span className="ipod__battery" aria-label={`battery ${Math.round(battery * 100)}%`}>
              {Array.from({ length: 4 }, (_, i) => (
                <i key={i} className={i < lastBars ? 'is-on' : ''} />
              ))}
            </span>
          </div>

          {m && (
            <div className="ipod__view">
              {m.rows.length ? (
                <ul className="ipod__list" style={{ transform: `translateY(${-top.off * 1.82}em)` }}>
                  {m.rows.map((r, i) => (
                    <MenuRow key={`${top.id}-${i}`} row={r} on={i === top.sel} />
                  ))}
                </ul>
              ) : (
                <p className="ipod__empty">{m.empty}</p>
              )}
              {m.rows.length > ROWS && (
                <div className="ipod__scroll" aria-hidden>
                  <span style={{ top: `${(top.off / m.rows.length) * 100}%`, height: `${(ROWS / m.rows.length) * 100}%` }} />
                </div>
              )}
            </div>
          )}

          {top.id === 'now' && song && (
            <div className="ipod__now">
              <p className="ipod__count">
                {at + 1} of {queue.length}
              </p>
              <p className="ipod__song">{song.title}</p>
              <p className="ipod__artist">{song.artist}</p>
              {dial?.mode === 'volume' ? (
                <div className="ipod__vol" aria-label={`volume ${Math.round(volume.current * 100)}%`}>
                  <svg viewBox="0 0 12 12" aria-hidden>
                    <path d="M1 4.5h2.5L7 1.5v9L3.5 7.5H1z" fill="currentColor" />
                  </svg>
                  <span className="ipod__track">
                    <span style={{ width: `${volume.current * 100}%` }} />
                  </span>
                  <svg viewBox="0 0 12 12" aria-hidden>
                    <path d="M1 4.5h2.5L7 1.5v9L3.5 7.5H1z" fill="currentColor" />
                    <path d="M8.6 3.6a3.4 3.4 0 0 1 0 4.8M10 2.2a5.4 5.4 0 0 1 0 7.6" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                </div>
              ) : (
                <span className={`ipod__track${dial?.mode === 'scrub' ? ' is-scrub' : ''}`}>
                  <span style={{ width: `${progress * 100}%` }} />
                  {dial?.mode === 'scrub' && <i style={{ left: `${progress * 100}%` }} />}
                </span>
              )}
              <p className="ipod__times">
                <span>{time(clock.cur)}</span>
                <span>-{time(clock.dur - clock.cur)}</span>
              </p>
            </div>
          )}

          {top.id === 'clock' && (
            <div className="ipod__clock">
              <p className="ipod__clock-time">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
              <p>{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          )}

          {top.id === 'about' && (
            <div className="ipod__about">
              <p className="ipod__about-name">{OWNER}</p>
              <p>
                <span>Songs</span>
                <span>{songs.length}</span>
              </p>
              <p>
                <span>Artists</span>
                <span>{artists.length}</span>
              </p>
              <p>
                <span>Model</span>
                <span>5th generation</span>
              </p>
            </div>
          )}
        </div>

        <div className="ipod__wheel" ref={wheel} onPointerDown={onWheelDown} onPointerMove={onWheelMove} onPointerUp={onWheelUp} onPointerCancel={onWheelUp}>
          {/* real buttons for keyboards and screen readers; a pointer is handled by the ring itself */}
          <button type="button" className={`ipod__key ipod__key--menu${held === 'menu' ? ' is-held' : ''}`} onMouseDown={(e) => e.preventDefault()} onClick={(e) => e.detail === 0 && press('menu')}>
            MENU
          </button>
          <button type="button" className={`ipod__key ipod__key--prev${held === 'prev' ? ' is-held' : ''}`} aria-label="Previous" onMouseDown={(e) => e.preventDefault()} onClick={(e) => e.detail === 0 && press('prev')}>
            <svg viewBox="0 0 18 10" aria-hidden>
              <path d="M2 1v8M9 1 3 5l6 4zM16 1l-6 4 6 4z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className={`ipod__key ipod__key--next${held === 'next' ? ' is-held' : ''}`} aria-label="Next" onMouseDown={(e) => e.preventDefault()} onClick={(e) => e.detail === 0 && press('next')}>
            <svg viewBox="0 0 18 10" aria-hidden>
              <path d="M16 1v8M9 1l6 4-6 4zM2 1l6 4-6 4z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className={`ipod__key ipod__key--play${held === 'play' ? ' is-held' : ''}`} aria-label="Play or pause" onMouseDown={(e) => e.preventDefault()} onClick={(e) => e.detail === 0 && press('play')}>
            <svg viewBox="0 0 18 10" aria-hidden>
              <path d="M2 1.5v7l6-3.5zM11 1.5h2.2v7H11zM14.8 1.5H17v7h-2.2z" fill="currentColor" />
            </svg>
          </button>
          <button type="button" className="ipod__center" aria-label="Select" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.preventDefault()} onClick={() => select()} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
