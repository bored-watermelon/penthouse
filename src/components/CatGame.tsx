import { useEffect, useRef, useState } from 'react'
import Matter from 'matter-js'
import { footerCat, socials } from '../lib/footerAssets'

const { Engine, Events, Bodies, Body, Composite, Constraint } = Matter

type Phase = 'waiting' | 'falling' | 'caught' | 'grounded' | 'leaving'
type Status = { kind: 'off' } | { kind: 'intro' } | { kind: 'score'; n: number } | { kind: 'done'; n: number }

/** The top of the cat's head, as a fraction of the picture. The picture faces right and is mirrored when walking left. */
const HEAD = { x: 0.6, y: 0.46 }
const REACH = 0.3 // how far either side of the head, in cat widths, still counts as a catch
const STAGGER = 320 // ms between one social dropping and the next
const TILT = [-7, 6, -4, 8, -5] // how each icon sits in the stack on the cat's head, in degrees
const GRAVITY = 3200 // for the cat's jump, px/s²
const CAT_RATIO = 856 / 1206 // until the picture has loaded and reports its own size
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * The footer's little game. The social icons drop in one after another; the cat walks with ← → (or A / D, or a drag
 * on touch), hops with ↑, and anything that lands on its head is caught and stacks up there. Misses fall to the
 * ground and pile up with real physics, where they can still be grabbed and thrown. Every icon stays a working link.
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
    const still: number[] = socials.map(() => 0)
    const bodies: Matter.Body[] = []
    const stack: number[] = [] // caught icons, bottom first
    let walls: Matter.Body[] = []
    let solids: Matter.Body[] = []
    let W = host.clientWidth
    let H = host.clientHeight
    let size = 0
    let catW = 300
    let catH = catW * CAT_RATIO
    let bubbleW = 0
    const cat = { x: NaN, y: 0, vx: 0, vy: 0, face: 1, faceS: 1, walk: 0 }
    let towerX = 0 // trails the head a little, so the stack sways as the cat walks
    const keys = { left: false, right: false }
    let engaged = false // once the player has moved, ↑ and space belong to the game instead of scrolling
    let running = false
    let raf = 0
    let last = 0
    let revealedOnce = false
    let live = false // a round is in progress
    let leaving = false // icons are flying back up for another round
    let catDrag: { dx: number; x: number; sx: number; moved: boolean } | null = null
    let grab: { i: number; c: Matter.Constraint; sx: number; sy: number; moved: boolean } | null = null

    const inWorld = (i: number) => phase[i] === 'falling' || phase[i] === 'grounded' || phase[i] === 'leaving'
    const iconOf = (b: Matter.Body) => (b.label.startsWith('icon:') ? +b.label.slice(5) : -1)
    const clampX = (x: number) => clamp(x, -catW * 0.1, W - catW * 0.9)
    const head = () => ({ x: cat.x + catW * (0.5 + (HEAD.x - 0.5) * cat.faceS), y: H - catH * (1 - HEAD.y) - cat.y })
    const slot = (k: number, h: { x: number; y: number }) => {
      const lag = clamp(towerX - h.x, -size * 1.5, size * 1.5)
      return { x: h.x + lag * (0.15 + k * 0.18), y: h.y - size * (0.45 + k * 0.9), a: TILT[k % TILT.length] + lag * 0.05 * (k + 1) }
    }
    const replay = (el: Element | null | undefined, cls: string) => {
      if (!el) return
      el.classList.remove(cls)
      void (el as HTMLElement).offsetWidth
      el.classList.add(cls)
    }

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
    // pile up around it instead of hiding it. (On phones the credit moves to the top, where it would just catch them.)
    const buildSolids = () => {
      solids.forEach((b) => Composite.remove(world, b))
      const hr = host.getBoundingClientRect()
      const low = [...(host.parentElement?.querySelectorAll<HTMLElement>('[data-solid]') ?? [])].map((el) => el.getBoundingClientRect()).filter((r) => r.top - hr.top > H / 2)
      solids = low.map((r) => {
        return Bodies.rectangle(r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2, r.width + 8, r.height + 8, {
          isStatic: true,
          label: 'ground',
          chamfer: { radius: Math.min(r.height / 2, 24) },
        })
      })
      Composite.add(world, solids)
    }

    const measure = () => {
      const old = size
      W = host.clientWidth
      H = host.clientHeight
      size = Math.round(clamp(W * 0.037, 44, 64))
      catW = clamp(W * 0.223, 150, 400)
      const img = catEl.current?.querySelector('img')
      catH = catW * (img?.naturalWidth ? img.naturalHeight / img.naturalWidth : CAT_RATIO)
      if (catEl.current) catEl.current.style.width = `${catW}px`
      cat.x = clampX(Number.isNaN(cat.x) ? W * 0.0775 : cat.x) // where Figma has it: 134px in from the left of 1728
      if (old && old !== size) bodies.forEach((b) => Body.scale(b, size / old, size / old))
      buildWalls()
      buildSolids()
      bodies.forEach((b, i) => {
        if (inWorld(i)) Body.setPosition(b, { x: clamp(b.position.x, size / 2, W - size / 2), y: Math.min(H - size / 2, b.position.y) })
      })
      els.current.forEach((el) => el && (el.style.width = el.style.height = `${size}px`))
    }

    const ro = new ResizeObserver(measure)
    ro.observe(host)
    measure()
    const bro = new ResizeObserver(() => (bubbleW = bubble.current?.offsetWidth ?? 0))
    if (bubble.current) bro.observe(bubble.current)

    socials.forEach((s, i) => {
      const opts = { restitution: 0.4, friction: 0.35, frictionAir: 0.01, density: 0.002, label: `icon:${i}` }
      bodies[i] = s.round ? Bodies.circle(0, 0, size / 2, opts) : Bodies.rectangle(0, 0, size, size, { ...opts, chamfer: { radius: size * 0.22 } })
    })

    const show = (i: number, on: boolean) => {
      const el = els.current[i]
      if (el) el.style.visibility = on ? 'visible' : 'hidden'
    }

    const end = () => {
      if (!live || !phase.every((p) => p === 'caught' || p === 'grounded')) return
      live = false
      setStatus({ kind: 'done', n: stack.length })
    }

    const land = (i: number) => {
      phase[i] = 'grounded'
      end()
    }

    const catchIcon = (i: number) => {
      Composite.remove(world, bodies[i])
      phase[i] = 'caught'
      stack.push(i)
      replay(els.current[i], 'is-caught')
      replay(catEl.current, 'is-happy')
      setStatus({ kind: 'score', n: stack.length })
      end()
    }

    Events.on(engine, 'collisionStart', (ev) => {
      for (const { bodyA, bodyB } of ev.pairs) {
        for (const [a, b] of [[bodyA, bodyB], [bodyB, bodyA]]) {
          const i = iconOf(a)
          if (i < 0 || phase[i] !== 'falling') continue
          const j = iconOf(b)
          if (b.label === 'ground' || (j >= 0 && phase[j] === 'grounded')) land(i)
        }
      }
    })

    // One round: the icons drop in a shuffled order, each a random step from the last so the next one is usually
    // (not always) within reach.
    const drop = () => {
      timers.forEach(clearTimeout)
      timers.length = 0
      live = true
      stack.length = 0
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
            phase[i] = 'falling'
            still[i] = 0
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
        phase[i] = 'grounded'
        show(i, true)
      })
    }

    // Another round: everything, caught or not, is flung back up out of sight, then dropped again.
    const again = () => {
      if (live || leaving || reduced) return
      leaving = true
      setStatus({ kind: 'intro' })
      const h = head()
      stack.forEach((i, k) => {
        const p = slot(k, h)
        Body.setPosition(bodies[i], { x: p.x, y: p.y })
        Body.setAngle(bodies[i], (p.a * Math.PI) / 180)
        Composite.add(world, bodies[i])
      })
      stack.length = 0
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
      cat.vy = Math.sqrt(2 * GRAVITY * catH * 0.55)
    }

    const moveCat = (dt: number) => {
      const s = dt / 1000
      if (catDrag) {
        const x = cat.x + (clampX(catDrag.x - catDrag.dx) - cat.x) * (1 - Math.exp(-dt / 45))
        cat.vx = (x - cat.x) / s
        cat.x = x
      } else {
        const max = Math.max(650, W * 0.8)
        const dir = (keys.right ? 1 : 0) - (keys.left ? 1 : 0)
        if (dir) cat.vx = clamp(cat.vx + dir * max * 9 * s, -max, max)
        else cat.vx *= Math.exp(-dt / 60)
        const x = clampX(cat.x + cat.vx * s)
        if (x !== cat.x + cat.vx * s) cat.vx = 0
        cat.x = x
      }
      if (Math.abs(cat.vx) > 40) cat.face = Math.sign(cat.vx)
      cat.faceS += (cat.face - cat.faceS) * (1 - Math.exp(-dt / 50))
      cat.walk += Math.abs(cat.vx) * s
      if (cat.y > 0 || cat.vy > 0) {
        cat.vy -= GRAVITY * s
        cat.y += cat.vy * s
        if (cat.y <= 0) {
          cat.y = 0
          cat.vy = 0
          replay(catEl.current, 'is-landing')
        }
      }
      towerX += (head().x - towerX) * (1 - Math.exp(-dt / 90))
    }

    const referee = () => {
      const h = head()
      const top = h.y - stack.length * size * 0.9
      bodies.forEach((b, i) => {
        if (phase[i] === 'leaving') {
          // out of sight (or somehow on its way back down): park it until the next drop
          if (b.position.y < -size * 1.5 || b.velocity.y > 0) {
            Composite.remove(world, b)
            b.collisionFilter.mask = 0xffffffff
            phase[i] = 'waiting'
            show(i, false)
            if (leaving && phase.every((p) => p === 'waiting')) {
              leaving = false
              drop()
            }
          }
          return
        }
        if (phase[i] !== 'falling' || grab?.i === i) return
        const bottom = b.position.y + size / 2
        if (b.velocity.y > 0 && Math.abs(b.position.x - h.x) < catW * REACH + size * 0.25 && bottom > top - size * 0.25 && bottom < top + size * 0.8) {
          catchIcon(i)
          return
        }
        // resting on something that didn't count as ground (another icon that was still falling, say)
        still[i] = b.speed < 0.3 ? still[i] + 1 : 0
        if (still[i] > 20) land(i)
      })
    }

    const paint = () => {
      const c = catEl.current
      if (c) {
        const waddle = Math.sin(cat.walk / 26) * Math.min(1, Math.abs(cat.vx) / 300) * 4
        c.style.transform = `translate(${cat.x}px, ${-cat.y}px) rotate(${waddle}deg) scaleX(${cat.faceS})`
      }
      const h = head()
      stack.forEach((i, k) => {
        const p = slot(k, h)
        const el = els.current[i]
        if (el) el.style.transform = `translate(${p.x - size / 2}px, ${p.y - size / 2}px) rotate(${p.a}deg)`
      })
      bodies.forEach((b, i) => {
        if (!inWorld(i)) return
        const el = els.current[i]
        if (el) el.style.transform = `translate(${b.position.x - size / 2}px, ${b.position.y - size / 2}px) rotate(${b.angle}rad)`
      })
      const bb = bubble.current
      if (bb) {
        const top = h.y - stack.length * size * 0.9 - 14
        const x = clamp(h.x, bubbleW / 2 + 12, W - bubbleW / 2 - 12)
        bb.style.transform = `translate(${x}px, ${top}px) translate(-50%, -100%)`
        bb.style.setProperty('--tail', `${h.x - x}px`)
      }
    }

    const tick = (now: number) => {
      if (!running) return
      const dt = Math.min(now - last, 32)
      last = now
      moveCat(dt)
      Engine.update(engine, dt)
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

    // ----- icons: grab & throw -----
    const local = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const onDown = (e: PointerEvent) => {
      const i = els.current.findIndex((el) => el === e.currentTarget)
      if (i < 0 || (phase[i] !== 'falling' && phase[i] !== 'grounded')) return // caught ones stay put on the cat
      const body = bodies[i]
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
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
    }
    const onMove = (e: PointerEvent) => {
      if (!grab) return
      const p = local(e)
      grab.c.pointA = p
      if (Math.hypot(p.x - grab.sx, p.y - grab.sy) > 6) grab.moved = true
    }
    const onUp = (e: PointerEvent) => {
      if (!grab) return
      Composite.remove(world, grab.c)
      const el = els.current[grab.i]
      if (el) el.dataset.dragged = grab.moved ? '1' : ''
      grab = null
      ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
    }
    els.current.forEach((el) => {
      el?.addEventListener('pointerdown', onDown)
      el?.addEventListener('pointermove', onMove)
      el?.addEventListener('pointerup', onUp)
      el?.addEventListener('pointercancel', onUp)
    })

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
      els.current.forEach((el) => {
        el?.removeEventListener('pointerdown', onDown)
        el?.removeEventListener('pointermove', onMove)
        el?.removeEventListener('pointerup', onUp)
        el?.removeEventListener('pointercancel', onUp)
      })
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

      <div className={`game__bubble${status.kind === 'off' ? '' : ' is-on'}`} ref={bubble} role="status" aria-live="polite">
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
            gotcha! <b>{status.n}/{total}</b>
          </>
        )}
        {status.kind === 'done' &&
          (status.n === total ? (
            <>all {total}, purrfect. tap one to say hi ↓</>
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
