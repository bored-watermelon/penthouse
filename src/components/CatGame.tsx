import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import { footerCat, socials } from '../lib/footerAssets'

const { Engine, Events, Bodies, Body, Composite, Constraint } = Matter
// matter 0.20 takes a third `updateVelocity` argument that its type definitions haven't caught up with
const moveTo = Body.setPosition as (body: Matter.Body, position: Matter.Vector, updateVelocity?: boolean) => void
const turnTo = Body.setAngle as (body: Matter.Body, angle: number, updateVelocity?: boolean) => void

type Phase = 'waiting' | 'in' | 'leaving'
type Status = { kind: 'off' } | { kind: 'intro' } | { kind: 'score'; n: number; up: boolean } | { kind: 'done'; n: number }

/**
 * The cat's solid outline, traced over the picture in fractions of its width (x) and height (y): two raised arms,
 * the head between its ears, and the body. The icons collide with these, so they can land in its arms or on its
 * head, bounce off it, or get shoved along the ground.
 */
const ARMS = [
  { a: [0.09, 0.43], b: [0.46, 0.74], t: 0.085 }, // left, reaching out sideways
  { a: [0.875, 0.1], b: [0.83, 0.72], t: 0.1 }, // right, straight up
]
const BOXES = [
  [0.46, 0.52, 0.68, 0.8], // head
  [0.43, 0.49, 0.47, 0.58], // left ear
  [0.67, 0.42, 0.73, 0.58], // right ear
  [0.4, 0.66, 0.88, 1], // body
]
const STAGGER = 320 // ms between one social dropping and the next
const JUMP_GRAVITY = 3200 // px/s²
// The icons are rigid to the physics but drawn soft: a hit squashes them flat against what they hit and they wobble
// back like jelly (a damped spring), and pinned against the edge by the cat they squeeze down to at most half width.
const JELLY = { stiffness: 420, damping: 12, perSpeed: 0.03, max: 0.32 }
const MIN_SQUEEZE = 0.5
const CAT = 0x0002 // the cat's collision category, so a pinned icon can stop colliding with it
const CAT_RATIO = 856 / 1206 // until the picture has loaded and reports its own size
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * The footer's little game. The social icons drop in one after another; the cat walks with ← → (or A / D, or a drag
 * on touch) and hops with ↑. It's a real body in the physics world, so whatever it catches is only balanced there:
 * walk gently and it stays, stop or turn sharply and it slides off. Every icon stays a working link throughout.
 */
export default function CatGame({ active, revealed }: { active: boolean; revealed: boolean }) {
  const box = useRef<HTMLDivElement>(null)
  const catEl = useRef<HTMLDivElement>(null) // moves; the picture inside squashes and stretches
  const bubble = useRef<HTMLDivElement>(null)
  const els = useRef<(HTMLAnchorElement | null)[]>([])
  const api = useRef<{ start: () => void; stop: () => void; reveal: () => void; again: () => void; measure: () => void } | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'off' })
  const [touch] = useState(() => matchMedia('(hover: none)').matches)
  const total = socials.length

  useEffect(() => {
    const host = box.current!
    const engine = Engine.create({ gravity: { x: 0, y: 1 } })
    const world = engine.world
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const timers: number[] = []
    const phase: Phase[] = socials.map(() => 'waiting')
    const bodies: Matter.Body[] = []
    // whether each icon is resting on the cat, with a few frames' grace either way so a bounce doesn't count
    const held = socials.map(() => false)
    const heldRun = socials.map(() => 0)
    let heldCount = 0
    const jelly = socials.map(() => ({ s: 0, v: 0, nx: 0, ny: 1 })) // squash along n (towards what it hit), + squashed / − stretched
    const squeeze = socials.map(() => 0) // how much narrower it's been pressed against the edge, 0 to MIN_SQUEEZE
    const pinned = socials.map(() => false)
    let walls: Matter.Body[] = []
    let solids: Matter.Body[] = []
    let parts: { body: Matter.Body; x: number; y: number; angle: number }[] = [] // the cat, relative to its feet
    let W = host.clientWidth
    let H = host.clientHeight
    let size = 0
    let catW = 300
    let catH = catW * CAT_RATIO
    let bubbleW = 0
    let bubbleH = 0
    const cat = { x: NaN, y: 0, vx: 0, vy: 0, walk: 0 }
    const keys = { left: false, right: false }
    let engaged = false // once the player has moved, ↑ and space belong to the game instead of scrolling
    let running = false
    let raf = 0
    let last = 0
    let revealedOnce = false
    let live = false // a round is in progress
    let settledFor = 0 // frames that nothing has been in the air, to call the end of a round
    let leaving = false // icons are flying back up for another round
    let catDrag: { dx: number; x: number; sx: number; moved: boolean } | null = null
    let grab: { i: number; c: Matter.Constraint; sx: number; sy: number; moved: boolean } | null = null

    const iconOf = (b: Matter.Body) => (b.label.startsWith('icon:') ? +b.label.slice(5) : -1)
    // how far the cat may go: the screen, narrowed while it has an icon squeezed as far as it goes against an edge
    let stop = { lo: -Infinity, hi: Infinity }
    const clampX = (x: number) => clamp(x, Math.max(-catW * 0.1, stop.lo), Math.min(W - catW * 0.9, stop.hi))
    const replay = (el: Element | null | undefined, cls: string) => {
      if (!el) return
      el.classList.remove(cls)
      void (el as HTMLElement).offsetWidth
      el.classList.add(cls)
    }
    const waddle = () => Math.sin(cat.walk / 26) * Math.min(1, Math.abs(cat.vx) / 300) * 3 // degrees

    const buildWalls = () => {
      walls.forEach((b) => Composite.remove(world, b))
      const t = 200
      walls = [
        Bodies.rectangle(W / 2, H + t / 2, W * 3, t, { isStatic: true, label: 'ground' }),
        Bodies.rectangle(-t / 2, H / 2, t, H * 6, { isStatic: true, label: 'wall' }),
        Bodies.rectangle(W + t / 2, H / 2, t, H * 6, { isStatic: true, label: 'wall' }),
        // well above the screen, so a throw can go up and still come back
        Bodies.rectangle(W / 2, -600 - t / 2, W * 3, t, { isStatic: true, label: 'wall' }),
      ]
      Composite.add(world, walls)
    }

    // Anything low in the footer marked data-solid (the copyright pill, the credit line) is ground too, so the icons
    // pile up around it instead of hiding it. (On phones those sit under the headline, mid-air, so they aren't.)
    const buildSolids = () => {
      solids.forEach((b) => Composite.remove(world, b))
      const hr = host.getBoundingClientRect()
      const low = [...(host.parentElement?.querySelectorAll<HTMLElement>('[data-solid]') ?? [])].map((el) => el.getBoundingClientRect()).filter((r) => r.width > 0 && r.top - hr.top > H * 0.8) // only what's down at the bottom: on a phone the pill sits under the headline, mid-air
      solids = low.map((r) =>
        Bodies.rectangle(r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2, r.width + 8, r.height + 8, {
          isStatic: true,
          label: 'ground',
          chamfer: { radius: Math.min(r.height / 2, 24) },
        }),
      )
      Composite.add(world, solids)
    }

    // Moving the cat's shapes with updateVelocity on is what lets it push things and carry them, rather than
    // teleporting under them.
    const placeCat = (moving: boolean) => {
      const rot = (waddle() * Math.PI) / 180
      const cos = Math.cos(rot)
      const sin = Math.sin(rot)
      const fx = cat.x + catW / 2
      const fy = H - cat.y
      parts.forEach((p) => {
        moveTo(p.body, { x: fx + p.x * cos - p.y * sin, y: fy + p.x * sin + p.y * cos }, moving)
        turnTo(p.body, p.angle + rot, moving)
      })
    }

    // The cat's shapes, as offsets from the middle of its feet, which is what it waddles and jumps around.
    const buildCat = () => {
      parts.forEach((p) => Composite.remove(world, p.body))
      const opts = { isStatic: true, label: 'cat', friction: 1, frictionStatic: 2, restitution: 0, collisionFilter: { category: CAT } }
      const at = (fx: number, fy: number) => ({ x: (fx - 0.5) * catW, y: (fy - 1) * catH })
      parts = [
        ...ARMS.map(({ a, b, t }) => {
          const p = at(a[0], a[1])
          const q = at(b[0], b[1])
          const th = t * catW
          const body = Bodies.rectangle(0, 0, Math.hypot(q.x - p.x, q.y - p.y) + th, th, { ...opts, chamfer: { radius: th / 2 } })
          return { body, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, angle: Math.atan2(q.y - p.y, q.x - p.x) }
        }),
        ...BOXES.map(([x0, y0, x1, y1]) => {
          const p = at(x0, y0)
          const q = at(x1, y1)
          const body = Bodies.rectangle(0, 0, q.x - p.x, q.y - p.y, { ...opts, chamfer: { radius: Math.min(q.x - p.x, q.y - p.y) * 0.3 } })
          return { body, x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, angle: 0 }
        }),
      ]
      placeCat(false)
      Composite.add(world, parts.map((p) => p.body))
    }

    const measure = () => {
      const old = size
      W = host.clientWidth
      H = host.clientHeight
      size = Math.round(clamp(W * 0.037, 44, 64))
      catW = Math.min(clamp(W * 0.223, 150, 400), Math.max(96, H * 0.42)) // and never too tall for a short screen, like a phone on its side
      const img = catEl.current?.querySelector('img')
      catH = catW * (img?.naturalWidth ? img.naturalHeight / img.naturalWidth : CAT_RATIO)
      if (catEl.current) catEl.current.style.width = `${catW}px`
      cat.x = clampX(Number.isNaN(cat.x) ? W * 0.0775 : cat.x) // where Figma has it: 134px in from the left of 1728
      if (old && old !== size) bodies.forEach((b) => Body.scale(b, size / old, size / old))
      buildWalls()
      buildSolids()
      buildCat()
      bodies.forEach((b, i) => {
        if (phase[i] === 'in') Body.setPosition(b, { x: clamp(b.position.x, size / 2, W - size / 2), y: Math.min(H - size / 2, b.position.y) })
      })
      els.current.forEach((el) => el && (el.style.width = el.style.height = `${size}px`))
    }

    const ro = new ResizeObserver(measure)
    ro.observe(host)
    measure()
    const bro = new ResizeObserver(() => {
      bubbleW = bubble.current?.offsetWidth ?? 0
      bubbleH = bubble.current?.offsetHeight ?? 0
    })
    if (bubble.current) bro.observe(bubble.current)

    socials.forEach((s, i) => {
      const opts = { restitution: 0.2, friction: 0.6, frictionStatic: 1.2, frictionAir: 0.01, density: 0.002, label: `icon:${i}` }
      bodies[i] = s.round ? Bodies.circle(0, 0, size / 2, opts) : Bodies.rectangle(0, 0, size, size, { ...opts, chamfer: { radius: size * 0.22 } })
    })

    const show = (i: number, on: boolean) => {
      const el = els.current[i]
      if (el) el.style.visibility = on ? 'visible' : 'hidden'
    }

    // One round: the icons drop in a shuffled order, each a random step from the last so the next one is usually
    // (not always) within reach.
    const drop = () => {
      timers.forEach(clearTimeout)
      timers.length = 0
      live = true
      settledFor = 0
      setStatus({ kind: 'intro' })
      let x = W * (0.3 + Math.random() * 0.4)
      const order = socials.map((_, i) => i).sort(() => Math.random() - 0.5)
      order.forEach((i, k) => {
        phase[i] = 'waiting'
        show(i, false)
        timers.push(
          window.setTimeout(() => {
            x = clamp(x + (Math.random() - 0.5) * W * 0.5, size, W - size)
            const b = bodies[i]
            Body.setPosition(b, { x, y: -size })
            Body.setVelocity(b, { x: 0, y: 0 })
            Body.setAngle(b, (Math.random() - 0.5) * 0.6)
            Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.12)
            Composite.add(world, b)
            phase[i] = 'in'
            show(i, true)
          }, 350 + k * STAGGER),
        )
      })
    }

    // With reduced motion there's no game: the icons are simply lying on the ground.
    const lay = () => {
      socials.forEach((_, i) => {
        const b = bodies[i]
        Body.setPosition(b, { x: W / 2 + (i - (total - 1) / 2) * size * 1.6, y: H - size / 2 - 2 })
        Composite.add(world, b)
        phase[i] = 'in'
        show(i, true)
      })
    }

    // Another round: everything is flung back up out of sight, then dropped again.
    const again = () => {
      if (live || leaving || reduced) return
      leaving = true
      setStatus({ kind: 'intro' })
      const g = engine.gravity.y * engine.gravity.scale * (1000 / 60) ** 2 // px per step², the unit matter's velocities use
      bodies.forEach((b, i) => {
        phase[i] = 'leaving'
        b.collisionFilter.mask = 0
        Body.setVelocity(b, { x: (Math.random() - 0.5) * 5, y: -(Math.sqrt(2 * g * (b.position.y + size * 2)) * 1.4 + 2) })
        Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.3)
      })
    }

    const jump = () => {
      if (cat.y > 0 || cat.vy > 0 || reduced) return
      cat.vy = Math.sqrt(2 * JUMP_GRAVITY * catH * 0.5)
    }

    // Walking speeds up and slows down at a steady rate, so a gentle walk keeps a stack balanced; a drag has no such
    // limit, which is how you fling things off.
    const moveCat = (dt: number) => {
      const s = dt / 1000
      if (catDrag) {
        const x = cat.x + (clampX(catDrag.x - catDrag.dx) - cat.x) * (1 - Math.exp(-dt / 45))
        cat.vx = (x - cat.x) / s
        cat.x = x
      } else {
        const max = Math.max(500, W * 0.45)
        const accel = 1200 // px/s²: about gravity, so a short stack survives a walk but not a sharp turn at full speed
        const target = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * max
        cat.vx += clamp(target - cat.vx, -accel * s, accel * s)
        const x = clampX(cat.x + cat.vx * s)
        if (x !== cat.x + cat.vx * s) cat.vx = 0
        cat.x = x
      }
      cat.walk += Math.abs(cat.vx) * s
      if (cat.y > 0 || cat.vy > 0) {
        cat.vy -= JUMP_GRAVITY * s
        cat.y += cat.vy * s
        if (cat.y <= 0) {
          cat.y = 0
          cat.vy = 0
          replay(catEl.current, 'is-landing')
        }
      }
      placeCat(true)
    }

    // Who's touching what, from the physics engine's contact list: an icon is held if it rests on the cat, or on an
    // icon that does, without also touching the ground.
    const referee = () => {
      const onCat = socials.map(() => false)
      const onGround = socials.map(() => false)
      const next: number[][] = socials.map(() => [])
      for (const pair of engine.pairs.list) {
        if (!pair.isActive) continue
        const a = pair.bodyA.parent
        const b = pair.bodyB.parent
        for (const [p, q] of [[a, b], [b, a]]) {
          const i = iconOf(p)
          if (i < 0) continue
          if (q.label === 'cat') onCat[i] = true
          else if (q.label === 'ground') onGround[i] = true
          else if (iconOf(q) >= 0) next[i].push(iconOf(q))
        }
      }
      const free = (i: number) => phase[i] === 'in' && grab?.i !== i
      const rawHeld = socials.map(() => false)
      const queue = socials.map((_, i) => i).filter((i) => onCat[i] && !onGround[i] && free(i))
      queue.forEach((i) => (rawHeld[i] = true))
      while (queue.length) {
        for (const j of next[queue.shift()!]) {
          if (!rawHeld[j] && !onGround[j] && free(j)) {
            rawHeld[j] = true
            queue.push(j)
          }
        }
      }
      rawHeld.forEach((r, i) => {
        heldRun[i] = r === held[i] ? 0 : heldRun[i] + 1
        if (heldRun[i] > (r ? 8 : 12)) {
          held[i] = r
          heldRun[i] = 0
        }
      })
      const n = held.filter(Boolean).length
      if (n !== heldCount) {
        const up = n > heldCount
        heldCount = n
        if (up) replay(catEl.current, 'is-happy')
        setStatus(live ? { kind: 'score', n, up } : { kind: 'done', n })
      }

      // the round is over once all of them are in and nothing's been in the air for a moment
      if (live && phase.every((p) => p === 'in')) {
        const resting = bodies.every((b, i) => held[i] || (b.speed < 0.4 && (onGround[i] || next[i].length > 0)))
        settledFor = resting ? settledFor + 1 : 0
        if (settledFor > 40) {
          live = false
          setStatus({ kind: 'done', n: heldCount })
        }
      }

      // flung up for another round: once out of sight, park them until the next drop
      bodies.forEach((b, i) => {
        if (phase[i] !== 'leaving' || (b.position.y > -size * 1.5 && b.velocity.y <= 0)) return
        Composite.remove(world, b)
        b.collisionFilter.mask = 0xffffffff
        phase[i] = 'waiting'
        held[i] = false
        show(i, false)
        if (leaving && phase.every((p) => p === 'waiting')) {
          leaving = false
          heldCount = 0
          drop()
        }
      })
    }

    // Squash on impact, towards whatever was hit, harder the faster they met.
    Events.on(engine, 'collisionStart', (ev) => {
      for (const pair of ev.pairs) {
        const a = pair.bodyA.parent
        const b = pair.bodyB.parent
        const at = pair.collision.supports[0]
        if (!at) continue
        for (const [p, q] of [[a, b], [b, a]]) {
          const i = iconOf(p)
          if (i < 0) continue
          let { x: nx, y: ny } = pair.collision.normal
          if (nx * (at.x - p.position.x) + ny * (at.y - p.position.y) < 0) {
            nx = -nx
            ny = -ny
          }
          const speed = (p.velocity.x - q.velocity.x) * nx + (p.velocity.y - q.velocity.y) * ny
          const s = Math.min(JELLY.max, speed * JELLY.perSpeed)
          if (speed > 1.2 && s > Math.abs(jelly[i].s) && !pinned[i]) jelly[i] = { s, v: 0, nx, ny } // a pinned one is held still
        }
      }
    })

    // How far the cat reaches towards one side of the screen within a horizontal band: its outline, clipped to the band.
    const reach = (y0: number, y1: number, side: number) => {
      let best = side > 0 ? -Infinity : Infinity
      for (const { body } of parts) {
        const vs = body.vertices
        vs.forEach((a, k) => {
          const b = vs[(k + 1) % vs.length]
          const dy = b.y - a.y
          let t0 = 0
          let t1 = 1
          if (Math.abs(dy) < 1e-6) {
            if (a.y < y0 || a.y > y1) return
          } else {
            const ta = (y0 - a.y) / dy
            const tb = (y1 - a.y) / dy
            t0 = Math.max(0, Math.min(ta, tb))
            t1 = Math.min(1, Math.max(ta, tb))
            if (t0 > t1) return
          }
          for (const t of [t0, t1]) {
            const x = a.x + (b.x - a.x) * t
            best = side > 0 ? Math.max(best, x) : Math.min(best, x)
          }
        })
      }
      return best
    }

    // An icon caught between the cat and the edge of the screen gets squeezed into the gap instead of being shoved
    // through either, and the cat can only press it down to half its width.
    const pinch = (dt: number) => {
      const next = { lo: -Infinity, hi: Infinity }
      bodies.forEach((b, i) => {
        let target = 0
        let pin = false
        if (phase[i] === 'in' && grab?.i !== i) {
          const side = b.position.x > W / 2 ? 1 : -1
          if ((side > 0 ? W - b.position.x : b.position.x) < size * 0.75) {
            const edge = reach(b.position.y - size * 0.4, b.position.y + size * 0.4, side)
            const gap = side > 0 ? W - edge : edge
            if (Number.isFinite(edge) && gap < size) {
              const min = size * (1 - MIN_SQUEEZE)
              if (gap < min) {
                cat.x -= side * (min - gap)
                cat.vx = 0
                placeCat(false)
              }
              // squeezed all the way: the cat stops right here rather than pushing in and being pushed back each frame
              if (gap < min + 1) {
                if (side > 0) next.hi = Math.min(next.hi, cat.x)
                else next.lo = Math.max(next.lo, cat.x)
              }
              pin = true
              const g = Math.max(gap, min)
              target = 1 - g / size
              Body.setPosition(b, { x: side > 0 ? W - g / 2 : g / 2, y: b.position.y })
              Body.setVelocity(b, { x: 0, y: b.velocity.y })
              // pressed flat against the edge, it straightens up
              const flat = Math.round(b.angle / (Math.PI / 2)) * (Math.PI / 2)
              Body.setAngle(b, b.angle + (flat - b.angle) * 0.3)
              Body.setAngularVelocity(b, 0)
            }
          }
        }
        // while pinned it doesn't collide with the cat at all (it's already been put exactly in the gap), so the
        // physics can't keep shoving it back out and making it shake
        if (pin !== pinned[i]) {
          pinned[i] = pin
          if (phase[i] === 'in') b.collisionFilter.mask = pin ? ~CAT : 0xffffffff
          if (pin) jelly[i].s = jelly[i].v = 0
        }
        squeeze[i] += (target - squeeze[i]) * (1 - Math.exp(-dt / 50))
        const j = jelly[i]
        j.v += (-JELLY.stiffness * j.s - JELLY.damping * j.v) * (dt / 1000)
        j.s += j.v * (dt / 1000)
      })
      stop = next
    }

    const paint = () => {
      const c = catEl.current
      if (c) c.style.transform = `translate(${cat.x}px, ${-cat.y}px) rotate(${waddle()}deg)`
      bodies.forEach((b, i) => {
        if (phase[i] === 'waiting') return
        const el = els.current[i]
        if (!el) return
        // squash along the hit, keeping the side that touched in place; then the edge squeeze, keeping its feet down
        const { s, nx, ny } = jelly[i]
        const q = squeeze[i]
        const n = Math.atan2(ny, nx)
        const x = b.position.x - size / 2 + (nx * s * size) / 2
        const y = b.position.y - size / 2 + (ny * s * size) / 2 - (q * 0.5 * size) / 2
        el.style.transform =
          `translate(${x}px, ${y}px) rotate(${n}rad) scale(${1 - s}, ${1 + s * 0.6}) rotate(${-n}rad) ` +
          `scale(${1 - q}, ${1 + q * 0.5}) rotate(${b.angle}rad)`
      })
      // the speech bubble sits beside the cat, on whichever side has room
      const bb = bubble.current
      if (bb) {
        const room = { right: W - (cat.x + catW * 0.93) - 24, left: cat.x + catW * 0.03 - 24 }
        const side = bubbleW <= room.right || room.right >= room.left ? 'right' : 'left'
        const maxW = `${Math.max(140, Math.floor(room[side]))}px`
        if (bb.style.maxWidth !== maxW) bb.style.maxWidth = maxW
        const x = side === 'right' ? cat.x + catW * 0.93 + 12 : cat.x + catW * 0.03 - 12 - bubbleW
        const y = H - cat.y - catH * 0.52 - bubbleH / 2
        bb.style.transform = `translate(${clamp(x, 12, W - bubbleW - 12)}px, ${y}px)`
        if (bb.dataset.side !== side) bb.dataset.side = side
      }
    }

    const tick = (now: number) => {
      if (!running) return
      const dt = Math.min(now - last, 32)
      last = now
      moveCat(dt)
      Engine.update(engine, dt)
      pinch(dt)
      referee()
      paint()
      raf = requestAnimationFrame(tick)
    }

    // ----- keyboard -----
    const onKey = (e: KeyboardEvent) => {
      if (!running || reduced || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target as HTMLElement | null
      if (t?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const down = e.type === 'keydown'
      const k = e.key.toLowerCase()
      if (k === 'arrowleft' || k === 'a') {
        keys.left = down
        engaged = true
        e.preventDefault()
      } else if (k === 'arrowright' || k === 'd') {
        keys.right = down
        engaged = true
        e.preventDefault()
      } else if (k === 'arrowup' || k === 'w' || (k === ' ' && !t?.closest?.('a, button'))) {
        if (!engaged) return
        if (down) jump()
        e.preventDefault()
      } else if (k === 'r' && down) {
        again()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)

    // ----- the cat, by pointer: drag it along the ground, tap it to hop -----
    const localX = (e: PointerEvent) => e.clientX - host.getBoundingClientRect().left
    const catDown = (e: PointerEvent) => {
      if (reduced) return
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      const x = localX(e)
      catDrag = { dx: x - cat.x, x, sx: x, moved: false }
      engaged = true
    }
    const catMove = (e: PointerEvent) => {
      if (!catDrag) return
      catDrag.x = localX(e)
      if (Math.abs(catDrag.x - catDrag.sx) > 6) catDrag.moved = true
    }
    const catUp = () => {
      if (catDrag && !catDrag.moved) jump()
      catDrag = null
    }
    const ce = catEl.current
    ce?.addEventListener('pointerdown', catDown)
    ce?.addEventListener('pointermove', catMove)
    ce?.addEventListener('pointerup', catUp)
    ce?.addEventListener('pointercancel', catUp)

    // ----- icons: grab & throw (at the cat, too) -----
    const local = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const onDown = (e: PointerEvent) => {
      const i = els.current.findIndex((el) => el === e.currentTarget)
      if (i < 0 || phase[i] !== 'in') return
      const body = bodies[i]
      e.preventDefault()
      const p = local(e)
      const c = Constraint.create({
        pointA: p,
        bodyB: body,
        pointB: { x: p.x - body.position.x, y: p.y - body.position.y },
        stiffness: 0.25,
        damping: 0.12,
        length: 0,
      })
      Composite.add(world, c)
      grab = { i, c, sx: p.x, sy: p.y, moved: false }
      // follow the pointer on the window, so a fast throw that outruns the icon still lets go of it
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
    }
    const onMove = (e: PointerEvent) => {
      if (!grab) return
      const p = local(e)
      grab.c.pointA = p
      if (Math.hypot(p.x - grab.sx, p.y - grab.sy) > 6) grab.moved = true
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (!grab) return
      Composite.remove(world, grab.c)
      const el = els.current[grab.i]
      if (el) el.dataset.dragged = grab.moved ? '1' : ''
      grab = null
    }
    els.current.forEach((el) => el?.addEventListener('pointerdown', onDown))

    api.current = {
      measure,
      again,
      reveal: () => {
        if (revealedOnce) return
        revealedOnce = true
        measure()
        if (reduced) lay()
        else drop()
      },
      start: () => {
        if (running) return
        running = true
        measure()
        last = performance.now()
        raf = requestAnimationFrame(tick)
      },
      stop: () => {
        running = false
        cancelAnimationFrame(raf)
        keys.left = keys.right = false
        engaged = false
        catDrag = null
      },
    }

    return () => {
      api.current?.stop()
      timers.forEach(clearTimeout)
      ro.disconnect()
      bro.disconnect()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      ce?.removeEventListener('pointerdown', catDown)
      ce?.removeEventListener('pointermove', catMove)
      ce?.removeEventListener('pointerup', catUp)
      ce?.removeEventListener('pointercancel', catUp)
      onUp()
      els.current.forEach((el) => el?.removeEventListener('pointerdown', onDown))
      Events.off(engine, 'collisionStart')
      Composite.clear(world, false)
      Engine.clear(engine)
    }
  }, [total])

  useEffect(() => {
    if (active) api.current?.start()
    else api.current?.stop()
  }, [active])

  useEffect(() => {
    if (active && revealed) api.current?.reveal()
  }, [active, revealed])

  const again = <button type="button" className="game__again" onClick={() => api.current?.again()}>again{!touch && <kbd>R</kbd>}</button>

  return (
    <div className="game" ref={box}>
      {footerCat && (
        <div ref={catEl} className="game__cat" title={touch ? 'drag me' : 'move me with ← →'}>
          <img src={footerCat} alt="" draggable={false} onLoad={() => api.current?.measure()} />
        </div>
      )}

      {socials.map((s, i) => (
        <a
          key={s.name}
          ref={(el) => {
            els.current[i] = el
          }}
          className={`social__icon${s.round ? ' is-round' : ''}`}
          href={s.href}
          target="_blank"
          rel="noreferrer noopener"
          aria-label={s.label}
          draggable={false}
          // a drag that ends on the icon shouldn't also open the link
          onClick={(e) => {
            const el = e.currentTarget
            if (el.dataset.dragged) {
              e.preventDefault()
              el.dataset.dragged = ''
            }
          }}
          style={{ visibility: 'hidden' }}
        >
          <img src={s.src} alt="" draggable={false} />
        </a>
      ))}

      <div className={`game__bubble${status.kind === 'off' ? '' : ' is-on'}`} ref={bubble} data-side="right" role="status" aria-live="polite">
        {status.kind === 'intro' &&
          (touch ? (
            <>drag me to catch these!</>
          ) : (
            <>
              <kbd>←</kbd>
              <kbd>→</kbd> help me catch these!
            </>
          ))}
        {status.kind === 'score' && (
          <>
            {status.up ? 'gotcha!' : 'oops!'} <b>{status.n}/{total}</b>
          </>
        )}
        {status.kind === 'done' &&
          (status.n === total ? (
            <>all {total}, purrfect. tap one to say hi</>
          ) : status.n === 0 ? (
            <>they all got away! {again}</>
          ) : (
            <>
              <b>{status.n}/{total}</b> so close. {again}
            </>
          ))}
      </div>
    </div>
  )
}
