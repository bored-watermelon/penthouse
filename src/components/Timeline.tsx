import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { chunks, type Chunk } from '../lib/timeline'
import type { PlayItem } from '../content'

// Pictures already fetched and decoded, so a blob can appear whole the moment it's placed.
const ready = new Set<string>()
const warm = (src: string) => {
  if (ready.has(src)) return
  const img = new Image()
  img.src = src
  img.decode().then(() => ready.add(src), () => {})
}

/**
 * One blob of media. It waits, hidden, until its picture has loaded, then grows in once: no grey shape first
 * and the photo popping in over it after.
 */
function MediaBlob({ m, leaving, style }: { m: PlayItem; leaving: boolean; style: React.CSSProperties }) {
  const src = m.thumb ?? m.src
  const [loaded, setLoaded] = useState(() => !m.video && ready.has(src))
  const done = () => {
    ready.add(src)
    setLoaded(true)
  }
  return (
    <span className={`tl__blob${loaded ? ' is-loaded' : ''}${leaving ? ' is-leaving' : ''}`} style={style}>
      {m.video ? <video src={m.src} autoPlay muted loop playsInline onLoadedData={done} /> : <img src={src} alt="" draggable={false} onLoad={done} />}
    </span>
  )
}

/*
 * Laid out on the 1512-wide Figma frame: sizes below are design px, scaled to the board's width. The line runs edge
 * to edge, with the chunks of time sharing it equally. Hovering a chunk lifts the line under it, raises its heading
 * with the caption, and pops its media into blobs around the board.
 */
const DW = 1512
const CAPTION_W = 261

const ROUND = ['50%', '50%', '31%', '35%', '37%', '42%'] // circles and rounded squares, as in Figma

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
/** A small seeded random, so a layout stays the same through a resize. */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const shuffle = <T,>(a: T[], r: () => number) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

type Geo = ReturnType<typeof geometry>
/** The board fills the rest of a screen-tall section: the line runs near its bottom, the years under it. */
function geometry(width: number, height: number) {
  const s = width / DW
  const left = width * 0.05
  const cw = (width * 0.9) / chunks.length
  const amp = Math.round(134 * clamp(s, 0.6, 1))
  const line = Math.max(amp + 240, Math.round(height - 64))
  return { s, left, cw, line, amp, reach: Math.max(270 * s, cw * 0.85), height: line + 64 }
}
const centerOf = (g: Geo, i: number) => g.left + (i + 0.5) * g.cw
const edgeOf = (g: Geo, i: number) => g.left + i * g.cw
/**
 * The raised heading's left edge. A full-width caption starts a little left of the peak, as in Figma; a short one
 * (like "i ate mud") sits centred on the peak. Always on the board.
 */
const raisedLeft = (g: Geo, i: number, width: number, bw: number) =>
  clamp(centerOf(g, i) - (bw < 200 ? bw / 2 : 74 * g.s), 8, Math.max(8, width - 8 - bw))

type Size = { w: number; h: number } // a raised heading with its caption: widest line, and the caption's height
type Blob = { item: number; x: number; y: number; size: number; rot: number; round: string; delay: number }
const layouts = new Map<string, Blob[]>()
/**
 * Packs a chunk's media into the free space above the line: as large as they can all be while fitting, and spread
 * evenly, so however many a chunk has, they fill the area (clear of the line, its raised bump and the heading).
 * Found by trying ever bigger sizes until they no longer fit; seeded, so a chunk's layout stays put.
 */
function place(c: Chunk, i: number, g: Geo, width: number, block: Size, seed: number): Blob[] {
  const n = c.media.length
  if (!n) return []
  const key = [c.id, seed, width, g.line, Math.round(block.w), Math.round(block.h)].join('|')
  const cached = layouts.get(key)
  if (cached) return cached

  const hl = raisedLeft(g, i, width, block.w) - 20
  const keep = { l: hl, r: hl + block.w + 40, t: g.line - g.amp - 14 - block.h - 48 }
  const peak = centerOf(g, i)
  // the line under a stretch of the board, with this chunk's bump raised: a blob's lowest point must stay above
  // its highest point there, with room to spare (and above the headings resting on the flat line)
  const lineAt = (x: number) => {
    const d = Math.abs(x - peak)
    return d >= g.reach ? g.line : g.line - (g.amp * (1 + Math.cos((Math.PI * d) / g.reach))) / 2
  }
  const floor = (l: number, rr: number) => Math.min(g.line - 70, lineAt(clamp(peak, l, rr)) - 28)
  const half = (size: number) => size * 0.6 // a rounded square's corner, tilted, reaches about this far
  type P = { x: number; y: number; size: number }
  const fits = (x: number, y: number, size: number, placed: P[]) => {
    const k = size * 0.72
    if (x - k < 8 || x + k > width - 8 || y - k < 8) return false
    if (y + k > floor(x - k, x + k)) return false
    if (x + k > keep.l && x - k < keep.r && y + k > keep.t) return false
    return placed.every((p) => Math.hypot(p.x - x, p.y - y) > half(p.size) + half(size) + 10)
  }
  // how much room a photo at (x, y) has: the gap to the nearest other photo, or to the region's edges
  const room = (x: number, y: number, size: number, others: P[]) => {
    const k = size * 0.72
    let d = Math.min(x - k - 8, width - 8 - x - k, y - k - 8, floor(x - k, x + k) - y - k)
    for (const p of others) d = Math.min(d, Math.hypot(p.x - x, p.y - y) - half(p.size) - half(size))
    return d
  }
  // All n at about size s, or null if they don't all fit. Each goes where it's snuggest (packing tight is what
  // lets them be big), then they're eased apart into whatever space is left, so the gaps come out even.
  const attempt = (s: number, r: () => number) => {
    const placed: P[] = []
    for (let k = 0; k < n; k++) {
      const size = s * (0.86 + r() * 0.28)
      let best: P | null = null
      let score = Infinity
      for (let t = 0; t < 360; t++) {
        const x = r() * width
        const y = r() * g.line
        if (!fits(x, y, size, placed)) continue
        const d = room(x, y, size, placed)
        if (d < score) {
          best = { x, y, size }
          score = d
        }
      }
      if (!best) return null
      placed.push(best)
    }
    for (let pass = 0; pass < 24; pass++) {
      placed.forEach((p, k) => {
        const others = placed.filter((_, j) => j !== k)
        let here = room(p.x, p.y, p.size, others)
        for (let t = 0; t < 6; t++) {
          const a = r() * Math.PI * 2
          const step = 4 + r() * 14
          const x = p.x + Math.cos(a) * step
          const y = p.y + Math.sin(a) * step
          if (!fits(x, y, p.size, others)) continue
          const d = room(x, y, p.size, others)
          if (d > here) {
            p.x = x
            p.y = y
            here = d
          }
        }
      })
    }
    return placed
  }
  let lo = 36
  let hi = Math.min(width * 0.42, g.line * 0.55, 380)
  let found = attempt(lo, rng(seed))
  for (let it = 0; it < 11 && hi - lo > 4; it++) {
    const mid = (lo + hi) / 2
    const lay = attempt(mid, rng(seed + it * 7919))
    if (lay) {
      found = lay
      lo = mid
    } else hi = mid
  }
  const r = rng(seed ^ 0x5bd1e995) // shapes, tilts and order, the same whatever size won
  const order = shuffle(c.media.map((_, k) => k), r)
  const out = (found ?? []).map((p, k) => ({
    item: order[k],
    ...p,
    rot: (r() - 0.5) * 28,
    round: ROUND[Math.floor(r() * ROUND.length)],
    delay: 180 + k * 70 + r() * 60, // after the last heading has settled back down
  }))
  layouts.set(key, out)
  return out
}

const LAST = chunks.length - 1
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

export default function Timeline() {
  const board = useRef<HTMLDivElement>(null)
  const main = useRef<SVGPathElement>(null)
  const dots = useRef<(SVGCircleElement | null)[]>([])
  const heads = useRef<(HTMLDivElement | null)[]>([])
  const captions = useRef<(HTMLParagraphElement | null)[]>([])
  const [width, setWidth] = useState(1200)
  const [height, setHeight] = useState(720)
  const [hover, setHover] = useState<number | null>(null)
  const [sizes, setSizes] = useState<Size[]>([])
  // the media on show; the set being replaced stays a moment to shrink away
  const [sets, setSets] = useState([{ chunk: LAST, seed: 1, leaving: false }])
  const cx = useRef<number | null>(null)
  const target = useRef(0)
  const raf = useRef(0)
  const knob = useRef<SVGGElement>(null)
  // Touch screens have no hover, so the line gets a knob to drag instead: the bump follows the finger, and
  // snaps to the chunk it's let go over. The chosen chunk's caption always shows.
  const [touch, setTouch] = useState(() => matchMedia('(hover: none)').matches)
  const [scrubbed, setScrubbed] = useState(false) // the "drag" hint goes once it's been used
  const drag = useRef<{ id: number; x0: number; y0: number; x: number; on: boolean } | null>(null)
  useEffect(() => {
    const m = matchMedia('(hover: none)')
    const on = () => setTouch(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])

  const active = hover ?? LAST // with nothing hovered, the line rests on the present
  const g = geometry(width, height)
  const sizeOf = (i: number): Size => sizes[i] ?? { w: CAPTION_W, h: 110 }

  // fetch every chunk's pictures as the timeline comes near, so hovering shows them straight away
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      chunks.forEach((c) => c.media.forEach((m) => !m.video && warm(m.thumb ?? m.src)))
      io.disconnect()
    }, { rootMargin: '1000px 0px' })
    io.observe(board.current!)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const ro = new ResizeObserver(([e]) => {
      setWidth(e.contentRect.width)
      setHeight(e.contentRect.height)
    })
    ro.observe(board.current!)
    return () => ro.disconnect()
  }, [])

  // block widths, to centre short ones on the peak, and caption heights, to keep the blobs clear of them
  const measure = () => {
    const grow = matchMedia('(max-width: 860px)').matches ? 1.35 : 1.6 // raised text headings, see .tl__head.is-up h3
    setSizes(
      chunks.map((c, i) => {
        const cap = captions.current[i]
        const head = heads.current[i]?.firstElementChild as HTMLElement | null
        const hw = (head?.offsetWidth ?? 0) * ('text' in c.heading ? grow : 1)
        return { w: Math.max(hw, cap?.offsetWidth ?? 0), h: cap?.offsetHeight ?? 0 }
      }),
    )
  }
  useLayoutEffect(() => {
    measure()
    document.fonts?.ready.then(measure)
    // a late font or logo changes the sizes too
    const ro = new ResizeObserver(() => measure())
    captions.current.forEach((c) => c && ro.observe(c))
    return () => ro.disconnect()
  }, [width]) // eslint-disable-line react-hooks/exhaustive-deps

  // one dot per year, spread evenly across its chunk, and one more on the present. They're all there however narrow
  // the screen (each dot is a year); on a small one they're just drawn smaller, sized so the most crowded chunk's
  // dots still stand apart, and the same size everywhere so the line looks even.
  const years = chunks.flatMap((c, i) => {
    const span = Math.max(1, c.to - c.from)
    return Array.from({ length: span }, (_, k) => edgeOf(g, i) + (k / span) * g.cw)
  })
  const tightest = Math.min(...chunks.map((c) => g.cw / Math.max(1, c.to - c.from)))
  const dotR = clamp(tightest * 0.34, 1.5, 4)
  years.push(edgeOf(g, chunks.length))

  const bump = (x: number, c: number) => {
    const d = Math.abs(x - c)
    return d >= g.reach ? g.line : g.line - (g.amp * (1 + Math.cos((Math.PI * d) / g.reach))) / 2
  }
  const paint = (c: number) => {
    let d = ''
    for (let x = 0; x <= width + 3; x += 3) d += `${x ? 'L' : 'M'}${x} ${bump(x, c).toFixed(1)}`
    main.current?.setAttribute('d', d)
    years.forEach((x, k) => dots.current[k]?.setAttribute('cy', bump(x, c).toFixed(1)))
    knob.current?.setAttribute('transform', `translate(${c.toFixed(1)} ${bump(c, c).toFixed(1)})`)
  }
  const run = () => {
    cancelAnimationFrame(raf.current)
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      cx.current! += (target.current - cx.current!) * (1 - Math.exp(-dt * 9))
      const done = Math.abs(target.current - cx.current!) < 0.2
      if (done) cx.current = target.current
      paint(cx.current!)
      if (!done) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }

  // the bump springs to the active chunk (unless a finger is dragging it); a resize puts it straight there
  useEffect(() => {
    if (drag.current?.on) return
    target.current = centerOf(g, active)
    if (cx.current === null || reducedMotion()) {
      cx.current = target.current
      paint(cx.current)
    } else run()
    return () => cancelAnimationFrame(raf.current)
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    cx.current = centerOf(g, active)
    paint(cx.current)
  }, [width, height]) // eslint-disable-line react-hooks/exhaustive-deps

  // a new chunk brings a new scatter; the old one shrinks away
  useEffect(() => {
    setSets((prev) => {
      if (prev.some((p) => p.chunk === active && !p.leaving)) return prev
      return [...prev.filter((p) => !p.leaving).map((p) => ({ ...p, leaving: true })), { chunk: active, seed: Math.floor(Math.random() * 1e9), leaving: false }]
    })
    const t = window.setTimeout(() => setSets((prev) => prev.filter((p) => !p.leaving)), 100)
    return () => window.clearTimeout(t)
  }, [active])

  // the last chunk hovered stays open, caption and all, until another one is hovered
  const enter = (i: number) => setHover(i)

  // Scrubbing: a sideways drag anywhere on the board (a vertical one still scrolls the page, see touch-action)
  const chunkAt = (x: number) => Math.min(LAST, Math.max(0, Math.floor((x - g.left) / g.cw)))
  const onDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse') return
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, on: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    if (!d.on) {
      const dx = Math.abs(e.clientX - d.x0)
      if (dx < 8 || dx < Math.abs(e.clientY - d.y0)) return
      d.on = true
      board.current!.setPointerCapture(e.pointerId)
      setScrubbed(true)
    }
    d.x = e.clientX
    const x = Math.min(g.left + g.cw * chunks.length, Math.max(g.left, e.clientX - board.current!.getBoundingClientRect().left))
    target.current = x
    run()
    setHover(chunkAt(x))
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.on) return
    // where the finger was last seen, not where this event says: a phone that cancels the touch (it does, if it
    // thinks the page should scroll after all) can report 0, which snapped the knob to the far left
    const x = d.x - board.current!.getBoundingClientRect().left
    const i = chunkAt(x)
    setHover(i)
    target.current = centerOf(g, i) // settle on the chunk it was let go over
    run()
  }

  return (
    <section className="tl" id="timeline">
      <div className="work__inner">
        <p className="work__intro" data-reveal>
          so, how did i get here? <span className="hl hl--purple">a quick tour, {chunks[0]?.from ?? 2002} to now.</span>
        </p>
      </div>

      <div
        className="tl__board"
        ref={board}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <div className="tl__media" aria-hidden>
          {/* each scatter is keyed, so when the one before it is cleared away it stays put instead of being
              rebuilt (and popping in a second time) */}
          {sets.map((set) => {
            const c = chunks[set.chunk]
            if (!c) return null
            return (
              <Fragment key={set.seed}>
                {place(c, set.chunk, g, width, sizeOf(set.chunk), set.seed).map((b) => (
                  <MediaBlob
                    key={b.item}
                    m={c.media[b.item]}
                    leaving={set.leaving || set.chunk !== active} // in the same render that starts raising the new heading
                    style={{ left: b.x, top: b.y, width: b.size, height: b.size, borderRadius: b.round, rotate: `${b.rot}deg`, animationDelay: `${b.delay}ms` }}
                  />
                ))}
              </Fragment>
            )
          })}
        </div>

        <svg className="tl__svg" width={width} height={g.height} viewBox={`0 0 ${width} ${g.height}`} aria-hidden>
          <path ref={main} fill="none" stroke="currentColor" strokeWidth="1.5" />
          {years.map((x, k) => (
            <circle key={k} ref={(el) => { dots.current[k] = el }} cx={x} cy={g.line} r={dotR} fill="currentColor" />
          ))}
          {/* the scrubber, on touch screens: it rides the top of the bump */}
          {touch && (
            <g ref={knob} className={`tl__knob${scrubbed ? ' is-used' : ''}`}>
              <circle className="tl__knob-ring" r="14" />
              <circle r="14" fill="#fff" stroke="currentColor" strokeWidth="1.5" />
              <path d="M-3 -4.5 -7.5 0 -3 4.5 M3 -4.5 7.5 0 3 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              {!scrubbed && (
                <text className="tl__knob-hint" y="38" textAnchor="middle">
                  drag me
                </text>
              )}
            </g>
          )}
        </svg>

        {/* the years under the line: where each chunk starts, and the present at the end */}
        <ol className="tl__years" aria-hidden>
          {chunks.map((c, i) => (
            <li key={c.id} style={{ left: edgeOf(g, i), top: g.line + 22 }}>{c.from}</li>
          ))}
          <li style={{ left: edgeOf(g, chunks.length), top: g.line + 22 }}>{chunks[LAST]?.to}</li>
        </ol>

        {/* each chunk's hover area is the whole height of the board over its stretch of the line */}
        {chunks.map((c, i) => (
          <button
            type="button"
            key={c.id}
            className="tl__zone"
            style={{
              left: i === 0 ? 0 : edgeOf(g, i),
              width: (i === LAST ? width : edgeOf(g, i + 1)) - (i === 0 ? 0 : edgeOf(g, i)),
              top: 0,
              bottom: 0,
            }}
            aria-label={`${c.from} to ${c.to}: ${'text' in c.heading ? c.heading.text : c.heading.name}. ${c.caption}`}
            // a mouse chooses by hovering; a finger by tapping (so a swipe that happens to start here, to
            // scroll the page, doesn't switch chunks)
            onPointerEnter={(e) => e.pointerType === 'mouse' && enter(i)}
            onPointerDown={(e) => e.pointerType === 'mouse' && enter(i)}
            onClick={() => enter(i)}
            onFocus={() => enter(i)}
          />
        ))}

        {chunks.map((c, i) => {
          const up = i === active
          const shown = i === hover || (touch && i === active)
          const top = up ? g.line - g.amp - 16 : g.line - 20 // the bottom of the heading, or of the caption once it opens
          return (
            <div
              key={c.id}
              className={`tl__head${up ? ' is-up' : ''}${shown ? ' is-shown' : ''}`}
              ref={(el) => { heads.current[i] = el }}
              style={{ left: up ? raisedLeft(g, i, width, sizeOf(i).w) : centerOf(g, i), top }}
              aria-hidden
            >
              {'logo' in c.heading ? <img className="tl__logo" src={c.heading.logo} alt={c.heading.name} draggable={false} onLoad={measure} /> : <h3>{c.heading.text}</h3>}
              <div className="tl__more">
                <div>
                  <p className="tl__caption" ref={(el) => { captions.current[i] = el }} style={{ maxWidth: Math.min(CAPTION_W, width - 16) }}>
                    {c.caption}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </section>
  )
}
