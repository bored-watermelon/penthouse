// Folding a flat thing over a straight crease: the sketchbook's pages as they turn, and its stickers as they peel.
// The crease is a line through `m` with unit normal `n`; whatever lies on the +n side is what folds over.

export type Pt = { x: number; y: number }

export const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
]

/** The part of a convex polygon on one side of the crease: `side` 1 is the +n side (what folds), -1 the rest. */
export function cut(poly: Pt[], m: Pt, n: Pt, side: 1 | -1): Pt[] {
  const d = (p: Pt) => side * ((p.x - m.x) * n.x + (p.y - m.y) * n.y)
  const out: Pt[] = []
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]
    const b = poly[(i + 1) % poly.length]
    const da = d(a)
    const db = d(b)
    if (da >= 0) out.push(a)
    if (da >= 0 !== db >= 0) {
      const t = da / (da - db)
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return out
}

/** Where a point lands when folded over the crease. */
export function reflect(p: Pt, m: Pt, n: Pt): Pt {
  const k = 2 * ((p.x - m.x) * n.x + (p.y - m.y) * n.y)
  return { x: p.x - k * n.x, y: p.y - k * n.y }
}

/** The fold as a CSS transform (with transform-origin 0 0): what an element looks like folded over the crease. */
export function reflectCss(m: Pt, n: Pt) {
  const k = 2 * (m.x * n.x + m.y * n.y)
  return `matrix(${1 - 2 * n.x * n.x}, ${-2 * n.x * n.y}, ${-2 * n.x * n.y}, ${1 - 2 * n.y * n.y}, ${k * n.x}, ${k * n.y})`
}

/** A polygon as a CSS clip-path, in px from (ox, oy); an empty one hides everything. */
export const clip = (poly: Pt[], ox = 0, oy = 0) =>
  poly.length < 3 ? 'polygon(0 0, 0 0, 0 0)' : `polygon(${poly.map((p) => `${(p.x - ox).toFixed(2)}px ${(p.y - oy).toFixed(2)}px`).join(', ')})`

/** A polygon as an SVG path. */
export const path = (poly: Pt[]) => (poly.length < 3 ? '' : `M${poly.map((p) => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('L')}Z`)
