import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { COVER, PAGE, coverArt, keepOn, singlePages, spreadPages, stickerCm, stickerSpots, stickers, type Page, type Spot } from '../lib/sketchbook'
import { clip, cut, path, rect, reflect, reflectCss, type Pt } from '../lib/fold'
import { playCover, playPage } from '../lib/flipSound'
import CloseButton from './CloseButton'
import { useDialogFocus } from '../lib/dialogFocus'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const easeOut = (t: number) => 1 - (1 - t) ** 3
/** How stiff the peeled corner's spring is: a mouse teasing it up, a finger holding it, and laying back down. */
const SPRING = { hover: 220, held: 900, lay: 380 }
const easeInOut = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)
const same = (a: Pt | null, b: Pt) => !!a && a.x === b.x && a.y === b.y

// ---------------------------------------------------------------- the stickers on the cover

/**
 * A sticker on the cover. On the opened-up book's cover it peels: press it and its nearest corner comes up to the
 * finger, folding back over itself; pull it far enough and it comes away whole, to be stuck down wherever it's let go.
 */
function CoverSticker({ i, spot, live }: { i: number; spot: Spot; live: boolean }) {
  const s = stickers[i]
  const el = useRef<HTMLDivElement>(null)
  const face = useRef<HTMLImageElement>(null)
  const back = useRef<HTMLDivElement>(null)
  const now = useRef(spot)
  useLayoutEffect(() => {
    now.current = spot
  })

  useEffect(() => {
    if (!live) return
    const box = el.current!
    const cover = box.parentElement!
    const faceEl = face.current!
    const backEl = back.current!
    const reduced = still()

    // The peeled corner is a spring: it's given somewhere to be (`target`), and eases there frame by frame, so
    // however the pointer jumps about, the paper moves smoothly. Everything's drawn at most once a frame.
    let G0: Pt | null = null // the corner being peeled, in the sticker's own px (before its tilt)
    let G: Pt | null = null // where it is now
    let V: Pt = { x: 0, y: 0 } // and how fast it's moving
    let target: Pt | null = null // where it's going: null to lie back down flat
    let next: Pt | null = null // a corner waiting its turn: the one up now lies down first
    let stiff = SPRING.hover
    let raf = 0
    let last = 0
    let hold: { id: number; free: boolean; off: Pt; at: Pt; start: Pt; reach: number } | null = null

    // its measurements, taken once at the start of a gesture rather than on every move (reading the layout straight
    // after the peel has changed it makes the browser lay the page out again, mid-frame)
    let geo = { w: 0, h: 0, k: 1, cx: 0, cy: 0, cover: new DOMRect() }
    let stale = true // it may have moved since: measured again at the next gesture
    const measure = () => {
      stale = false
      const r = box.getBoundingClientRect()
      const c = cover.getBoundingClientRect()
      geo = { w: box.offsetWidth, h: box.offsetHeight, k: c.width / cover.offsetWidth || 1, cx: r.left + r.width / 2, cy: r.top + r.height / 2, cover: c }
    }

    const draw = () => {
      const d = G0 && G ? Math.hypot(G0.x - G.x, G0.y - G.y) : 0
      if (!G0 || !G || d < 0.5) {
        faceEl.style.clipPath = ''
        backEl.style.visibility = 'hidden'
        return
      }
      const { w, h } = geo
      const n = { x: (G0.x - G.x) / d, y: (G0.y - G.y) / d }
      const m = { x: (G0.x + G.x) / 2, y: (G0.y + G.y) / 2 }
      const all = rect(0, 0, w, h)
      faceEl.style.clipPath = clip(cut(all, m, n, -1))
      backEl.style.clipPath = clip(cut(all, m, n, 1))
      backEl.style.transform = reflectCss(m, n)
      backEl.style.visibility = 'visible'
    }
    const frame = (t: number) => {
      raf = 0
      const dt = Math.min(0.032, (t - last) / 1000 || 0.016)
      last = t
      if (G0) {
        const to = target ?? G0
        G ??= { ...G0 }
        if (reduced) G = { ...to }
        else {
          // a critically damped spring: no overshoot, no wobble, just a quick settle
          const d = 2 * Math.sqrt(stiff)
          V = { x: V.x + ((to.x - G.x) * stiff - V.x * d) * dt, y: V.y + ((to.y - G.y) * stiff - V.y * d) * dt }
          G = { x: G.x + V.x * dt, y: G.y + V.y * dt }
        }
        let more = !(Math.hypot(to.x - G.x, to.y - G.y) < 0.3 && Math.hypot(V.x, V.y) < 4)
        if (!more) {
          G = { ...to }
          V = { x: 0, y: 0 }
          if (!target) {
            // lying flat: the corner waiting its turn comes up now, or it's done
            G0 = G = null
            if (next) {
              ;[G0, G, target, next] = [next, { ...next }, tease(next), null]
              more = true
            }
          }
        }
        draw()
        if (more) raf = requestAnimationFrame(frame)
      }
      if (hold?.free) place()
    }
    const run = () => {
      if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }

    // the pointer, in the sticker's own px
    const local = (ev: PointerEvent): Pt => {
      const { w, h, k, cx, cy } = geo
      const dx = (ev.clientX - cx) / k
      const dy = (ev.clientY - cy) / k
      const a = (-now.current.r * Math.PI) / 180
      return { x: dx * Math.cos(a) - dy * Math.sin(a) + w / 2, y: dx * Math.sin(a) + dy * Math.cos(a) + h / 2 }
    }
    // where a peel starts: the corner nearest the pointer, a little in from the corner of the picture, since a
    // cut-out's outline mostly is (a star's or a heart's corners are nothing but air)
    const cornerNear = (p: Pt): Pt => {
      const { w, h } = geo
      return { x: p.x < w / 2 ? w * 0.2 : w * 0.8, y: p.y < h / 2 ? h * 0.2 : h * 0.8 }
    }
    // with a mouse over it, that corner lifts a little: it'll peel
    const tease = (c: Pt): Pt => {
      const { w, h } = geo
      const k = Math.min(w, h) * 0.12
      return { x: c.x + (c.x < w / 2 ? k : -k), y: c.y + (c.y < h / 2 ? k : -k) }
    }

    const onEnter = (ev: PointerEvent) => ev.pointerType === 'mouse' && !hold && !G0 && measure()
    const onHover = (ev: PointerEvent) => {
      if (hold || ev.pointerType !== 'mouse') return
      if (stale && !G0) measure()
      const c = cornerNear(local(ev))
      stiff = SPRING.hover
      if (G0 && same(G0, c)) {
        next = null
        target = tease(c)
      } else if (G0) {
        // another corner: this one lies down, then that one comes up
        next = c
        target = null
      } else {
        G0 = c
        G = { ...c }
        target = tease(c)
      }
      run()
    }
    const onLeave = () => {
      if (hold) return
      next = null
      target = null
      stiff = SPRING.hover
      run()
    }
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0 || hold) return
      ev.stopPropagation() // the sticker's being picked at, not the cover opened
      ev.preventDefault()
      measure()
      const p = local(ev)
      const c = cornerNear(p)
      if (!G0 || !same(G0, c)) {
        // picked at another corner than the one teased up: that one goes, this one comes up
        G0 = c
        G = { ...c }
        V = { x: 0, y: 0 }
      }
      next = null
      // it comes away once pulled a good way on from where it was picked at, wherever that was on it
      const reach = Math.hypot(p.x - c.x, p.y - c.y) + Math.hypot(geo.w, geo.h) * 0.4
      const start = { x: now.current.x, y: now.current.y }
      hold = { id: ev.pointerId, free: false, off: { x: 0, y: 0 }, at: start, start, reach }
      box.classList.add('is-peeling')
      stiff = SPRING.held // the corner comes up to meet the finger, and keeps up with it
      target = p
      run()
      addEventListener('pointermove', onMove)
      addEventListener('pointerup', onUp)
      addEventListener('pointercancel', onUp)
    }
    let pointer: PointerEvent | null = null
    const onMove = (ev: PointerEvent) => {
      if (!hold || ev.pointerId !== hold.id) return
      pointer = ev
      if (!hold.free) {
        target = local(ev)
        if (Math.hypot(target.x - G0!.x, target.y - G0!.y) > hold.reach) unstick()
      }
      run()
    }
    // pulled far enough, it comes away whole, held a little in from the corner it was peeled by
    const unstick = () => {
      const { w, h, k } = geo
      const a = (now.current.r * Math.PI) / 180
      const lx = (G0!.x - w / 2) * 0.55
      const ly = (G0!.y - h / 2) * 0.55
      hold!.free = true
      hold!.off = { x: (lx * Math.cos(a) - ly * Math.sin(a)) * k, y: (lx * Math.sin(a) + ly * Math.cos(a)) * k }
      box.classList.remove('is-peeling')
      box.classList.add('is-free', 'is-catching') // it slides into the hand, rather than jumping there
      setTimeout(() => box.classList.remove('is-catching'), 180)
      stiff = SPRING.lay
      target = null // and lies flat in the hand
    }
    // carried: moved by its translate (drawn by the graphics card, no laying the cover out again), from where it was
    // picked up; it's only actually moved there when it's let go
    const place = () => {
      if (!hold || !pointer) return
      const r = geo.cover
      const at = keepOn(s, (pointer.clientX - hold.off.x - r.left) / r.width, (pointer.clientY - hold.off.y - r.top) / r.height, now.current.r)
      hold.at = at
      const dx = ((at.x - hold.start.x) * r.width) / geo.k
      const dy = ((at.y - hold.start.y) * r.height) / geo.k
      box.style.translate = `calc(-50% + ${dx.toFixed(1)}px) calc(-50% + ${dy.toFixed(1)}px)`
    }
    const onUp = (ev: PointerEvent) => {
      if (!hold || ev.pointerId !== hold.id) return
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerup', onUp)
      removeEventListener('pointercancel', onUp)
      box.classList.remove('is-peeling', 'is-free')
      if (hold.free) {
        // stuck down where it was let go, on top of the others, and pressed flat
        place()
        box.style.left = `${hold.at.x * 100}%`
        box.style.top = `${hold.at.y * 100}%`
        box.style.translate = ''
        box.classList.remove('is-pressed')
        void box.offsetWidth
        box.classList.add('is-pressed')
        stickerSpots.set(i, hold.at)
      }
      stiff = SPRING.lay
      target = null
      next = null
      hold = null
      pointer = null
      stale = true
      run()
    }
    const onPressed = () => box.classList.remove('is-pressed')

    box.addEventListener('pointerdown', onDown)
    box.addEventListener('pointerenter', onEnter)
    box.addEventListener('pointermove', onHover)
    box.addEventListener('pointerleave', onLeave)
    box.addEventListener('animationend', onPressed)
    return () => {
      cancelAnimationFrame(raf)
      box.removeEventListener('pointerdown', onDown)
      box.removeEventListener('pointerenter', onEnter)
      box.removeEventListener('pointermove', onHover)
      box.removeEventListener('pointerleave', onLeave)
      box.removeEventListener('animationend', onPressed)
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerup', onUp)
      removeEventListener('pointercancel', onUp)
      box.classList.remove('is-peeling', 'is-free', 'is-catching')
      box.style.translate = ''
      faceEl.style.clipPath = ''
    }
  }, [live, i, s])

  return (
    <div
      ref={el}
      className={`sticker${live ? ' is-live' : ''}`}
      style={{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%`, width: `${(stickerCm(s).w / COVER.w) * 100}%`, aspectRatio: `${s.width} / ${s.height}`, rotate: `${spot.r}deg`, zIndex: spot.z + 1 }}
    >
      <img ref={face} className="sticker__face" src={s.src} alt="" draggable={false} />
      {live && (
        <div className="sticker__lift">
          {/* its back, peeled over: the sticker's own outline, in the grey of a sticker's backing */}
          <div ref={back} className="sticker__back" style={{ WebkitMaskImage: `url("${s.src}")`, maskImage: `url("${s.src}")` }} />
        </div>
      )}
    </div>
  )
}

/** The sketchbook's cover, stickers and all: in the box (still), and on the opened-up book (where they peel). */
export function CoverFace({ live = false }: { live?: boolean }) {
  const spots = useSyncExternalStore(stickerSpots.subscribe, stickerSpots.get)
  return (
    <div className={`sbcover${coverArt ? ' has-art' : ''}`} style={coverArt ? { backgroundImage: `url("${coverArt}")` } : undefined}>
      {stickers.map((s, i) => (
        <CoverSticker key={`${s.id}-${i}`} i={i} spot={spots[i]} live={live} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- the pages

type Role = 'left' | 'under' | 'front' | 'back'

/** What's on a page: a drawing (or its half of one across the spread), or a bit of writing on the endpapers. */
function Ink({ page }: { page: Page }) {
  if (page.kind === 'art') {
    const { d, half } = page
    return (
      <>
        <div className={`sb__art${half ? ` sb__art--${half}` : ''}`}>
          <img src={d.src} alt={half === 'l' ? '' : d.caption || 'a drawing from my sketchbook'} draggable={false} />
        </div>
        {d.caption && half !== 'l' && <p className="sb__caption">{d.caption}</p>}
      </>
    )
  }
  if (page.kind === 'inside')
    return (
      <div className="sb__plate">
        <span className="sb__plate-print">this sketchbook belongs to</span>
        <span className="sb__plate-name">sneha</span>
        <span className="sb__plate-print">follow my dead instagram account</span>
        <a className="sb__plate-link" href={INSTAGRAM} target="_blank" rel="noreferrer">
          @bored._.melon
        </a>
      </div>
    )
  return null
}

/**
 * One page, in one of the four places a turn needs. "left" and "front" are the spread on show; "front" is the leaf
 * that turns, "back" is the other side of it (laid out as a left-hand page, then folded over in place), and "under"
 * is the page it uncovers. A page keeps its element as it moves between them, so its picture never reloads.
 */
function Leaf({ page, role, flipside }: { page: Page; role: Role; flipside?: boolean }) {
  const side = role === 'left' || role === 'back' ? 'l' : 'r'
  return (
    <div className={`sb__page sb__page--${side} sb__page--${role}${flipside ? ' is-flipside' : ''}`} data-kind={page.kind} aria-hidden={role === 'under' || role === 'back' || undefined}>
      <div className="sb__ink">
        <Ink page={page} />
      </div>
    </div>
  )
}

/** The edges of the pages, stacked up beside the open spread: as many as are left to turn (or have been). */
const edges = (dir: 1 | -1, leaves: number) => {
  const n = Math.min(5, Math.ceil(leaves / 3))
  return n ? Array.from({ length: n }, (_, i) => `${dir * (i + 1)}px 0 0 ${i % 2 ? '#fafaf9' : '#d6d3d1'}`).join(', ') : 'none'
}

// ---------------------------------------------------------------- the book

const INSTAGRAM = 'https://www.instagram.com/bored._.melon'
const RATIO = PAGE.h / PAGE.w
/** How high a turning page's corner rides as it goes over, as a share of the page's height. */
const LIFT = 0.12

/** A page's size, in px, and whether there's room for a whole spread (otherwise it's a page at a time). */
type Fit = { W: number; H: number; double: boolean }

function measure(): Fit {
  const small = innerWidth <= 860
  const room = innerHeight - (small ? 160 : 110) // room round it, and on a small screen for the arrows below it
  const wide = COVER.w / PAGE.w
  const tall = COVER.h / PAGE.h
  const make = (W: number, double: boolean) => ({ W: Math.round(W), H: Math.round(W * RATIO), double })
  const two = Math.min((innerWidth - (small ? 64 : 240)) / 2 / wide, room / RATIO / tall, 480)
  if (innerWidth >= 700 && two >= 250) return make(two, true)
  return make(Math.min((innerWidth - 40) / wide, room / RATIO / tall, 440), false)
}

/** The same place in the other layout, when the screen turns: the spread or page with the same drawing on it. */
function remap(at: number, toDouble: boolean) {
  if (toDouble) {
    const p = singlePages[at]
    if (p?.kind !== 'art') return at === 0 ? 0 : spreadPages.length / 2 - 1
    return Math.max(0, Math.floor(spreadPages.findIndex((q) => q.kind === 'art' && q.d === p.d) / 2))
  }
  const p = spreadPages.slice(2 * at, 2 * at + 2).find((q) => q.kind === 'art')
  if (p?.kind !== 'art') return at === 0 ? 0 : singlePages.length - 1
  return Math.max(0, singlePages.findIndex((q) => q.kind === 'art' && q.d === p.d))
}

/** Which pages are on show: the spread (or page) that's open, the leaf set up to turn, and whether the cover's in play. */
type View = { at: number; leaf: number; lid: boolean }

/**
 * The sketchbook from the box, opened up. Shut, it's the cover, whose stickers peel. Open, its pages turn like
 * paper: take hold of one anywhere (the corner nearest the finger is the one that lifts) and drag it over, or tap a
 * page, or use the arrows or the arrow keys. On a phone it's a page at a time.
 */
export default function Sketchbook({ onClose }: { onClose: () => void }) {
  const [fit, setFit] = useState(measure)
  const [view, setView] = useState<View>({ at: -1, leaf: 0, lid: true })
  const [leaving, setLeaving] = useState(false)
  const geo = useRef(fit)
  const book = useRef<HTMLDivElement>(null)
  const lid = useRef<HTMLDivElement>(null)
  const foldPath = useRef<SVGPathElement>(null)
  const foldGrad = useRef<SVGLinearGradientElement>(null)
  const castPath = useRef<SVGPathElement>(null)
  const blur = useRef<SVGFEGaussianBlurElement>(null)
  const glossPath = useRef<SVGPathElement>(null)
  const glossGrad = useRef<SVGLinearGradientElement>(null)
  const scrimDown = useRef(false)
  const leave = useRef(onClose)
  const api = useRef<{ go: (dir: 1 | -1) => void; draw: () => void; relayout: (toDouble: boolean) => void } | null>(null)

  useLayoutEffect(() => {
    geo.current = fit
    leave.current = onClose
  })

  // Everything that moves is drawn straight onto the elements, frame by frame; React only re-renders when a turn
  // starts or lands and the pages change places.
  useLayoutEffect(() => {
    const root = book.current!
    const e = {
      at: -1, // the spread (or, a page at a time, the page) that's open; -1 while the book's shut
      leaf: 0, // the leaf that's ready to turn: it lies over `leaf` and turns over to show `leaf + 1`
      lid: true, // the cover's in play: shut, or opening, or closing
      P: null as Pt | null, // where the turning leaf's corner is; null while it lies flat
      top: false, // whether it's the leaf's top corner that's turning, rather than its bottom one
      theta: 0, // how far the cover's open: 0 shut, π lying open on the left
      raf: 0,
      busy: false, // a turn's under way, by hand or by itself
      peek: false, // a corner's lifted under the mouse (or the cover's ajar), no more
      queued: 0 as -1 | 0 | 1, // a turn asked for while another was under way
    }
    // the pages change places now, before the next frame is drawn
    const sync = () => flushSync(() => setView({ at: e.at, leaf: e.leaf, lid: e.lid }))
    const lastOf = () => (geo.current.double ? spreadPages.length / 2 - 1 : singlePages.length - 1)
    const line = (g: SVGLinearGradientElement, a: Pt, b: Pt) => {
      g.setAttribute('x1', a.x.toFixed(1))
      g.setAttribute('y1', a.y.toFixed(1))
      g.setAttribute('x2', b.x.toFixed(1))
      g.setAttribute('y2', b.y.toFixed(1))
    }

    // ----- drawing -----

    // The turning leaf. Its corner is at P; the crease is halfway between there and where the corner lies flat, square
    // to the line between them. The leaf's front is cut along the crease, and its back is folded over it.
    const drawLeaf = () => {
      const { W, H } = geo.current
      const front = root.querySelector<HTMLElement>('.sb__page--front')
      const back = root.querySelector<HTMLElement>('.sb__page--back')
      const shapes = [foldPath.current!, castPath.current!, glossPath.current!]
      const C = { x: 2 * W, y: e.top ? 0 : H }
      const P = e.P
      const d = P ? Math.hypot(C.x - P.x, C.y - P.y) : 0
      if (!P || d < 0.5) {
        if (front) front.style.clipPath = ''
        if (back) back.style.visibility = 'hidden'
        shapes.forEach((s) => s.setAttribute('d', ''))
        return
      }
      const n = { x: (C.x - P.x) / d, y: (C.y - P.y) / d }
      const m = { x: (C.x + P.x) / 2, y: (C.y + P.y) / 2 }
      const sheet = rect(W, 0, W, H)
      const lifted = cut(sheet, m, n, 1)
      const flap = lifted.map((p) => reflect(p, m, n))
      if (front) front.style.clipPath = clip(cut(sheet, m, n, -1), W, 0)
      if (back) {
        // the back is laid out as a left-hand page: mirrored across the spine onto the leaf, then folded over the crease
        const [a, b, c] = [1 - 2 * n.x * n.x, -2 * n.x * n.y, 1 - 2 * n.y * n.y]
        const k = 2 * (m.x * n.x + m.y * n.y)
        back.style.transform = `matrix(${-a}, ${-b}, ${b}, ${c}, ${2 * W * a + k * n.x}, ${2 * W * b + k * n.y})`
        back.style.clipPath = clip(lifted.map((p) => ({ x: 2 * W - p.x, y: p.y })))
        back.style.visibility = 'visible'
      }
      // The light on it. A corner curling up off the page shades as deeply as a page standing on its spine; the
      // light only evens out as the page lies down on the other side. And a corner that's barely lifted, barely.
      const over = clamp((2 * W - P.x) / (2 * W), 0, 1)
      const up = Math.sin(Math.PI * over)
      const lit = over < 0.5 ? 1 : up
      const reach = Math.min(1, d / (W * 0.3))
      const [fold, cast, gloss] = shapes
      // the shadow it leaves on the page it's uncovering, darkest in the crease
      fold.setAttribute('d', path(lifted))
      fold.setAttribute('opacity', (reach * Math.sqrt(lit)).toFixed(3))
      const deep = clamp(d * 0.28, 6, W * 0.32)
      line(foldGrad.current!, m, { x: m.x + n.x * deep, y: m.y + n.y * deep })
      // the shadow it casts on what's under it
      cast.setAttribute('d', path(flap))
      cast.setAttribute('opacity', (0.3 * reach * lit).toFixed(3))
      blur.current!.setAttribute('stdDeviation', (3 + 9 * up).toFixed(1))
      // and the sheen along its back as it curls over
      gloss.setAttribute('d', path(flap))
      gloss.setAttribute('opacity', (reach * lit ** 0.7).toFixed(3))
      line(glossGrad.current!, m, P)
    }

    // The cover swings on the spine. Shut, the book sits in the middle; open, the spread does.
    const drawCover = () => {
      const { W, double } = geo.current
      const open = !double ? 0 : e.lid ? easeInOut(e.theta / Math.PI) : 1
      root.style.translate = `${(-W / 2) * (1 - open)}px 0`
      if (!lid.current) return
      lid.current.style.transform = `rotateY(${(-e.theta * 180) / Math.PI}deg)`
      // its outside darkens as it swings up off the pages, its inside lightens as it comes down
      lid.current.style.setProperty('--dim', (Math.sin(e.theta) * 0.4).toFixed(3))
      // and the page under it is in its shadow until it's well clear
      root.style.setProperty('--lid-shade', (0.45 * (1 - e.theta / Math.PI) ** 2).toFixed(3))
    }

    // ----- moving -----

    const animate = (ms: number, ease: (t: number) => number, frame: (k: number) => void, done?: () => void) => {
      cancelAnimationFrame(e.raf)
      const t0 = performance.now()
      const step = (t: number) => {
        // a frame's time can be from just before the move was started: never let that run it backwards, past where
        // it starts (a corner pushed out past the page's own corner turns the whole page over for a frame)
        const k = still() || ms <= 0 ? 1 : clamp((t - t0) / ms, 0, 1)
        frame(ease(k))
        if (k < 1) e.raf = requestAnimationFrame(step)
        else {
          e.raf = 0
          done?.()
        }
      }
      e.raf = requestAnimationFrame(step)
    }
    // the curve a corner rides as the leaf goes over: rising off the page, highest over the spine
    const arc = (x: number) => {
      const { W, H } = geo.current
      const lift = Math.sin(Math.PI * clamp((2 * W - x) / (2 * W), 0, 1)) * H * LIFT
      return e.top ? lift : H - lift
    }
    const within = (p: Pt, c: Pt, r: number) => {
      const dx = p.x - c.x
      const dy = p.y - c.y
      const d = Math.hypot(dx, dy)
      return d <= r ? p : { x: c.x + (dx * r) / d, y: c.y + (dy * r) / d }
    }
    // A leaf is bound into the spine, so its corner can't go further from either end of the spine than the paper
    // reaches, nor past the edge it's on.
    const hold = (p: Pt) => {
      const { W, H } = geo.current
      const y = e.top ? Math.max(0, p.y) : Math.min(H, p.y)
      return within(within({ x: p.x, y }, { x: W, y: e.top ? 0 : H }, W), { x: W, y: e.top ? H : 0 }, Math.hypot(W, H))
    }

    const finish = () => {
      e.busy = false
      sync()
      if (e.queued) {
        const q = e.queued
        e.queued = 0
        go(q, true)
      }
    }
    // Lets a turning leaf go: `over` lands it turned over on the left, otherwise back down where it came from. It
    // carries on along the curve from wherever the finger left it.
    const drop = (over: boolean, auto = false, quick = false) => {
      const { W } = geo.current
      const from = e.P!
      const to = over ? 0 : 2 * W
      const off = from.y - arc(from.x)
      const landing = over ? e.leaf + 1 : e.leaf
      if (landing !== e.at) playPage()
      e.busy = true
      animate(
        auto ? (quick ? 380 : 640) : 200 + (380 * Math.abs(to - from.x)) / (2 * W),
        auto ? easeInOut : easeOut,
        (k) => {
          const x = from.x + (to - from.x) * k
          e.P = hold({ x, y: arc(x) + off * (1 - k) })
          drawLeaf()
        },
        () => {
          e.at = e.leaf = landing
          e.P = null
          finish()
        },
      )
    }
    // the cover swings open, or shut
    const swing = (open: boolean, auto = false, quick = false) => {
      const from = e.theta
      const to = open ? Math.PI : 0
      const was = e.at >= 0
      e.busy = true
      animate(
        auto ? (quick ? 480 : 760) : 220 + (420 * Math.abs(to - from)) / Math.PI,
        auto ? easeInOut : easeOut,
        (k) => {
          e.theta = from + (to - from) * k
          drawCover()
        },
        () => {
          if (open !== was) playCover()
          e.at = open ? 0 : -1
          e.lid = !open
          e.leaf = 0
          finish()
        },
      )
    }
    // the cover comes back into play, lying open on the left, to be shut
    const raiseLid = () => {
      e.lid = true
      e.theta = Math.PI
      e.leaf = 0
      sync()
    }
    // a lifted corner (or the cover, ajar) settles back down
    const unpeek = (glide: boolean) => {
      if (!e.peek) return
      e.peek = false
      const { W, H } = geo.current
      if (e.lid) {
        const from = e.theta
        if (glide)
          animate(260, easeOut, (k) => {
            e.theta = from * (1 - k)
            drawCover()
          })
        return
      }
      const from = e.P
      cancelAnimationFrame(e.raf)
      if (!from || !glide) {
        e.P = null
        return drawLeaf()
      }
      const rest = { x: 2 * W, y: e.top ? 0 : H }
      animate(
        220,
        easeOut,
        (k) => {
          e.P = { x: from.x + (rest.x - from.x) * k, y: from.y + (rest.y - from.y) * k }
          drawLeaf()
        },
        () => {
          e.P = null
          drawLeaf()
        },
      )
    }

    /**
     * Turns a page on (1) or back (-1), by itself: for a tap, the arrows and the arrow keys. Asked again before a turn
     * has landed, the next one waits for it and goes quicker, so tapping away (or holding a key) leafs through.
     */
    const go = (dir: 1 | -1, quick = false) => {
      if (e.busy) {
        e.queued = dir
        return
      }
      const { W, H } = geo.current
      if (dir > 0 ? e.at >= lastOf() : e.at < 0) return
      const lifted = e.peek && dir > 0
      e.peek = false
      cancelAnimationFrame(e.raf)
      if (e.at < 0) return swing(true, true, quick)
      if (dir > 0) {
        // carry on from a corner that's already lifted under the mouse
        if (!lifted || !e.P) {
          e.top = false
          e.P = { x: 2 * W, y: H }
        }
        return drop(true, true, quick)
      }
      e.P = null
      if (e.at === 0) {
        raiseLid()
        return swing(false, true, quick)
      }
      e.top = false
      e.P = { x: 0, y: H }
      e.leaf = e.at - 1
      sync()
      drop(false, true, quick)
    }

    // ----- by hand -----

    type Grip = { id: number; x0: number; y0: number; moved: boolean; kind: 'cover' | 'leaf' | null; base: Pt; r: number; edge: number; vx: number; lx: number; lt: number }
    let grip: Grip | null = null

    // the pointer, in the book's own px: the spine's at x = W, whatever the book's been moved or scaled by
    const toBook = (ev: { clientX: number; clientY: number }): Pt => {
      const r = root.getBoundingClientRect()
      const { W, H } = geo.current
      return { x: ((ev.clientX - r.left) * 2 * W) / r.width, y: ((ev.clientY - r.top) * H) / r.height }
    }

    // Takes hold of the cover or a leaf, going on (1) or back (-1). False if there's nothing that way.
    const begin = (g: Grip, dir: 1 | -1) => {
      const { W, H, double } = geo.current
      if (e.busy) return false
      if (e.at < 0 || (dir < 0 && e.at === 0)) {
        if (e.at < 0 && dir < 0) return false
        g.kind = 'cover'
        // The cover's held where it was taken hold of, r from the spine (and no nearer than halfway out, so it can't
        // spin wildly round a finger right by the spine), and that point follows the finger. It starts from
        // wherever the cover is: shut, ajar under the mouse, or lying open.
        if (e.at < 0) {
          g.r = Math.max(g.x0 - W, W * 0.5)
          e.peek = false
          cancelAnimationFrame(e.raf)
        } else {
          g.r = double ? Math.max(W - g.x0, W * 0.5) : W
          unpeek(false)
          raiseLid()
        }
        g.edge = W + g.r * Math.cos(e.theta)
        e.busy = true
        return true
      }
      if (dir > 0 && e.at >= lastOf()) return false
      g.kind = 'leaf'
      const top = g.y0 < H / 2
      if (dir > 0) {
        const lifted = e.peek && e.top === top && e.P
        cancelAnimationFrame(e.raf)
        e.peek = false
        e.top = top
        if (!lifted) e.P = { x: 2 * W, y: top ? 0 : H }
      } else {
        unpeek(false)
        e.top = top
        e.P = { x: 0, y: top ? 0 : H }
        e.leaf = e.at - 1
        sync()
      }
      g.base = { ...e.P! }
      e.busy = true
      return true
    }

    const onMove = (ev: PointerEvent) => {
      const g = grip
      if (!g || ev.pointerId !== g.id) return
      const p = toBook(ev)
      const t = performance.now()
      if (t > g.lt) {
        g.vx = g.vx * 0.6 + ((p.x - g.lx) / (t - g.lt)) * 0.4
        g.lx = p.x
        g.lt = t
      }
      const dx = p.x - g.x0
      const dy = p.y - g.y0
      const { W, double } = geo.current
      if (!g.moved) {
        if (Math.hypot(dx, dy) < 6) return
        g.moved = true
        // which way it's going: on a spread, whichever side was taken hold of; a page at a time, the way it's pulled
        const dir = double ? (g.x0 >= W ? 1 : -1) : dx < 0 ? 1 : -1
        if ((!double && Math.abs(dy) > Math.abs(dx) * 1.5) || !begin(g, dir)) return
      }
      if (g.kind === 'cover') {
        e.theta = Math.acos(clamp((g.edge + dx - W) / g.r, -1, 1))
        drawCover()
      } else if (g.kind === 'leaf') {
        const x = g.base.x + dx
        e.P = hold({ x, y: arc(x) + (g.base.y - arc(g.base.x)) + dy })
        drawLeaf()
      }
    }
    const onUp = (ev: PointerEvent) => {
      const g = grip
      if (!g || ev.pointerId !== g.id) return
      stop()
      const { W, double } = geo.current
      if (!g.moved) {
        // a tap: on a spread the right-hand page goes on and the left-hand one back; a page at a time, it's the
        // page's left edge that goes back
        return go(e.at < 0 || g.x0 >= W + (double ? 0 : W * 0.3) ? 1 : -1)
      }
      // a flick goes the way it was flicked; otherwise it lands whichever side of halfway it was let go
      const fling = g.vx < -0.3 ? 1 : g.vx > 0.3 ? -1 : 0
      if (g.kind === 'cover') swing(fling ? fling > 0 : e.theta > Math.PI / 2)
      else if (g.kind === 'leaf') drop(fling ? fling > 0 : e.P!.x < W)
    }
    const stop = () => {
      grip = null
      removeEventListener('pointermove', onMove)
      removeEventListener('pointerup', onUp)
      removeEventListener('pointercancel', onUp)
    }
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0 || grip) return
      if ((ev.target as Element).closest('a')) return // a link on a page (the nameplate's): it's followed, not turned
      ev.preventDefault()
      const p = toBook(ev)
      grip = { id: ev.pointerId, x0: p.x, y0: p.y, moved: false, kind: null, base: p, r: 0, edge: 0, vx: 0, lx: p.x, lt: performance.now() }
      addEventListener('pointermove', onMove)
      addEventListener('pointerup', onUp)
      addEventListener('pointercancel', onUp)
    }

    // With a mouse, a page's outside corners lift a little as it comes near them, and the cover comes ajar near its
    // edge: they can be taken hold of.
    const onHover = (ev: PointerEvent) => {
      if (ev.pointerType !== 'mouse' || ev.buttons || grip || e.busy) return
      const { W, H } = geo.current
      const p = toBook(ev)
      if (e.lid) {
        const near = e.at < 0 && p.x > 2 * W - W * 0.16
        if (near === e.peek) return
        if (!near) return unpeek(true)
        e.peek = true
        const from = e.theta
        return animate(300, easeOut, (k) => {
          e.theta = from + (0.22 - from) * k
          drawCover()
        })
      }
      const near = e.at < lastOf() && p.x > 2 * W - W * 0.2 && (p.y < H * 0.2 || p.y > H * 0.8)
      const top = p.y < H / 2
      if (!near) return unpeek(true)
      if (e.peek && e.top === top) return
      if (!e.peek || e.top !== top || !e.P) {
        e.top = top
        e.P = { x: 2 * W, y: top ? 0 : H }
      }
      e.peek = true
      const from = { ...e.P }
      const tx = 2 * W - W * 0.13
      const to = hold({ x: tx, y: arc(tx) + (top ? H * 0.03 : -H * 0.03) })
      animate(280, easeOut, (k) => {
        e.P = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }
        drawLeaf()
      })
    }
    const onLeave = () => {
      if (!grip && !e.busy) unpeek(true)
    }

    // the screen's changed from a spread to a page at a time, or back: same place, other layout
    const relayout = (toDouble: boolean) => {
      stop()
      cancelAnimationFrame(e.raf)
      e.busy = e.peek = false
      e.queued = 0
      e.P = null
      if (e.at >= 0) e.at = remap(e.at, toDouble)
      e.leaf = Math.max(0, e.at)
      e.lid = e.at < 0
      e.theta = e.lid ? 0 : Math.PI
      setView({ at: e.at, leaf: e.leaf, lid: e.lid })
    }

    root.addEventListener('pointerdown', onDown)
    root.addEventListener('pointermove', onHover)
    root.addEventListener('pointerleave', onLeave)
    api.current = {
      go,
      relayout,
      draw: () => {
        drawLeaf()
        drawCover()
      },
    }
    return () => {
      stop()
      cancelAnimationFrame(e.raf)
      root.removeEventListener('pointerdown', onDown)
      root.removeEventListener('pointermove', onHover)
      root.removeEventListener('pointerleave', onLeave)
      api.current = null
    }
  }, [])

  const dialog = useRef<HTMLDivElement>(null)
  useDialogFocus(dialog)
  const close = () => {
    setLeaving(true)
    window.setTimeout(() => leave.current(), 220)
  }

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') close()
      else if (ev.key === 'ArrowRight') api.current?.go(1)
      else if (ev.key === 'ArrowLeft') api.current?.go(-1)
    }
    const onResize = () => {
      const next = measure()
      if (next.double !== geo.current.double) api.current?.relayout(next.double)
      setFit(next)
    }
    addEventListener('keydown', onKey)
    addEventListener('resize', onResize)
    document.documentElement.style.overflow = 'hidden' // the page stays put behind the book
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('resize', onResize)
      document.documentElement.style.overflow = ''
    }
  }, []) // close() only sets state and reads a ref, so the first one is as good as any // close() only sets state and reads a ref, so the first one is as good as any

  // After every render the pages may have changed places (one leaf's back is the next spread's left-hand page):
  // clear what the last turn left on them, then draw everything where it is now.
  useLayoutEffect(() => {
    book.current?.querySelectorAll<HTMLElement>('.sb__page').forEach((p) => {
      p.style.transform = ''
      p.style.clipPath = ''
      p.style.visibility = ''
    })
    api.current?.draw()
  })

  const { W, H, double } = fit
  const pages = double ? spreadPages : singlePages
  const last = double ? pages.length / 2 - 1 : pages.length - 1

  // have the pages a turn or two either way ready, so a turn never uncovers a page that's still loading
  useEffect(() => {
    const near = double ? pages.slice(Math.max(0, 2 * view.at - 2), 2 * view.at + 6) : pages.slice(Math.max(0, view.at - 2), view.at + 3)
    near.forEach((p) => {
      if (p.kind === 'art') new Image().src = p.d.src
    })
  })

  const k = view.leaf
  const leaves: [Role, Page | undefined][] = double
    ? [
        ['left', pages[2 * k]],
        ['under', pages[2 * k + 3]],
        ['front', pages[2 * k + 1]],
        ['back', pages[2 * k + 2]],
      ]
    : [
        ['under', pages[k + 1]],
        ['front', pages[k]],
        ['back', pages[k]],
      ]
  const cm = W / PAGE.w // px per cm
  const at = Math.max(0, view.at)
  const said = view.at < 0 ? 'my sketchbook, shut' : double ? `pages ${2 * view.at} and ${2 * view.at + 1} of ${pages.length}` : `page ${view.at + 1} of ${pages.length}`

  return createPortal(
    <div
      ref={dialog}
      tabIndex={-1}
      className={`lightbox sbview${leaving ? ' is-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="my sketchbook"
      onPointerDown={(ev) => (scrimDown.current = ev.target === ev.currentTarget)}
      onClick={(ev) => {
        if (scrimDown.current && ev.target === ev.currentTarget) close()
      }}
    >
      <div className="sbview__inner">
        <div
          ref={book}
          className={`sb${view.lid ? ' is-lid' : ''}${double ? '' : ' is-single'}`}
          style={{ '--pw': `${W}px`, '--ph': `${H}px`, '--ox': `${(COVER.w - PAGE.w) * cm}px`, '--oy': `${((COVER.h - PAGE.h) / 2) * cm}px` } as React.CSSProperties}
        >
          <div className="sb__board sb__board--l" />
          <div className="sb__board sb__board--r" />
          <div className="sb__block sb__block--l" style={{ boxShadow: edges(-1, at) }} />
          <div className="sb__block sb__block--r" style={{ boxShadow: edges(1, last - at) }} />
          {leaves.map(([role, page]) => page && <Leaf key={role === 'back' && !double ? `${page.key}:back` : page.key} page={page} role={role} flipside={role === 'back' && !double} />)}
          <svg className="sb__shade" viewBox={`0 0 ${2 * W} ${H}`} width={2 * W} height={H} aria-hidden>
            <defs>
              <linearGradient id="sb-fold" ref={foldGrad} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#1c1917" stopOpacity="0.34" />
                <stop offset="0.35" stopColor="#1c1917" stopOpacity="0.12" />
                <stop offset="1" stopColor="#1c1917" stopOpacity="0" />
              </linearGradient>
              <filter id="sb-blur" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur ref={blur} stdDeviation="6" />
              </filter>
            </defs>
            <path ref={castPath} fill="#1c1917" filter="url(#sb-blur)" />
            <path ref={foldPath} fill="url(#sb-fold)" />
          </svg>
          <svg className="sb__gloss" viewBox={`0 0 ${2 * W} ${H}`} width={2 * W} height={H} aria-hidden>
            <defs>
              <linearGradient id="sb-gloss" ref={glossGrad} gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="#1c1917" stopOpacity="0.2" />
                <stop offset="0.07" stopColor="#1c1917" stopOpacity="0.06" />
                <stop offset="0.2" stopColor="#ffffff" stopOpacity="0.28" />
                <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="1" stopColor="#1c1917" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <path ref={glossPath} fill="url(#sb-gloss)" />
          </svg>
          {view.lid && <div className="sb__lidshade" />}
          {view.lid && (
            <div ref={lid} className="sb__cover">
              <div className="sb__cover-face sb__cover-face--out">
                <CoverFace live={view.at < 0} />
              </div>
              {/* its inside: the board, with the endpaper pasted down on it, the same as the left-hand page it becomes */}
              <div className="sb__cover-face sb__cover-face--in">
                <div className="sb__page sb__page--l sb__page--lining" data-kind="inside">
                  <div className="sb__ink">
                    <Ink page={spreadPages[0]} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
      {view.at >= 0 && (
        <button type="button" className="lightbox__arrow lightbox__arrow--prev" aria-label="Turn back a page" onClick={() => api.current?.go(-1)}>
          ←
        </button>
      )}
      {view.at < last && (
        <button type="button" className="lightbox__arrow lightbox__arrow--next" aria-label={view.at < 0 ? 'Open the sketchbook' : 'Turn the page'} onClick={() => api.current?.go(1)}>
          →
        </button>
      )}
      <CloseButton onClose={close} />
    </div>,
    document.body,
  )
}
