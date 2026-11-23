// The sketchbook in the about box: everything comes from "control center/about box/sketchbook" (see the README in
// "control center/about box").
//   photos/*     its pages, in file-name order. A tall or square one gets a page to itself, a wide one a whole
//                spread. Anything after " - " in the name is written under it: "07 - a cafe in kochi.jpg".
//                Until there's anything in here, the book borrows the Art pictures from /play.
//   stickers/*   the stickers on the cover: cut-outs, as PNGs with a see-through background or SVGs. Sized like the
//                things in the box, "heart (3cm).png", against a cover 9.5cm across; otherwise 2.8cm. And scaled
//                like them too, "heart (scale 120).png", in percent, on top of that.
//   cover.*      optional: a picture to use as the cover, instead of the plain black one

import { playItems } from '../content'

type Meta = { src: string; width: number; height: number }

/** A pocket hardback, in cm. The cover's a touch bigger than the pages, at the top, bottom and outside edge. */
export const PAGE = { w: 9, h: 12.6 }
export const COVER = { w: 9.5, h: 13 }

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })
const stem = (path: string) => path.split('/').pop()!.replace(/\.[^.]+$/, '')

// ----- the drawings -----

export type Drawing = { id: string; src: string; width: number; height: number; caption: string; wide: boolean }

const WIDE = 1.05 // a drawing this much wider than it's tall takes a whole spread

const drawingFiles = import.meta.glob('../../control center/about box/sketchbook/photos/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', {
  query: { w: 1600, format: 'webp', quality: 86, as: 'metadata' },
  import: 'default',
  eager: true,
}) as Record<string, Meta>

const own: Drawing[] = Object.keys(drawingFiles)
  .sort(byName)
  .map((path) => {
    const m = drawingFiles[path]
    const name = stem(path)
    const at = name.indexOf(' - ')
    return { id: name, src: m.src, width: m.width, height: m.height, caption: at >= 0 ? name.slice(at + 3).trim() : '', wide: m.width / m.height > WIDE }
  })

// stand-ins until there are drawings of my own in the folder: the Art pictures from /play, with their captions
// (bar the ones that are only a number)
const borrowed: Drawing[] = playItems
  .filter((p) => !p.video && p.width && p.height && p.tags.some((t) => /^art$/i.test(t)))
  .map((p) => ({
    id: p.id,
    src: p.src,
    width: p.width!,
    height: p.height!,
    caption: /^[\d\s.-]*$/.test(p.caption) ? '' : p.caption,
    wide: p.width! / p.height! > WIDE,
  }))

export const drawings = own.length ? own : borrowed

// ----- the pages -----

export type Page =
  | { kind: 'art'; key: string; d: Drawing; half?: 'l' | 'r' } // half: which half of a drawing that spans the spread
  | { kind: 'inside' | 'end' | 'blank'; key: string } // the insides of the front and back covers, and a bare page

/**
 * The book as spreads, for a screen wide enough to show two pages: even entries are left-hand pages, odd ones
 * right-hand. It opens on the inside of the front cover, then the drawings, and ends on the inside of the back cover.
 */
export const spreadPages: Page[] = (() => {
  const out: Page[] = [{ kind: 'inside', key: 'inside' }]
  const queue = [...drawings]
  while (queue.length) {
    const d = queue[0]
    if (d.wide && out.length % 2) {
      // a wide one has to start on a left-hand page: this right-hand one gets the next drawing that fits on a page
      const k = queue.findIndex((x) => !x.wide)
      out.push(k >= 0 ? { kind: 'art', key: queue[k].id, d: queue.splice(k, 1)[0] } : { kind: 'blank', key: `blank-${out.length}` })
      continue
    }
    queue.shift()
    if (d.wide) out.push({ kind: 'art', key: `${d.id}:l`, d, half: 'l' }, { kind: 'art', key: `${d.id}:r`, d, half: 'r' })
    else out.push({ kind: 'art', key: d.id, d })
  }
  // the inside of the back cover is always a right-hand page: if the drawings end on one, the leaf's back is bare
  if (out.length % 2 === 0) out.push({ kind: 'blank', key: 'blank-last' })
  out.push({ kind: 'end', key: 'end' })
  return out
})()

/** The book a page at a time, for a phone: every drawing gets a page of its own, wide ones too. */
export const singlePages: Page[] = [{ kind: 'inside', key: 'inside' }, ...drawings.map((d): Page => ({ kind: 'art', key: d.id, d })), { kind: 'end', key: 'end' }]

// ----- the cover -----

const coverFiles = import.meta.glob('../../control center/about box/sketchbook/cover.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', {
  query: { w: 1200, format: 'webp', quality: 86 },
  import: 'default',
  eager: true,
}) as Record<string, string>
export const coverArt = Object.values(coverFiles)[0] as string | undefined

// ----- the stickers -----

const stickerPng = import.meta.glob('../../control center/about box/sketchbook/stickers/*.{png,PNG,webp}', {
  query: { w: 600, format: 'webp', quality: 90, as: 'metadata' },
  import: 'default',
  eager: true,
}) as Record<string, Meta>
const stickerSvg = import.meta.glob('../../control center/about box/sketchbook/stickers/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const stickerSvgText = import.meta.glob('../../control center/about box/sketchbook/stickers/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** An SVG's shape, from its viewBox (or width and height). */
function svgSize(text: string) {
  const box = text.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i)
  if (box) return { width: +box[1], height: +box[2] }
  const w = text.match(/\bwidth\s*=\s*["']([\d.]+)/i)
  const h = text.match(/\bheight\s*=\s*["']([\d.]+)/i)
  return { width: w ? +w[1] : 1, height: h ? +h[1] : 1 }
}

export type Sticker = { id: string; src: string; width: number; height: number; cm: number }

const STICKER_CM = 2.8
/** "(scale 120)": a fifth bigger, in percent, as for the things in the box (lib/about.ts) */
const SCALE_RE = /\(\s*scale\s*[-:]?\s*([\d.]+)\s*\)/i

export const stickers: Sticker[] = [
  ...Object.entries(stickerPng).map(([path, m]) => ({ path, src: m.src, width: m.width, height: m.height })),
  ...Object.entries(stickerSvg).map(([path, src]) => ({ path, src, ...svgSize(stickerSvgText[path] ?? '') })),
]
  .sort((a, b) => byName(a.path, b.path))
  .map(({ path, ...s }) => {
    const name = stem(path)
    const given = name.match(/\(\s*([\d.]+)\s*cm\s*\)/i)
    const scaled = name.match(SCALE_RE)
    const id = name.replace(/\s*\([^)]*cm\s*\)/i, '').replace(SCALE_RE, '').replace(/\s+/g, ' ').trim()
    return { ...s, id, cm: (given ? +given[1] : STICKER_CM) * (scaled ? +scaled[1] / 100 : 1) }
  })

/** A sticker's size on the cover, in cm: its longer side is the size it was given. */
export const stickerCm = (s: Sticker) => (s.width >= s.height ? { w: s.cm, h: (s.cm * s.height) / s.width } : { w: (s.cm * s.width) / s.height, h: s.cm })

/** Where a sticker sits: its middle, as fractions of the cover, its tilt in degrees, and what's stuck over what. */
export type Spot = { x: number; y: number; r: number; z: number }

/** The nearest place to (x, y) for a sticker's middle that keeps all of it on the cover. */
export function keepOn(s: Sticker, x: number, y: number, r: number) {
  const { w, h } = stickerCm(s)
  const a = (r * Math.PI) / 180
  const halfW = (w * Math.abs(Math.cos(a)) + h * Math.abs(Math.sin(a))) / 2 / COVER.w
  const halfH = (w * Math.abs(Math.sin(a)) + h * Math.abs(Math.cos(a))) / 2 / COVER.h
  const fit = (v: number, half: number) => (half >= 0.5 ? 0.5 : Math.min(1 - half, Math.max(half, v)))
  return { x: fit(x, halfW), y: fit(y, halfH) }
}

// where they're first stuck, in file-name order: spread over the cover, each at its own slant
const SLOTS = [
  { x: 0.33, y: 0.18, r: -9 },
  { x: 0.7, y: 0.31, r: 8 },
  { x: 0.38, y: 0.5, r: 5 },
  { x: 0.7, y: 0.68, r: -11 },
  { x: 0.34, y: 0.82, r: 12 },
  { x: 0.74, y: 0.11, r: -4 },
  { x: 0.6, y: 0.9, r: -6 },
  { x: 0.28, y: 0.35, r: 15 },
]
const wobble = (i: number, k: number) => {
  const v = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453
  return v - Math.floor(v)
}

// The cover's stickers can be peeled off and stuck back down somewhere else, both in the box and opened up, so
// where they are lives here, for both to follow.
let spots: Spot[] = stickers.map((s, i) => {
  const at = SLOTS[i] ?? { x: 0.25 + wobble(i, 1) * 0.5, y: 0.15 + wobble(i, 2) * 0.7, r: (wobble(i, 3) - 0.5) * 30 }
  return { ...keepOn(s, at.x, at.y, at.r), r: at.r, z: i }
})
const listeners = new Set<() => void>()

export const stickerSpots = {
  get: () => spots,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => void listeners.delete(fn)
  },
  /** Stick one down somewhere: it ends up on top of the others. */
  set(i: number, at: Pick<Spot, 'x' | 'y'>) {
    const top = Math.max(...spots.map((s) => s.z)) + 1
    spots = spots.map((s, j) => (j === i ? { ...s, ...at, z: top } : s))
    listeners.forEach((fn) => fn())
  },
}
