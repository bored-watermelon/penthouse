import { useEffect, useRef } from 'react'

/*
 * The bottom of the page peels up at its right corner, uncovering the footer (loosely after Figma node 374:6148).
 * The page ("sheet") is clipped along the crease, and the folded-back flap is drawn over it: its back is shaded
 * from the crease out to the tip. Scrolling into the footer lifts the corner further, like a page being turned.
 * At its biggest the fold still fits inside the strip of page left on screen once the footer is fully out.
 */
const REST = 0.3 // how lifted the corner is before the footer shows, as a share of its full size
const ease = (t: number) => 1 - (1 - t) ** 3
const f = (n: number) => n.toFixed(1)

export default function PageCurl({ sheet }: { sheet: React.RefObject<HTMLDivElement | null> }) {
  const shadowSvg = useRef<SVGSVGElement>(null)
  const shadow = useRef<SVGPathElement>(null)
  const flapSvg = useRef<SVGSVGElement>(null)
  const flap = useRef<SVGPathElement>(null)
  const shine = useRef<SVGLinearGradientElement>(null)

  useEffect(() => {
    const page = sheet.current!
    const spacer = page.parentElement?.querySelector<HTMLElement>('.foot-spacer')
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
      const a = full * k // up the right edge
      const b = a * 1.12 // along the bottom edge
      const A = [w, h - a]
      const B = [w - b, h]
      const L2 = a * a + b * b
      // the corner, folded over the crease, lands here
      const C = [w - (2 * a * b * a) / L2, h - (2 * a * b * b) / L2]
      const M = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2]
      const crease = [M[0] + (w - M[0]) * 0.12, M[1] + (h - M[1]) * 0.12] // a slight bow, as paper bends
      // the flap's edges curve in toward the tip, like a peeled sticker
      const lerp = (p: number[], q: number[], t: number) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]
      const e1 = lerp(lerp(A, C, 0.5), M, 0.32)
      const e2 = lerp(lerp(B, C, 0.5), M, 0.32)

      const r = Math.min(48, w * 0.04)
      const edge = `L${f(A[0])} ${f(A[1])} Q${f(crease[0])} ${f(crease[1])} ${f(B[0])} ${f(B[1])} L${f(r)} ${h} Q0 ${h} 0 ${f(h - r)}`
      page.style.clipPath = `path('M0 0 L${w} 0 ${edge} Z')`

      // the page's own shadow: the same outline under its bottom strip
      const top = h - full - 60
      shadowSvg.current!.setAttribute('viewBox', `0 ${f(top)} ${w} ${f(full + 60)}`)
      shadowSvg.current!.style.height = `${full + 60}px`
      shadow.current!.setAttribute('d', `M0 ${f(top)} L${w} ${f(top)} ${edge} Z`)

      // the flap, over the page
      flapSvg.current!.setAttribute('viewBox', `0 ${f(top)} ${w} ${f(full + 60)}`)
      flapSvg.current!.style.height = `${full + 60}px`
      flap.current!.setAttribute(
        'd',
        `M${f(A[0])} ${f(A[1])} Q${f(e1[0])} ${f(e1[1])} ${f(C[0])} ${f(C[1])} Q${f(e2[0])} ${f(e2[1])} ${f(B[0])} ${f(B[1])} Q${f(crease[0])} ${f(crease[1])} ${f(A[0])} ${f(A[1])} Z`,
      )
      // shaded from the crease (in shadow) to the tip (catching the light)
      const g = shine.current!
      g.setAttribute('x1', f(M[0]))
      g.setAttribute('y1', f(M[1]))
      g.setAttribute('x2', f(C[0]))
      g.setAttribute('y2', f(C[1]))
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
        <path ref={shadow} fill="#fff" />
      </svg>
      <svg ref={flapSvg} className="curl__flap" preserveAspectRatio="none">
        <defs>
          <linearGradient id="curl-shine" ref={shine} gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#d6d3d1" />
            <stop offset="0.35" stopColor="#efedeb" />
            <stop offset="0.8" stopColor="#fbfaf9" />
            <stop offset="1" stopColor="#ffffff" />
          </linearGradient>
        </defs>
        <path ref={flap} fill="url(#curl-shine)" />
      </svg>
    </div>
  )
}
