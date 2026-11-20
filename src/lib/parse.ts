// How a tile in the control center describes itself: through the name of its media file (see
// "control center/README.txt"). For example
//
//   01_Logo-[Juspay, Visa];Heading-[Designing an Interactive Kiosk];Subtitle-[A demo kiosk for VPF];Bg-[fde7d4];Tag-[kiosk].png
//
// is a tile with the Juspay and Visa logos, that heading and subtitle, a peach background and a "kiosk" chip,
// placed first. Add "Edge-[no]" to sit the media inside the tile on its background instead of filling the tile's
// width ("Edge-[20, 8]" sets that margin: 20% of the tile's width left and right, 8% top and bottom), and
// "Shadow-[yes]" for a soft shadow under it, and "Radius-[16]" to round its corners by that many pixels. Every part is optional and they can come in any order,
// separated by ";". "Key-[value]", "Key-value" and "Key: value" all read the same, and a yes/no key on its own
// ("Shadow") means yes. The older play names ("Tags-[Art];Text-caption") still work:
// Tags is Tag, and Text is Heading.

export type TileMeta = {
  logos: string[] // names of files in /logos (Juspay, Visa, Thomas Cook…)
  heading: string
  subtitle: string
  bg?: string // a CSS colour for the tile's background
  tags: string[] // the chip on the tile, and the filters above the grid
  edge: boolean // the media fills the tile's width (the default), or sits inside it on the background
  inset?: { x: number; y?: number } // that margin, in % of the tile's width: left and right, and top and bottom
  shadow: boolean // a soft shadow under the media
  radius?: number // how round the media's corners are, in px (an edge-to-edge tile's own corners)
}

const FIELDS: Record<string, keyof TileMeta> = {
  logo: 'logos',
  logos: 'logos',
  client: 'logos',
  clients: 'logos',
  heading: 'heading',
  title: 'heading',
  text: 'heading',
  subtitle: 'subtitle',
  sub: 'subtitle',
  description: 'subtitle',
  bg: 'bg',
  background: 'bg',
  tag: 'tags',
  tags: 'tags',
  edge: 'edge',
  bleed: 'edge',
  shadow: 'shadow',
  radius: 'radius',
  corner: 'radius',
  corners: 'radius',
}

const yes = (v: string) => !/^(no|false|0|off|none)$/i.test(v.trim())
const list = (v: string) => v.split(',').map((s) => s.trim()).filter(Boolean)
const unquote = (v: string) => v.replace(/^["“”']\s*/, '').replace(/\s*["“”']$/, '').trim()

/**
 * A file name can't hold a "#", so a hex colour is written without it ("fde7d4", "fff"). Anything else the
 * browser knows as a colour works as it is: "lavender", "rgb(250 240 230)".
 */
function colour(v: string) {
  if (/^[0-9a-f]{3}([0-9a-f]{3}([0-9a-f]{2})?)?$/i.test(v)) return `#${v}`
  if (typeof CSS !== 'undefined' && CSS.supports('color', v)) return v
  if (v) console.warn(`[control center] "${v}" isn't a colour, so that tile keeps the default background`)
  return undefined
}

/** The leading "NN_" on a file or folder only sets its place in the grid. */
export const withoutOrder = (name: string) => name.replace(/^\s*\d+_\s*/, '')

/** Reads a tile's details from its file name (without the extension). A name with no keys at all is its heading. */
export function parseTileName(name: string): TileMeta {
  const rest = withoutOrder(name)
  const out: TileMeta = { logos: [], heading: '', subtitle: '', tags: [], edge: true, shadow: false }
  let found = false
  for (const part of rest.split(';')) {
    const m = part.match(/^\s*([a-z]+)\s*(?:[-:]\s*(.*?))?\s*$/i)
    const key = m && FIELDS[m[1].toLowerCase()]
    // a bare word that isn't a yes/no key ("Logo", or a one-word name like "Background") says nothing
    if (!key || (m![2] === undefined && key !== 'edge' && key !== 'shadow')) continue
    found = true
    // "[a, b]" or "[a],[b]" or a bare value
    const raw = m![2] ?? ''
    const bracketed = [...raw.matchAll(/\[([^\]]*)\]/g)].map((x) => x[1])
    const value = (bracketed.length ? bracketed.join(', ') : raw).trim()
    if (key === 'edge') {
      // numbers are the margin around inset media: "20" for the sides, "20, 8" for the sides and top and bottom
      const nums = value.match(/\d+(\.\d+)?/g)
      if (nums) out.inset = { x: +nums[0], y: nums[1] === undefined ? undefined : +nums[1] }
      out.edge = nums ? false : yes(value)
    } else if (key === 'shadow') out.shadow = yes(value)
    else if (key === 'radius') {
      const n = value.match(/\d+(\.\d+)?/)
      if (n) out.radius = +n[0]
    }
    else if (key === 'logos' || key === 'tags') out[key] = list(value)
    else if (key === 'bg') out.bg = colour(value)
    else out[key as 'heading' | 'subtitle'] = unquote(value)
  }
  if (!found) out.heading = rest.trim()
  // a heading that's only a number ("Text-13") is a file kept apart, not something to show
  if (/^[\d\s.-]*$/.test(out.heading)) out.heading = ''
  return out
}

/**
 * A case study is a folder, e.g. "01_buyer support". The leading "NN_" only sets the display order, so the
 * slug — which is also the case study's URL — is the rest of the name: "buyer-support".
 */
export const projectSlug = (folder: string) =>
  withoutOrder(folder)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
