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

/** Where the blobs can go: centre and size in design px (the grey shapes in Figma), and their tilt. */
const SLOTS = [
  { x: 707, y: 299, size: 227, rot: -12 },
  { x: 224, y: 353, size: 189, rot: 15 },
  { x: 485, y: 469, size: 142, rot: -15 },
  { x: 1144, y: 252, size: 142, rot: -3 },
  { x: 1360, y: 418, size: 142, rot: 20 },
  { x: 732, y: 550, size: 142, rot: -3 },
  { x: 940, y: 543, size: 142, rot: 30 },
  { x: 387, y: 154, size: 142, rot: 8 },
  { x: 207, y: 624, size: 142, rot: -7 },
]
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
function geometry(width: number, tallest: number) {
  const s = width / DW
  const bs = clamp(s, 0.5, 1.15) // blobs and heights shrink less than the width, so a phone still shows them
  const left = width * 0.05
  const cw = (width * 0.9) / chunks.length
  const amp = Math.round(134 * clamp(s, 0.6, 1))
  // On a narrow screen the blobs get a band of their own, above the tallest raised heading and caption
  const band = 260
  const narrow = width < 700
  const line = narrow ? Math.round(band + amp + tallest + 90) : Math.round(640 * bs)
  const vs = narrow ? band / 640 : bs // vertical scale for the blob slots
  return { s, bs, vs, left, cw, line, amp, reach: Math.max(270 * s, cw * 0.85), height: line + 64 }
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
/** Scatters a chunk's media over the free slots, in random order and random shapes. */
function place(c: Chunk, i: number, g: Geo, width: number, block: Size, seed: number): Blob[] {
  const r = rng(seed)
  const hl = raisedLeft(g, i, width, block.w) - 20
  const keep = { l: hl, r: hl + block.w + 40, t: g.line - g.amp - 14 - block.h - 60 }
  const peak = centerOf(g, i)
  // the line under a stretch of the board, with this chunk's bump raised: a blob's lowest point must stay above
  // its highest point there, with room to spare (and above the headings resting on the flat line)
  const lineAt = (x: number) => {
    const d = Math.abs(x - peak)
    return d >= g.reach ? g.line : g.line - (g.amp * (1 + Math.cos((Math.PI * d) / g.reach))) / 2
  }
  const floor = (l: number, rr: number) => Math.min(g.line - 70, lineAt(clamp(peak, l, rr)) - 28)
  const half = (size: number) => size * 0.64 // half the rotated shape, roughly
  const placed: { x: number; y: number; size: number }[] = []
  const fits = (x: number, y: number, size: number) => {
    const h = half(size)
    const k = size * 0.72 // a tilted square's corner reaches this far
    if (x - h < 8 || x + h > width - 8 || y - h < 4) return false
    if (y + k > floor(x - k, x + k)) return false
    if (x + k > keep.l && x - k < keep.r && y + k > keep.t) return false
    return placed.every((p) => Math.hypot(p.x - x, p.y - y) > (half(p.size) + h) * 0.9)
  }

  const out: Blob[] = []
  const items = shuffle(c.media.map((_, k) => k), r)
  const add = (item: number, x: number, y: number, size: number, rot: number) => {
    placed.push({ x, y, size })
    out.push({ item, x, y, size, rot: rot + (r() - 0.5) * 12, round: ROUND[Math.floor(r() * ROUND.length)], delay: 180 + out.length * 70 + r() * 60 }) // after the last heading has settled back down
  }
  // first the spots from Figma, in random order
  for (const sl of shuffle(SLOTS, r)) {
    if (out.length === items.length) break
    const size = sl.size * g.bs * (0.9 + r() * 0.2)
    const x = sl.x * g.s
    const y = (sl.y - 60) * g.vs
    if (fits(x, y, size)) add(items[out.length], x, y, size, sl.rot)
  }
  // then, for a chunk with more to show, anywhere else that's free; blobs get a little smaller the harder a
  // place is to find, and whatever still doesn't fit is left out rather than put over the line
  const base = 142 * g.bs
  for (let tries = 0; out.length < items.length && tries < 1500; tries++) {
    const size = base * (1 - Math.min(0.45, tries / 1500)) * (0.85 + r() * 0.3)
    const x = r() * width
    const y = r() * g.line
    if (fits(x, y, size)) add(items[out.length], x, y, size, (r() - 0.5) * 40)
  }
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
  const [hover, setHover] = useState<number | null>(null)
  const [sizes, setSizes] = useState<Size[]>([])
  // the media on show; the set being replaced stays a moment to shrink away
  const [sets, setSets] = useState([{ chunk: LAST, seed: 1, leaving: false }])
  const cx = useRef<number | null>(null)
  const target = useRef(0)
  const raf = useRef(0)

  const active = hover ?? LAST // with nothing hovered, the line rests on the present
  const g = geometry(width, Math.max(110, ...sizes.map((z) => z.h)))
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
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
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

  // one dot per year, spread evenly across its chunk, and one more on the present
  const years = chunks.flatMap((c, i) => {
    const span = Math.max(1, c.to - c.from)
    return Array.from({ length: span }, (_, k) => edgeOf(g, i) + (k / span) * g.cw)
  })
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

  // the bump springs to the active chunk; a resize puts it straight there
  useEffect(() => {
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
  }, [width]) // eslint-disable-line react-hooks/exhaustive-deps

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
        style={{ height: g.height }}
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
            <circle key={k} ref={(el) => { dots.current[k] = el }} cx={x} cy={g.line} r="4" fill="currentColor" />
          ))}
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
            onPointerEnter={() => enter(i)}
            onPointerDown={() => enter(i)}
            onFocus={() => enter(i)}
          />
        ))}

        {chunks.map((c, i) => {
          const up = i === active
          const shown = i === hover
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
