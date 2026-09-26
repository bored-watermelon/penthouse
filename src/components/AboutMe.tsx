import { useEffect, useMemo, useRef, useState } from 'react'
import Matter from 'matter-js'
import { artifacts, BOX_CM, camera, cardboard, reality } from '../lib/about'
import { collage } from '../lib/collage'
import type { PlayItem } from '../content'
import Lightbox from './Lightbox'
import CameraViewer from './CameraViewer'
import Collage from './Collage'

const { Engine, Events, Bodies, Body, Bounds, Composite, Constraint } = Matter

/** The inside floor of cardboard.png, as fractions of the picture; the rest is the box's walls. */
const FLOOR = { l: 0.1, t: 0.13, r: 0.9, b: 0.905 }
/**
 * How hard the cardboard floor grips the things on it, as a deceleration in box-widths per second². Move the box more
 * gently than this and they ride along; yank it, stop it short or shake it and they slide, until the floor slows them.
 */
const GRIP = 1.1
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** Each thing's size in real centimetres (see BOX_CM in lib/about.ts). */
const DIMS = artifacts.map((a) => (a.width >= a.height ? { w: a.cm, h: (a.cm * a.height) / a.width } : { w: (a.cm * a.width) / a.height, h: a.cm }))

/** The picture in the heading: small and in line with the words, and it grows to a proper look on hover or focus. */
function Reality() {
  const ref = useRef<HTMLSpanElement>(null)
  const [shift, setShift] = useState({ x: 0, y: 0 })
  const grow = 7

  // keep the enlarged picture on screen, whichever end of the line the small one landed on
  const aim = () => {
    const r = ref.current!.getBoundingClientRect()
    const w = (r.width * grow) / 2
    const h = (r.height * grow) / 2
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const pad = 16
    setShift({
      x: clamp(cx, pad + w, innerWidth - pad - w) - cx,
      y: clamp(cy, pad + h, innerHeight - pad - h) - cy,
    })
  }

  if (!reality) return null
  return (
    <span
      ref={ref}
      className="reality"
      tabIndex={0}
      role="img"
      aria-label="a cartoon of me, a tiny kid in a suit, standing among grown-up executives"
      onPointerEnter={aim}
      onFocus={aim}
      style={{ '--dx': `${shift.x}px`, '--dy': `${shift.y}px`, '--grow': grow } as React.CSSProperties}
    >
      <img src={reality} alt="" draggable={false} />
    </span>
  )
}

/**
 * The "about me" box: a cardboard box of keepsakes on a blanket. Drag the box and everything inside slides and
 * knocks about; drag the things themselves to rearrange them, or click one to see it up close.
 */
export default function AboutMe() {
  const stage = useRef<HTMLDivElement>(null)
  const boxEl = useRef<HTMLDivElement>(null)
  const els = useRef<(HTMLButtonElement | null)[]>([])
  const [open, setOpen] = useState<number | null>(null)
  const [special, setSpecial] = useState<string | null>(null) // a thing that opens into its own viewer, like the camera
  const viewer: PlayItem[] = useMemo(() => artifacts.map((a) => ({ id: a.id, src: a.src, video: false, tags: [], caption: '' })), [])

  useEffect(() => {
    const host = stage.current!
    const box = boxEl.current!
    const engine = Engine.create({ gravity: { x: 0, y: 0 } }) // seen from above: nothing falls, things only slide
    const world = engine.world
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 0 // the box, in px
    let H = 0
    let size = 0 // px per real centimetre
    let walls: Matter.Body[] = []
    const bodies: Matter.Body[] = []
    const dims = DIMS // times `size`, that's each thing's size on screen
    // the pile, bottom to top: whatever's later in this list lies on top of what's earlier
    const order = artifacts.map((_, i) => i)
    let restack = true
    const toTop = (i: number) => {
      order.splice(order.indexOf(i), 1)
      order.push(i)
      restack = true
    }
    // no two things are quite the same weight or grip the cardboard the same, so a shake scatters them instead of
    // sliding them about in a clump
    const grips = artifacts.map(() => 0.35 + Math.random() * 1.3)
    const heft = artifacts.map(() => 0.6 + Math.random() * 0.8)
    // the box's offset from its resting place, and its motion, to shake the contents with
    const pos = { x: 0, y: 0 }
    const vel = { x: 0, y: 0 } // for the glide after letting go
    const prev = { x: 0, y: 0 } // where the box was last frame (the pointer moves it in between)
    const boxV = { x: 0, y: 0 } // the box's velocity, lightly smoothed (the pointer and the screen don't tick in step)
    let limit = { l: 0, r: 0, u: 0, d: 0 } // how far the box can go from where it sits: left, right, up, down
    let boxDrag: { px: number; py: number; ox: number; oy: number; id: number } | null = null
    let grab: { i: number; c: Matter.Constraint; sx: number; sy: number; moved: boolean } | null = null
    let raf = 0
    let last = 0
    let visible = false

    const measure = () => {
      const old = W
      W = box.clientWidth
      H = box.clientHeight
      size = W / BOX_CM
      // Left, it can go as far as my fingertips (when I'm beside it; on phones I'm above it, so the screen's edge);
      // right, to the edge of the screen; up, until its note nearly touches the heading; down, within its space.
      const at = box.getBoundingClientRect()
      const home = { l: at.left - pos.x, r: at.right - pos.x }
      const hands = [...document.querySelectorAll('.collage__hand')].map((h) => h.getBoundingClientRect())
      const tip = Math.max(0, ...hands.filter((h) => h.bottom > at.top && h.top < at.bottom && h.right <= home.l + 60).map((h) => h.right))
      const edge = document.documentElement.clientWidth - 8
      const note = box.querySelector('.toybox__note')?.getBoundingClientRect()
      const heading = host.closest('section')?.querySelector('.me__intro')?.getBoundingClientRect()
      const up = note && heading ? note.top - pos.y - (heading.bottom + 6) : 0
      const down = Math.max(0, (host.clientHeight - H) / 2)
      limit = { l: Math.max(0, home.l - Math.max(tip, 8)), r: Math.max(0, edge - home.r), u: Math.max(down, up), d: down }
      walls.forEach((b) => Composite.remove(world, b))
      const t = 400
      const [l, top, r, b] = [FLOOR.l * W, FLOOR.t * H, FLOOR.r * W, FLOOR.b * H]
      walls = [
        Bodies.rectangle(l - t / 2, H / 2, t, H * 3, { isStatic: true, restitution: 0.8, label: 'wall' }),
        Bodies.rectangle(r + t / 2, H / 2, t, H * 3, { isStatic: true, restitution: 0.8, label: 'wall' }),
        Bodies.rectangle(W / 2, top - t / 2, W * 3, t, { isStatic: true, restitution: 0.8, label: 'wall' }),
        Bodies.rectangle(W / 2, b + t / 2, W * 3, t, { isStatic: true, restitution: 0.8, label: 'wall' }),
      ]
      Composite.add(world, walls)
      if (old && old !== W) {
        bodies.forEach((b) => {
          Body.scale(b, W / old, W / old)
          Body.setPosition(b, { x: (b.position.x * W) / old, y: (b.position.y * W) / old })
        })
      }
    }
    measure()

    // start them spread over the floor in a loose grid, each at a slight angle
    const cols = Math.max(1, Math.ceil(Math.sqrt(artifacts.length * 1.6)))
    const rows = Math.max(1, Math.ceil(artifacts.length / cols))
    artifacts.forEach((_, i) => {
      const c = i % cols
      const r = Math.floor(i / cols)
      const x = (FLOOR.l + ((FLOOR.r - FLOOR.l) * (c + 0.5)) / cols) * W + (Math.random() - 0.5) * size * 3
      const y = (FLOOR.t + ((FLOOR.b - FLOOR.t) * (r + 0.5)) / rows) * H + (Math.random() - 0.5) * size * 2
      bodies.push(
        Bodies.rectangle(x, y, dims[i].w * size * 0.92, dims[i].h * size * 0.92, {
          angle: (Math.random() - 0.5) * 0.5,
          collisionFilter: { group: -1 }, // they don't push each other apart: they lie on top of each other, like a pile
          frictionAir: 0.015, // just a touch of drag; the floor's grip is applied in tick()
          restitution: 0.35,
          friction: 0.3,
          density: 0.002,
          chamfer: { radius: size * 0.4 },
        }),
      )
    })
    Composite.add(world, bodies)

    const paint = () => {
      box.style.transform = `translate(${pos.x}px, ${pos.y}px)`
      if (restack) {
        order.forEach((i, rank) => {
          const el = els.current[i]
          if (el) el.style.zIndex = String(rank + 1)
        })
        restack = false
      }
      bodies.forEach((b, i) => {
        const el = els.current[i]
        if (!el) return
        // something skidding fast is half off the ground: it lifts a little
        const lift = grab?.i === i ? 1 : 1 + Math.min(0.06, ((b.speed * 60) / W) * 0.05)
        el.style.transform = `translate(${b.position.x - (dims[i].w * size) / 2}px, ${b.position.y - (dims[i].h * size) / 2}px) rotate(${b.angle}rad) scale(${lift})`
      })
    }

    // Hitting a wall is where a shake really scrambles things: whatever hits it hard bounces off at an odd angle,
    // spinning, and lands somewhere new in the pile (usually on top, sometimes buried), so they scatter instead of
    // all piling up against the same side.
    const hits = new Set<number>()
    Events.on(engine, 'collisionStart', (ev) => {
      for (const { bodyA, bodyB } of ev.pairs) {
        const [thing, wall] = bodyA.label === 'wall' ? [bodyB, bodyA] : [bodyA, bodyB]
        if (wall.label !== 'wall') continue
        const i = bodies.indexOf(thing)
        if (i >= 0 && i !== grab?.i && (thing.speed * 60) / W > 0.15) hits.add(i)
      }
    })
    const scatter = () => {
      hits.forEach((i) => {
        const b = bodies[i]
        const turn = (Math.random() - 0.5) * 2.4 // up to ±70° off a straight bounce, still away from the wall
        const kick = 0.7 + Math.random() * 0.9
        const cos = Math.cos(turn)
        const sin = Math.sin(turn)
        Body.setVelocity(b, { x: (b.velocity.x * cos - b.velocity.y * sin) * kick, y: (b.velocity.x * sin + b.velocity.y * cos) * kick })
        Body.setAngularVelocity(b, b.angularVelocity + (Math.random() - 0.5) * 0.12)
        if (Math.random() < 0.6) toTop(i)
        else {
          order.splice(order.indexOf(i), 1)
          order.splice(Math.floor(Math.random() * (order.length + 1)), 0, i)
          restack = true
        }
      })
      hits.clear()
    }

    // What lies on what: something moving fast under something else can bounce up and land on top of it, so a
    // good shake reshuffles the pile.
    const shuffle = (dt: number) => {
      if (reduced) return
      // things that are still moving and lie almost squarely on top of each other ease apart, so a pile stays a loose
      // spread of half-covered things rather than a tight stack
      for (let i = 0; i < bodies.length; i++) {
        for (let j = i + 1; j < bodies.length; j++) {
          const a = bodies[i]
          const c = bodies[j]
          if (a.speed + c.speed < 0.3) continue
          const dx = c.position.x - a.position.x
          const dy = c.position.y - a.position.y
          const d = Math.hypot(dx, dy) || 1
          const near = (Math.min(dims[i].w, dims[i].h, dims[j].w, dims[j].h) * size) * 0.7
          if (d >= near) continue
          const push = ((near - d) / near) * 0.35
          if (grab?.i !== i) Body.setVelocity(a, { x: a.velocity.x - (dx / d) * push, y: a.velocity.y - (dy / d) * push })
          if (grab?.i !== j) Body.setVelocity(c, { x: c.velocity.x + (dx / d) * push, y: c.velocity.y + (dy / d) * push })
        }
      }
      bodies.forEach((b, i) => {
        if (grab?.i === i) return
        const speed = (b.speed * 60) / W // box-widths per second
        if (speed < 0.2) return
        const above = order.slice(order.indexOf(i) + 1)
        if (above.some((j) => Bounds.overlaps(b.bounds, bodies[j].bounds)) && Math.random() < Math.min(0.5, speed * dt * 3)) toTop(i)
      })
    }

    const tick = (now: number) => {
      const dt = Math.min(now - last, 32) / 1000
      last = now
      // the box: follows the pointer while held, glides to a stop when let go, and stops dead at the edges
      if (!boxDrag) {
        pos.x += vel.x * dt
        pos.y += vel.y * dt
        const damp = Math.exp(-dt / 0.14)
        vel.x *= damp
        vel.y *= damp
      }
      const cx = clamp(pos.x, -limit.l, limit.r)
      const cy = clamp(pos.y, -limit.u, limit.d)
      if (cx !== pos.x) vel.x = 0
      if (cy !== pos.y) vel.y = 0
      pos.x = cx
      pos.y = cy
      if (dt > 0) {
        const vx = (pos.x - prev.x) / dt
        const vy = (pos.y - prev.y) / dt
        prev.x = pos.x
        prev.y = pos.y
        if (boxDrag) {
          vel.x = vel.x * 0.6 + vx * 0.4
          vel.y = vel.y * 0.6 + vy * 0.4
        }
        const k = 1 - Math.exp(-dt / 0.03)
        const dvx = (vx - boxV.x) * k // how much the box's velocity changed this frame
        const dvy = (vy - boxV.y) * k
        boxV.x += dvx
        boxV.y += dvy
        // The things are simulated from the box's point of view. When the box changes speed they keep theirs, so
        // relative to the box they gain the opposite; then the floor's friction pulls them back towards the box's
        // speed, but only so hard. Gentle moves are fully cancelled (they ride along); sharp ones aren't (they slide,
        // hit the walls and skid over each other). matter counts velocity in px per 1/60 s.
        bodies.forEach((b, i) => {
          if (grab?.i === i) return
          const grip = (GRIP * grips[i] * W * dt) / 60
          // and each one tumbles a little its own way
          const jolt = reduced ? 0 : Math.hypot(dvx, dvy) / 60
          let ux = b.velocity.x - (reduced ? 0 : (dvx * heft[i]) / 60) + (Math.random() - 0.5) * jolt * 0.35
          let uy = b.velocity.y - (reduced ? 0 : (dvy * heft[i]) / 60) + (Math.random() - 0.5) * jolt * 0.35
          const u = Math.hypot(ux, uy)
          const slow = u > grip ? (u - grip) / u : 0
          ux *= slow
          uy *= slow
          Body.setVelocity(b, { x: ux, y: uy })
          // sliding things turn a little as they go, and the floor stops their spin too
          Body.setAngularVelocity(b, b.angularVelocity * (u > grip ? 0.97 : 0.8) + (u > grip ? (Math.random() - 0.5) * 0.004 : 0))
        })
      }
      Engine.update(engine, dt * 1000)
      if (!reduced) scatter()
      shuffle(dt)
      paint()
      raf = visible ? requestAnimationFrame(tick) : 0
    }

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible && !raf) {
        last = performance.now()
        raf = requestAnimationFrame(tick)
      }
    })
    io.observe(host)
    const ro = new ResizeObserver(() => {
      measure()
      paint()
    })
    ro.observe(box)
    ro.observe(host)
    paint()

    // ----- dragging the box -----
    const onBoxDown = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('.toybox__item')) return
      measure() // the heading may have slid into place since, so take the limits afresh
      boxDrag = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y, id: e.pointerId }
      box.setPointerCapture(e.pointerId)
      box.classList.add('is-dragging')
    }
    const onBoxMove = (e: PointerEvent) => {
      if (!boxDrag || e.pointerId !== boxDrag.id) return
      pos.x = boxDrag.ox + e.clientX - boxDrag.px
      pos.y = boxDrag.oy + e.clientY - boxDrag.py
    }
    const onBoxUp = () => {
      boxDrag = null
      box.classList.remove('is-dragging')
    }
    box.addEventListener('pointerdown', onBoxDown)
    box.addEventListener('pointermove', onBoxMove)
    box.addEventListener('pointerup', onBoxUp)
    box.addEventListener('pointercancel', onBoxUp)

    // ----- moving the things inside -----
    const local = (e: PointerEvent) => {
      const r = box.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const onItemDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const i = els.current.findIndex((el) => el === e.currentTarget)
      if (i < 0) return
      e.stopPropagation()
      const p = local(e)
      const b = bodies[i]
      const c = Constraint.create({ pointA: p, bodyB: b, pointB: { x: p.x - b.position.x, y: p.y - b.position.y }, stiffness: 0.2, damping: 0.1, length: 0 })
      Composite.add(world, c)
      grab = { i, c, sx: p.x, sy: p.y, moved: false }
      toTop(i) // picked up, it's on top of everything
      els.current[i]?.classList.add('is-held')
      window.addEventListener('pointermove', onItemMove)
      window.addEventListener('pointerup', onItemUp)
      window.addEventListener('pointercancel', onItemUp)
    }
    const onItemMove = (e: PointerEvent) => {
      if (!grab) return
      const p = local(e)
      grab.c.pointA = p
      if (Math.hypot(p.x - grab.sx, p.y - grab.sy) > 6) grab.moved = true
    }
    const onItemUp = () => {
      window.removeEventListener('pointermove', onItemMove)
      window.removeEventListener('pointerup', onItemUp)
      window.removeEventListener('pointercancel', onItemUp)
      if (!grab) return
      Composite.remove(world, grab.c)
      const el = els.current[grab.i]
      el?.classList.remove('is-held')
      if (el) el.dataset.dragged = grab.moved ? '1' : ''
      grab = null
    }
    els.current.forEach((el) => el?.addEventListener('pointerdown', onItemDown))

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      onItemUp()
      box.removeEventListener('pointerdown', onBoxDown)
      box.removeEventListener('pointermove', onBoxMove)
      box.removeEventListener('pointerup', onBoxUp)
      box.removeEventListener('pointercancel', onBoxUp)
      els.current.forEach((el) => el?.removeEventListener('pointerdown', onItemDown))
      Events.off(engine, 'collisionStart')
      Composite.clear(world, false)
      Engine.clear(engine)
    }
  }, [])

  return (
    <section className="me" id="about-me">
      <div className="work__inner">
        <p className="work__intro me__intro" data-reveal>
          and for the <span className="hl hl--red">things i don’t keep on my resume</span> (to keep up the facade of being a professional, when in reality i still feel like this <Reality />)
        </p>
      </div>

      <div className="toybox">
        <Collage />
        <div className="toybox__stage" ref={stage}>
          <div className="toybox__box" ref={boxEl} role="group" aria-label="a box of keepsakes">
            {cardboard && <img className="toybox__cardboard" src={cardboard} alt="" draggable={false} />}
            <p className="toybox__note">
              rummage through the box to know more about me
              {collage.arrows.box && <img className="toybox__note-arrow" src={collage.arrows.box} alt="" />}
            </p>
            {artifacts.map((a, i) => (
              <button
                key={a.id}
                type="button"
                ref={(el) => {
                  els.current[i] = el
                }}
                className="toybox__item"
                // sized here, as a share of the box, so it's right from the first paint
                style={{ width: `${(DIMS[i].w / BOX_CM) * 100}%`, aspectRatio: `${a.width} / ${a.height}` }}
                aria-label={`look at the ${a.id.replace(/[-_]+/g, ' ')}`}
                onClick={(e) => {
                  const el = e.currentTarget
                  if (el.dataset.dragged) {
                    el.dataset.dragged = ''
                    return
                  }
                  // some things open into something of their own; everything else opens full size
                  if (a.id === 'camera' && camera.body && camera.photos.length) setSpecial('camera')
                  else setOpen(i)
                }}
              >
                <img src={a.thumb} alt="" draggable={false} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {open !== null && <Lightbox items={viewer} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
      {special === 'camera' && <CameraViewer onClose={() => setSpecial(null)} />}
    </section>
  )
}
