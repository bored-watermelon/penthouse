import { useEffect, useRef, useState } from 'react'
import { heroImage } from '../lib/heroAssets'
import { askMotion, isTouchDevice, useMotionAccess } from '../lib/motion'

const GRAVITY = 2600 // px/s²
const BOUNCE = 0.56 // how much speed it keeps off the floor — a basketball, not a superball
const WALL_BOUNCE = 0.62
const ROLL_DRAG = 1.1 // per second, speed shed while it is touching the floor
const AIR_DRAG = 0.1
const SQUASH_PER_SPEED = 0.00004 // an inflated ball barely gives, so the dent stays tiny
const SQUASH_MAX = 0.1
const REST = 45 // px/s: slower than this on the floor and it stops bouncing
const THROW_CAP = 2600

/**
 * The ball resting on the "worked with" bar. It can be picked up and thrown like the footer stickers, and
 * then falls and bounces around the white part of the card. On a phone there is nothing to throw it with, so
 * the tilt of the phone leans gravity and it rolls and bounces around on its own.
 */
export default function Basketball() {
  const field = useRef<HTMLDivElement>(null)
  const ball = useRef<HTMLDivElement>(null)
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
    let placed = false

    const measure = () => {
      W = fieldEl.clientWidth
      H = fieldEl.clientHeight
      D = el.offsetWidth
      if (!placed && W > 0 && H > 0 && D > 0) {
        x = W - D - 8 // resting bottom-right on the bar, as in the design
        y = H - D
        placed = true
      }
      x = Math.max(0, Math.min(W - D, x))
      y = Math.max(0, Math.min(H - D, y))
    }
    const ro = new ResizeObserver(measure)
    ro.observe(fieldEl)
    measure()

    function dent(speed: number, axis: 'x' | 'y') {
      squashAxis = axis
      squash = Math.min(SQUASH_MAX, Math.max(squash, speed * SQUASH_PER_SPEED))
    }

    const draw = () => {
      // squash before spin, so the flattening stays lined up with the surface it hit
      const sx = squashAxis === 'y' ? 1 + squash : 1 - squash
      const sy = squashAxis === 'y' ? 1 - squash : 1 + squash
      el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${sx}, ${sy}) rotate(${spin}deg)`
    }

    let dragging = false
    let px = 0
    let py = 0
    let pt = 0
    let asked = false

    const down = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId)
      dragging = true
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
      }

      squash *= Math.exp(-9 * dt)
      draw()
    }

    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    let raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
    }
  }, [])

  return (
    <div className="ball-field" ref={field} aria-hidden>
      <div className="ball" ref={ball}>
        <img src={heroImage.basketball} alt="" draggable={false} />
      </div>
    </div>
  )
}
