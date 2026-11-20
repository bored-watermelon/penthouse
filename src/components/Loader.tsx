import { useEffect, useRef, useState } from 'react'
import { heroImage } from '../lib/heroAssets'
import { finishIntro } from '../lib/intro'

const MIN_MS = 2300 // the least the count takes, so the throw has time to play out even on a fast connection
const GIVE_UP_MS = 9000 // a slow photo never keeps anyone out longer than this
const SETTLE_MS = 1600 // past the count, the most we wait for the ball to come to rest
const GRAVITY = 3300 // px/s², the hero ball's weight
const BOUNCE = 0.56 // speed kept off the floor: a hefty basketball, not a superball
const WALL_BOUNCE = 0.55
const ROLL_DRAG = 2.2 // per second, speed shed while it rolls along the floor
const REST = 60 // px/s: slower than this on the floor and it stops bouncing
const NEAR = 1.4 // how much bigger it starts, still close to the thrower, before it's flown into the screen
const MORPH_MS = 950

/** Resolves once an image has downloaded and decoded (or failed: it isn't worth waiting on). */
function ready(src?: string) {
  if (!src) return Promise.resolve()
  const img = new Image()
  img.src = src
  return img.decode().catch(() => undefined)
}

/** The hero card's own ball (Basketball.tsx), lying where it rests: where the thrown one is carried to. */
function cardBall() {
  const b = document.querySelector<HTMLElement>('.about .ball')
  const field = b?.parentElement
  if (!b || !field || !b.offsetWidth) return null
  const m = new DOMMatrixReadOnly(getComputedStyle(b).transform) // translate, then the squash and the spin
  const f = field.getBoundingClientRect()
  return { size: b.offsetWidth, x: f.left + m.m41, y: f.top + m.m42, floor: f.bottom, spin: (Math.atan2(m.m12, m.m11) * 180) / Math.PI }
}

/**
 * The landing screen. It counts to 100 as the hero's photo, the selfie and the fonts come in (the count is paced
 * so it never finishes sooner than MIN_MS, and it creeps through the 90s if the photo is slow), while the
 * basketball is thrown in from the left: it lands on the bottom of the screen, bounces off the right edge, and
 * rolls to a stop. Then the white shrinks onto the hero's own white card, uncovering the photo around it, and
 * takes the ball with it, caught inside: it's carried down to where the card's ball lies, the same size and
 * turned the same way, so when the white hands over to the page (finishIntro starts the chat) it's that ball.
 */
export default function Loader({ bg }: { bg?: string }) {
  const [gone, setGone] = useState(false)
  const screen = useRef<HTMLDivElement>(null)
  const count = useRef<HTMLSpanElement>(null)
  const ball = useRef<HTMLImageElement>(null)
  const shade = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = screen.current!
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let loaded = false
    let raf = 0
    let cancelled = false
    const t0 = performance.now()

    Promise.all([ready(bg), ready(heroImage.me), document.fonts.ready]).then(() => (loaded = true))
    const giveUp = window.setTimeout(() => (loaded = true), GIVE_UP_MS)

    // The throw: from off the left edge, up and fast, so the first bounce lands on the bottom of the screen about
    // two-thirds of the way across and it carries on into the right edge. The bottom and the two sides are the walls
    // (the left one only once it's in), as if the screen were a box it had been thrown into. It's the card's ball,
    // so it's that one's size, with its shadow sized like that one's too (.ball-shadow).
    const home = cardBall()
    if (home) {
      const s = home.size
      Object.assign(ball.current!.style, { width: `${s}px` })
      Object.assign(shade.current!.style, { width: `${s * 1.16}px`, height: `${s * 0.17}px`, margin: `${s * -0.085}px 0 0 ${s * -0.08}px` })
    }
    const D = ball.current!.offsetWidth
    let x = -D
    let y = innerHeight * 0.32
    let vx = innerWidth / 1.05
    let vy = -innerHeight * 0.7
    let spin = 0
    let squash = 0
    let squashAxis: 'x' | 'y' = 'y'
    let inside = false
    let settled = reduced
    let flight = 0 // seconds since the throw, for the ball's shrink into the screen

    const dent = (speed: number, axis: 'x' | 'y') => {
      squashAxis = axis
      squash = Math.max(squash, Math.min(0.14, speed / 11000))
    }

    let shown = 0
    let last = t0
    const frame = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      const elapsed = now - t0

      // the count: eased over MIN_MS, held under 90 until everything's in, then crawling, never stalling dead
      const paced = 1 - Math.pow(1 - Math.min(1, elapsed / MIN_MS), 2.2)
      const cap = loaded ? 1 : elapsed < MIN_MS ? 0.9 : 0.9 + 0.09 * (1 - Math.exp(-(elapsed - MIN_MS) / 3000))
      shown = Math.max(shown, Math.min(paced, cap))
      count.current!.textContent = String(Math.floor(shown * 100))

      if (!settled) {
        const W = innerWidth - D
        const floor = innerHeight - D // the ball's bottom on the bottom edge of the screen
        flight += dt
        vy += GRAVITY * dt
        x += vx * dt
        y += vy * dt
        if (x >= 0) inside = true
        if (x > W) {
          x = W
          dent(Math.abs(vx), 'x')
          vx = -Math.abs(vx) * WALL_BOUNCE
        } else if (inside && x < 0) {
          x = 0
          dent(Math.abs(vx), 'x')
          vx = Math.abs(vx) * WALL_BOUNCE
        }
        if (y >= floor) {
          y = floor
          if (Math.abs(vy) < REST) vy = 0
          else {
            dent(Math.abs(vy), 'y')
            vy = -Math.abs(vy) * BOUNCE
          }
          vx *= Math.exp(-ROLL_DRAG * dt)
          if (vy === 0 && Math.abs(vx) < 25) settled = true
        }
        spin += ((vx * dt) / (D / 2) / Math.PI) * 180
        squash *= Math.exp(-12 * dt)
        // flying away from the thrower: it starts a little big and settles to its size before the first bounce
        const near = 1 + (NEAR - 1) * Math.exp(-flight / 0.18)
        const sx = (squashAxis === 'y' ? 1 + squash : 1 - squash) * near
        const sy = (squashAxis === 'y' ? 1 - squash : 1 + squash) * near
        // moved down by as much as the squash takes off its height, so it flattens onto the floor rather than off it
        const sink = squashAxis === 'y' ? (D / 2) * squash : 0
        ball.current!.style.transform = `translate3d(${x}px, ${y + sink}px, 0) scale(${sx}, ${sy}) rotate(${spin}deg)`
        // its shadow on the floor, under the ball: biggest and darkest as it touches down
        const lift = Math.max(0, Math.min(1, (floor - y) / (innerHeight * 0.6)))
        shade.current!.style.transform = `translate3d(${x}px, ${innerHeight}px, 0) scale(${1 - 0.55 * lift})`
        shade.current!.style.opacity = String(0.95 - 0.8 * lift)
      }

      if (shown >= 1 && (settled || elapsed > MIN_MS + SETTLE_MS)) {
        window.setTimeout(reveal, 180)
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // The white shrinks onto the hero card's white. Measured now, so it lands wherever the card is at this size.
    async function reveal() {
      if (cancelled) return
      const card = document.querySelector('.about')?.getBoundingClientRect()
      const onScreen = card && card.bottom > 0 && card.top < innerHeight
      const morphs = card && onScreen && !reduced
      const to = morphs ? cardBall() : null
      // the count steps out first; the ball stays if there's a card to carry it to
      if (to) el.classList.add('is-carrying')
      el.classList.add('is-leaving')
      if (morphs) {
        const r = parseFloat(getComputedStyle(document.querySelector('.about')!).borderTopLeftRadius) || 20
        const box = `inset(${Math.max(0, card.top)}px ${Math.max(0, innerWidth - card.right)}px ${Math.max(0, innerHeight - card.bottom)}px ${Math.max(0, card.left)}px round ${r}px)`
        const morph = { duration: MORPH_MS, delay: 160, easing: 'cubic-bezier(0.65, 0, 0.2, 1)', fill: 'forwards' } as const
        const shrink = el.animate([{ clipPath: 'inset(0px 0px 0px 0px round 0px)' }, { clipPath: box }], morph)
        if (to) {
          // On the same curve as the white, so it stays inside it all the way down. It rolls as far as it's carried,
          // and lands turned exactly as the card's ball lies.
          const rolled = spin + ((to.x - x) / (D / 2)) * (180 / Math.PI)
          const turned = to.spin + 360 * Math.round((rolled - to.spin) / 360)
          ball.current!.animate([{ transform: ball.current!.style.transform }, { transform: `translate3d(${to.x}px, ${to.y}px, 0) scale(1, 1) rotate(${turned}deg)` }], morph)
          shade.current!.animate([{ transform: shade.current!.style.transform }, { transform: `translate3d(${to.x}px, ${to.floor}px, 0) scale(1)` }], morph)
        }
        await shrink.finished.catch(() => undefined)
      }
      if (cancelled) return
      finishIntro()
      // now it sits exactly over the card's own white: fading it lets the words underneath come up
      await el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'forwards' }).finished.catch(() => undefined)
      if (!cancelled) setGone(true)
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      clearTimeout(giveUp)
    }
  }, [bg])

  if (gone) return null
  return (
    <div className="loader" ref={screen} role="progressbar" aria-label="Loading" aria-valuemin={0} aria-valuemax={100}>
      <span className="loader__count">
        <span ref={count}>0</span>
        <span className="loader__pct">%</span>
      </span>
      <div className="loader__shade" ref={shade} />
      <img className="loader__ball" ref={ball} src={heroImage.basketball} alt="" draggable={false} />
    </div>
  )
}
