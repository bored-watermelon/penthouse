import { parseTileName, projectSlug, type TileMeta } from './lib/parse'
import { caseStudies } from './lib/caseStudy'

// Everything in the work and play grids comes from the control center folder (see "control center/README.txt"):
//
//   control center/<section>/<file>            a piece of media on its own: it opens in the middle of the screen
//   control center/<section>/<folder>/         a case study, if there's a .md in it: the .md is the write-up, the
//                                              one picture or clip beside it is the tile's thumbnail, and media/
//                                              holds the rest
//                                              otherwise, a piece of media on a background of its own: "bg.*" (a
//                                              picture or a clip) fills the tile, and the other file sits on it
//
// A tile's logos, heading, subtitle, background and tags come from the name of its media file (lib/parse.ts).
// Anything whose name starts with "_" is left out, and a leading "NN_" sets the order. Dropping a file in is all it
// takes; there's nothing to keep in sync.

// Pictures are resized and turned into WebP at build time, so the big originals are fine to keep in the folders:
// a grid-sized copy, with its size so the grid never reflows as they arrive, and a large one for the viewer.
// GIFs, SVGs and videos are served as they are.
type Meta = { src: string; width: number; height: number }
const looseThumbs = import.meta.glob(['../control center/*/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,avif}', '!../control center/*/_*', '!../control center/_*/**', '!../control center/about box/**'], {
  query: { w: 1000, format: 'webp', quality: 80, as: 'metadata' },
  import: 'default',
  eager: true,
}) as Record<string, Meta>
const looseFull = import.meta.glob(['../control center/*/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,avif}', '!../control center/*/_*', '!../control center/_*/**', '!../control center/about box/**'], {
  query: { w: 2200, format: 'webp', quality: 84 },
  import: 'default',
  eager: true,
}) as Record<string, string>
const looseRaw = import.meta.glob(['../control center/*/*.{gif,GIF,svg,SVG,mp4,MP4,webm,WEBM,mov,MOV}', '!../control center/*/_*', '!../control center/_*/**', '!../control center/about box/**'], {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>
// a case study's thumbnail: the picture or clip sitting right in its folder (not in media/)
const caseThumbs = import.meta.glob(['../control center/*/*/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp,avif}', '!../control center/*/_*/**', '!../control center/_*/**', '!../control center/about box/**'], {
  query: { w: 1800, format: 'webp', quality: 82, as: 'metadata' },
  import: 'default',
  eager: true,
}) as Record<string, Meta>
const caseRaw = import.meta.glob(['../control center/*/*/*.{gif,GIF,svg,SVG,mp4,MP4,webm,WEBM,mov,MOV}', '!../control center/*/_*/**', '!../control center/_*/**', '!../control center/about box/**'], {
  query: '?url',
  import: 'default',
  eager: true,
}) as Record<string, string>
// every write-up, drafts included, only to know which folders are case studies (lib/caseStudy.ts builds them)
const caseDocs = Object.keys(import.meta.glob(['../control center/*/*/*.md', '!../control center/*/_*/**', '!../control center/_*/**', '!../control center/about box/**'], { query: '?raw' }))

const parts = (path: string) => path.split('/control center/')[1]!.split('/') // [section, file] or [section, folder, file]
const stem = (name: string) => name.replace(/\.[^.]+$/, '')
const isVideo = (name: string) => /\.(mp4|webm|mov)$/i.test(name)
const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

export type Media = { src: string; thumb?: string; width?: number; height?: number; video: boolean }

export type Tile = TileMeta & {
  id: string
  section: string // the control center folder it's in: "work", "play"…
  kind: 'case' | 'media'
  media?: Media
  slug?: string // a case study's page, /case-studies/<slug>
  written?: boolean // a case study whose write-up is ready (a "_….md" is a draft)
  backdrop?: Media // a media folder's "bg.*", filling the tile behind the media
}

const tiles: Tile[] = []

// ----- loose media -----
for (const path of [...Object.keys(looseFull), ...Object.keys(looseRaw)].sort(byName)) {
  const [section, file] = parts(path)
  const t = looseThumbs[path]
  tiles.push({
    id: `${section}/${file}`,
    section,
    kind: 'media',
    ...parseTileName(stem(file)),
    media: { src: looseFull[path] ?? looseRaw[path], thumb: t?.src, width: t?.width, height: t?.height, video: isVideo(file) },
  })
}

// ----- folders: case studies, and media on a background -----
const folders = new Map<string, { section: string; folder: string }>()
for (const path of [...caseDocs, ...Object.keys(caseThumbs), ...Object.keys(caseRaw)]) {
  const [section, folder] = parts(path)
  folders.set(`${section}/${folder}`, { section, folder })
}
const studies = new Set(caseDocs.map((p) => parts(p).slice(0, 2).join('/')))

/** The pictures and clips sitting right in a folder, in name order. */
function filesIn(key: string): { file: string; media: Media }[] {
  const inFolder = (files: Record<string, unknown>) => Object.keys(files).filter((p) => parts(p).slice(0, 2).join('/') === key)
  return [
    ...inFolder(caseThumbs).map((p) => {
      const m = caseThumbs[p]
      return { file: parts(p)[2], media: { src: m.src, thumb: m.src, width: m.width, height: m.height, video: false } }
    }),
    ...inFolder(caseRaw).map((p) => ({ file: parts(p)[2], media: { src: caseRaw[p], video: isVideo(p) } })),
  ].sort((a, b) => byName(a.file, b.file))
}
const isBackdrop = (file: string) => /^(bg|background)$/i.test(stem(file).trim())

for (const [key, { section }] of folders) {
  if (studies.has(key)) continue
  // a media folder: the "bg" file behind, and the other one on it, which names the tile like a loose file does
  const files = filesIn(key)
  const back = files.find((f) => isBackdrop(f.file))
  const piece = files.find((f) => !isBackdrop(f.file)) ?? back
  if (!piece) continue
  const meta = parseTileName(stem(piece.file))
  tiles.push({
    id: key,
    section,
    kind: 'media',
    ...meta,
    // on a background, the media sits inside the tile unless its name says Edge
    edge: back && piece !== back && !/(^|[;_])\s*(edge|bleed)\b/i.test(stem(piece.file)) ? false : meta.edge,
    media: piece.media,
    backdrop: piece !== back ? back?.media : undefined,
  })
  if (!back) console.warn(`[control center] "${key}" has no .md (so it isn't a case study) and no bg.* (so nothing to put behind its media)`)
}

for (const [key, { section, folder }] of folders) {
  if (!studies.has(key)) continue
  const slug = projectSlug(folder)
  const doc = caseStudies[slug]
  const thumb = filesIn(key)[0] // a case study's thumbnail: the one picture or clip beside its write-up
  if (!thumb) console.warn(`[control center] the case study "${key}" has no picture or clip for its tile`)
  const meta = parseTileName(thumb ? stem(thumb.file) : '')
  tiles.push({
    id: key,
    section,
    kind: 'case',
    ...meta,
    heading: meta.heading || doc?.title || '',
    media: thumb?.media,
    slug,
    written: !!doc,
  })
}

/** Each section's tiles, in folder-name order (case studies and media files alike). */
export const sections: Record<string, Tile[]> = {}
for (const t of tiles.sort((a, b) => byName(a.id, b.id))) (sections[t.section] ??= []).push(t)

// ----- what the rest of the site borrows -----

export type PlayItem = { id: string; src: string; thumb?: string; width?: number; height?: number; video: boolean; tags: string[]; caption: string }

/** The play section's media, in the shape the viewers and the sketchbook take. */
export const playItems: PlayItem[] = (sections.play ?? [])
  .filter((t) => t.kind === 'media' && t.media)
  .map((t) => ({ id: t.id, ...t.media!, tags: t.tags, caption: t.heading }))

/** The case studies with a finished write-up, in grid order (for "next case study"). */
export const writtenCases = Object.values(sections)
  .flat()
  .filter((t) => t.kind === 'case' && t.written)
