import { useEffect, useRef } from 'react'

/*
 * The bottom of the page peels up at its right corner, uncovering the footer (loosely after Figma node 374:6148).
 * The page ("sheet") is clipped along the crease, and the folded-back flap is drawn over it: the part cut off,
 * folded over the crease, its back shaded from the crease out to the tip. Scrolling into the footer lifts the
 * corner further. At its biggest the fold still fits inside the strip of page left on screen once the footer is
 * fully out.
 */
const REST = 0.3 // how lifted the corner is before the footer shows, as a share of its full size
const ease = (t: number) => 1 - (1 - t) ** 3
const f = (n: number) => n.toFixed(1)

type P = [number, number]
/** A point on an outline: one of the page's corners, a step round its rounded one, or where a line cut it. */
type Pt = { p: P; kind: 'corner' | 'round' | 'crease' | 'cut' }
const lerp = (p: P, q: P, t: number): P => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]

/** What's left of a (convex) outline on the side of a line where side(p) >= 0; where it was cut is marked `kind`. */
function keep(pts: Pt[], side: (p: P) => number, kind: Pt['kind']) {
  const out: Pt[] = []
  pts.forEach((pt, i) => {
    const next = pts[(i + 1) % pts.length]
    const s = side(pt.p)
    const t = side(next.p)
    if (s >= 0) out.push(pt)
    if (s >= 0 !== t >= 0) out.push({ p: lerp(pt.p, next.p, s / (s - t)), kind })
  })
  return out
}

/** An outline as path data; `bend` gives an edge's control point when it's curved. */
function trace(pts: Pt[], bend: (from: Pt, to: Pt) => P | null) {
  if (pts.length < 3) return ''
  let d = `M${f(pts[0].p[0])} ${f(pts[0].p[1])}`
  pts.forEach((from, i) => {
    const to = pts[(i + 1) % pts.length]
    const c = bend(from, to)
    d += c ? ` Q${f(c[0])} ${f(c[1])} ${f(to.p[0])} ${f(to.p[1])}` : ` L${f(to.p[0])} ${f(to.p[1])}`
  })
  return `${d} Z`
}

export default function PageCurl({ sheet }: { sheet: React.RefObject<HTMLDivElement | null> }) {
  const shadowSvg = useRef<SVGSVGElement>(null)
  const shadow = useRef<SVGPathElement>(null)
  const flapSvg = useRef<SVGSVGElement>(null)
  const flap = useRef<SVGPathElement>(null)
  const shine = useRef<SVGLinearGradientElement>(null)

  useEffect(() => {
    const page = sheet.current!
    const spacer = document.querySelector<HTMLElement>('.foot-spacer')
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    let k = -1 // how far the corner is lifted: REST before the footer, 1 with the footer fully out
    let v = 0
    let target = REST
    let raf = 0
    let last = 0

    const draw = () => {
      const w = page.offsetWidth
      const h = page.offsetHeight
      // the page's last strip on screen is --fold tall (see .foot-spacer); keep the fold well inside it
      const fold = Math.min(210, Math.max(120, innerHeight * 0.18))
      const full = Math.min(fold * 0.55, w * 0.1)
      const r = Math.min(48, w * 0.04)
      const a = Math.max(0.01, full * k) // up the right edge
      const b = a * 1.12 // along the bottom edge
      const L2 = a * a + b * b
      const side = ([x, y]: P) => a * (w - x) + b * (h - y) - a * b // >= 0 on the page, < 0 on the flap
      const flip = (p: P): P => {
        const s = side(p)
        return [p[0] + (2 * s * a) / L2, p[1] + (2 * s * b) / L2]
      }

      // the page's outline, its bottom-left corner rounded
      const round = Array.from({ length: r ? 5 : 0 }, (_, i): Pt => {
        const t = (i + 1) / 6
        return { p: lerp(lerp([r, h], [0, h], t), lerp([0, h], [0, h - r], t), t), kind: 'round' }
      })
      const corners: P[] = [[0, 0], [w, 0], [w, h], [r, h]]
      const outline: Pt[] = [...corners.map((p): Pt => ({ p, kind: 'corner' })), ...round, { p: [0, h - r], kind: 'corner' }]
      const kept = keep(outline, side, 'crease')
      const gone = keep(outline, (p) => -side(p), 'crease').map((pt) => ({ ...pt, p: flip(pt.p) }))

      const ends = kept.filter((pt) => pt.kind === 'crease').map((pt) => pt.p)
      const M = ends.length === 2 ? lerp(ends[0], ends[1], 0.5) : ([w, h] as P)
      // a slight bow toward the corner, as paper bends
      const toward = Math.hypot(w - M[0], h - M[1]) || 1
      const give = Math.min(toward * 0.12, 40)
      const bow: P = [M[0] + ((w - M[0]) / toward) * give, M[1] + ((h - M[1]) / toward) * give]
      const crease = (from: Pt, to: Pt) => from.kind === 'crease' && to.kind === 'crease'
      const pageEdge = (from: Pt, to: Pt) => (crease(from, to) ? bow : null)
      // the flap's edges curve in toward the crease, like a peeled sticker
      const flapEdge = (from: Pt, to: Pt) =>
        crease(from, to) ? bow : from.kind === 'round' || to.kind === 'round' ? null : lerp(lerp(from.p, to.p, 0.5), M, 0.32)

      page.style.clipPath = kept.length ? `path('${trace(kept, pageEdge)}')` : 'inset(50%)'

      // both drawings cover a strip at the bottom of the page, from just above the flap down
      const reach = Math.min(...gone.map((pt) => pt.p[1]))
      const top = Math.max(0, Math.min(h - full - 60, reach - 40))
      for (const svg of [shadowSvg.current!, flapSvg.current!]) {
        svg.setAttribute('viewBox', `0 ${f(top)} ${w} ${f(h - top)}`)
        svg.style.height = `${h - top}px`
      }
      // the page's own shadow: the same outline, under it
      shadow.current!.setAttribute('d', trace(keep(kept, ([, y]) => y - top, 'cut'), pageEdge))
      // the flap, over the page, shaded from the crease (in shadow) to the tip (catching the light)
      flap.current!.setAttribute('d', trace(gone, flapEdge))
      const tip = flip([w, h])
      const g = shine.current!
      g.setAttribute('x1', f(M[0]))
      g.setAttribute('y1', f(M[1]))
      g.setAttribute('x2', f(tip[0]))
      g.setAttribute('y2', f(tip[1]))
    }

    const measure = () => {
      if (!spacer) return
      const rect = spacer.getBoundingClientRect()
      const p = Math.min(1, Math.max(0, (innerHeight - rect.top) / Math.max(1, rect.height)))
      target = REST + (1 - REST) * ease(p)
    }
    // a slightly springy follow, so the corner settles like paper rather than sticking to the scroll
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
      last = now
      v += ((target - k) * 170 - v * 15) * dt
      k += v * dt
      draw()
      raf = Math.abs(target - k) > 0.0005 || Math.abs(v) > 0.001 ? requestAnimationFrame(step) : 0
    }
    const update = () => {
      measure()
      if (still || k < 0) {
        k = target
        draw()
      } else if (!raf) {
        last = performance.now()
        raf = requestAnimationFrame(step)
      }
    }

    update()
    const ro = new ResizeObserver(() => draw())
    ro.observe(page)
    addEventListener('scroll', update, { passive: true })
    addEventListener('resize', update)
    return () => {
      ro.disconnect()
      removeEventListener('scroll', update)
      removeEventListener('resize', update)
      cancelAnimationFrame(raf)
      page.style.clipPath = ''
    }
  }, [sheet])

  return (
    <div className="curl" aria-hidden>
      <svg ref={shadowSvg} className="curl__shadow" preserveAspectRatio="none">
        <path ref={shadow} fill="#fafaf9" />
      </svg>
      <svg ref={flapSvg} className="curl__flap" preserveAspectRatio="none">
        <defs>
          <linearGradient id="curl-shine" ref={shine} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#d6d3d1" />
            <stop offset="0.35" stopColor="#efedec" />
            <stop offset="0.8" stopColor="#f5f5f4" />
            <stop offset="1" stopColor="#fafaf9" />
          </linearGradient>
        </defs>
        <path ref={flap} fill="url(#curl-shine)" />
      </svg>
    </div>
  )
}
