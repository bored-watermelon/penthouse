import { useEffect, useRef, useState } from 'react'
import { heroImage } from '../lib/heroAssets'
import { askMotion, isTouchDevice, useMotionAccess } from '../lib/motion'
import { watchOnScreen } from '../lib/onScreen'

const GRAVITY = 3300 // px/s²: a heavier ball, quicker to fall and settle
const BOUNCE = 0.46 // how much speed it keeps off the floor — a hefty basketball, not a superball
const WALL_BOUNCE = 0.5
const ROLL_DRAG = 1.1 // per second, speed shed while it is touching the floor
const AIR_DRAG = 0.1
const SQUASH_PER_SPEED = 0.000018 // a firm, inflated ball barely gives, so the dent stays very small
const SQUASH_MAX = 0.05
const REST = 45 // px/s: slower than this on the floor and it stops bouncing
const THROW_CAP = 2600
const SMEAR_AT = 2200 // px/s at which the shadow is smeared and faded as far as it goes

/**
 * The ball resting on the "worked with" bar. It can be picked up and thrown like the footer stickers, and
 * then falls and bounces around the white part of the card. On a phone the tilt of the phone leans gravity
 * so it rolls along the floor towards the low side; shaking the phone does NOT lift it into the air — only
 * a finger drag can toss it up, otherwise it stays grounded like a real ball would.
 */
export default function Basketball() {
  const field = useRef<HTMLDivElement>(null)
  const ball = useRef<HTMLDivElement>(null)
  const shade = useRef<HTMLDivElement>(null)
  const gravity = useRef({ x: 0, y: 1 }) // unit-ish "down", in screen directions
  const motion = useMotionAccess()
  const [touch] = useState(isTouchDevice)

  // Which way is down, from how the phone is tilted. Like the footer's eyes, this is measured against the way
  // it is currently being held (a baseline that drifts along slowly), so holding it still at any angle lets the
  // ball settle, and tilting away from that pose rolls it. The vertical part never flips, so it always falls.
  useEffect(() => {
    if (!touch || !motion.allowed) return
    let base: { x: number; y: number } | null = null
    const on = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return
      const angle = ((screen.orientation?.angle ?? 0) + 360) % 360
      const [tx, ty] = angle === 90 ? [e.beta, -e.gamma] : angle === 270 ? [-e.beta, e.gamma] : angle === 180 ? [-e.gamma, -e.beta] : [e.gamma, e.beta]
      if (!base) base = { x: tx, y: ty }
      base.x += (tx - base.x) * 0.01
      base.y += (ty - base.y) * 0.01
      const lean = (n: number) => Math.max(-1, Math.min(1, n / 28))
      gravity.current = { x: lean(tx - base.x) * 1.15, y: 1 + lean(ty - base.y) * 0.85 }
    }
    window.addEventListener('deviceorientation', on)
    return () => window.removeEventListener('deviceorientation', on)
  }, [touch, motion.allowed])

  useEffect(() => {
    const fieldEl = field.current!
    const el = ball.current!
    const shadeEl = shade.current!
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

    let W = 0
    let H = 0
    let D = 0 // ball diameter
    let x = 0
    let y = 0
    let vx = 0
    let vy = 0
    let spin = 0 // degrees; the ball turns as far as it rolls
    let squash = 0
    let squashAxis: 'x' | 'y' = 'y'
    let moved = false // picked up, thrown or rolled: from then on it stays wherever it's been left
    let restX = 0
    const copy = fieldEl.parentElement?.querySelector<HTMLElement>('.about__copy')

    /**
     * Where it lies until it's touched: on the bar, bottom-right as in the design, but never over the words or the
     * buttons. Where the copy runs down to the bar (a short or narrow card), it lies further left, or smaller (down
     * to half its size), wherever it first fits; if it fits nowhere, at half size where it covers the least.
     */
    const rest = () => {
      const full = parseFloat(getComputedStyle(fieldEl.parentElement!).getPropertyValue('--ball-size')) || el.offsetWidth
      const f = fieldEl.getBoundingClientRect()
      // the lines of words themselves (a paragraph's own box runs the card's width, past where its last line ends),
      // and the pictures and buttons among them
      const boxes: DOMRect[] = []
      if (copy) {
        const range = document.createRange()
        const words = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT)
        for (let n = words.nextNode(); n; n = words.nextNode()) {
          if (!n.textContent?.trim()) continue
          range.selectNodeContents(n)
          boxes.push(...range.getClientRects())
        }
        copy.querySelectorAll('img, button, a.cta').forEach((el) => boxes.push(...el.getClientRects()))
      }
      /** How much of the words it would cover, lying at x at size d. */
      const covers = (d: number, x: number) => {
        const give = d * 0.06 // it's round: its box's corners can lie over a little
        const l = f.left + x + give
        const r = f.left + x + d - give
        const t = f.bottom - d + give
        return boxes.reduce((sum, b) => sum + Math.max(0, Math.min(r, b.right) - Math.max(l, b.left)) * Math.max(0, f.bottom - Math.max(t, b.top)) * (b.bottom > t ? 1 : 0), 0)
      }
      // the right half of the bar, then all of it, shrinking as needed; failing that, half size where it covers least
      for (const reach of [0.45, 0]) for (let d = full; d >= full * 0.5; d -= 4) for (let x = W - d - 8; x >= (W - d) * reach; x -= 8) if (!covers(d, x)) return { d, x }
      const d = Math.round(full * 0.5)
      let best = { d, x: W - d - 8, c: Infinity }
      for (let x = W - d - 8; x >= 0; x -= 8) {
        const c = covers(d, x)
        if (c < best.c) best = { d, x, c }
      }
      return best
    }

    const measure = () => {
      W = fieldEl.clientWidth
      H = fieldEl.clientHeight
      if (!moved && W > 0 && H > 0) {
        const r = rest()
        fieldEl.style.setProperty('--ball-size', `${r.d}px`) // the ball and its shadow
        restX = x = r.x
        y = H - r.d
      }
      D = el.offsetWidth
      x = Math.max(0, Math.min(W - D, x))
      y = Math.max(0, Math.min(H - D, y))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(fieldEl)
    if (copy) ro.observe(copy)
    measure()
    document.fonts?.ready.then(measure)

    function dent(speed: number, axis: 'x' | 'y') {
      squashAxis = axis
      squash = Math.min(SQUASH_MAX, Math.max(squash, speed * SQUASH_PER_SPEED))
    }

    const draw = () => {
      // squash before spin, so the flattening stays lined up with the surface it hit
      const sx = squashAxis === 'y' ? 1 + squash : 1 - squash
      const sy = squashAxis === 'y' ? 1 - squash : 1 + squash
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${sx}, ${sy}) rotate(${spin}deg)`

      // The shadow keeps up with the ball across the floor, and reads its height off it: resting on the floor it
      // is at its biggest and darkest, and the higher the ball goes the smaller and fainter it gets. Speed
      // stretches it along the floor and takes a little more light out of it, so a hard throw smears past.
      const floor = Math.max(1, H - D)
      const lift = Math.max(0, Math.min(1, (floor - y) / floor))
      const speed = Math.min(1, Math.hypot(vx, vy) / SMEAR_AT)
      const wide = (1 - 0.4 * lift) * (1 + 0.22 * speed + squash * 2.2)
      const tall = (1 - 0.52 * lift) * (1 - 0.12 * speed)
      shadeEl.style.transform = `translate3d(${x}px, 0, 0) scale(${wide.toFixed(3)}, ${tall.toFixed(3)})`
      shadeEl.style.opacity = (Math.max(0, 1 - 0.78 * lift) * (1 - 0.3 * speed)).toFixed(3)
    }

    let dragging = false
    let px = 0
    let py = 0
    let pt = 0
    let asked = false

    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      dragging = true
      moved = true
      vx = 0
      vy = 0
      px = e.clientX
      py = e.clientY
      pt = performance.now()
      el.classList.add('is-held')
      // a deliberate touch is the gesture iOS wants before it will report tilt, so use this one
      if (!asked) {
        asked = true
        askMotion()
      }
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      const now = performance.now()
      const dx = e.clientX - px
      const dy = e.clientY - py
      x = Math.max(0, Math.min(W - D, x + dx))
      y = Math.max(0, Math.min(H - D, y + dy))
      const dt = (now - pt) / 1000
      if (dt > 0.002) {
        vx = vx * 0.4 + (dx / dt) * 0.6
        vy = vy * 0.4 + (dy / dt) * 0.6
        pt = now
      }
      spin += ((dx / (D / 2)) * 180) / Math.PI
      px = e.clientX
      py = e.clientY
    }
    const up = () => {
      if (!dragging) return
      dragging = false
      el.classList.remove('is-held')
      if (performance.now() - pt > 90) {
        vx = 0 // held still before letting go, so drop it rather than fling it
        vy = 0
      }
      const m = Math.hypot(vx, vy)
      if (m > THROW_CAP) {
        vx = (vx / m) * THROW_CAP
        vy = (vy / m) * THROW_CAP
      }
    }

    let last = performance.now()
    let raf = 0
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now

      if (!dragging && !reduced && W > 0) {
        const g = gravity.current
        vx += g.x * GRAVITY * dt
        vy += g.y * GRAVITY * dt
        const air = Math.exp(-AIR_DRAG * dt)
        vx *= air
        vy *= air
        x += vx * dt
        y += vy * dt

        if (x < 0) {
          x = 0
          vx = -vx * WALL_BOUNCE
          dent(Math.abs(vx), 'x')
        } else if (x > W - D) {
          x = W - D
          vx = -vx * WALL_BOUNCE
          dent(Math.abs(vx), 'x')
        }
        if (y < 0) {
          y = 0
          vy = -vy * WALL_BOUNCE
          dent(Math.abs(vy), 'y')
        } else if (y > H - D) {
          y = H - D
          if (Math.abs(vy) < REST) {
            vy = 0
          } else {
            dent(Math.abs(vy), 'y')
            vy = -vy * BOUNCE
          }
          vx *= Math.exp(-ROLL_DRAG * dt)
          if (Math.abs(vx) < 6) vx = 0
        }
        spin += ((vx * dt) / (D / 2) / Math.PI) * 180
        if (Math.abs(x - restX) > 2) moved = true // rolled off by a tilt of the phone
      }

      squash *= Math.exp(-9 * dt)
      draw()
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    draw()
    // only while the card can be seen: off screen (or behind another section of the deck) it holds still
    const unwatch = watchOnScreen(fieldEl, (seen) => {
      cancelAnimationFrame(raf)
      raf = 0
      if (!seen) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    })

    return () => {
      cancelAnimationFrame(raf)
      unwatch()
      ro.disconnect()
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [])

  return (
    <div className="ball-field" ref={field} aria-hidden>
      <div className="ball-shadow" ref={shade} />
      <div className="ball" ref={ball}>
        <img src={heroImage.basketball} alt="" draggable={false} />
      </div>
    </div>
  )
}
