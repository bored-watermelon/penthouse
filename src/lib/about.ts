// The "about me" box: everything comes from /about, in the project root.
//   cardboard.*        the open box, seen from above (transparent around it)
//   reality.*          the picture in the heading
//   media/*            the things inside the box, one file each (pictures, or clips that play on their own, silent
//                      and looping); they open full size when clicked. A file name can
//                      carry its real size, "(6cm)", a scale on top of that, "(scale 120)" for 120%, and how round its
//                      corners are, "(radius 12)" (see below)
//   sketchbook/*       the sketchbook in the box: its drawings and the stickers on its cover (see lib/sketchbook.ts)

import { COVER, drawings } from './sketchbook'

type Meta = { src: string; width: number; height: number }
const one = (files: Record<string, string>) => Object.values(files)[0] as string | undefined

const boxFiles = import.meta.glob('../../about/cardboard.{png,webp}', { query: { w: 2200, format: 'webp', quality: 84 }, import: 'default', eager: true }) as Record<string, string>
const realityFiles = import.meta.glob('../../about/reality.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', { query: { w: 900, format: 'webp', quality: 84 }, import: 'default', eager: true }) as Record<string, string>

export const cardboard = one(boxFiles)
export const reality = one(realityFiles)

const thumbs = import.meta.glob('../../about/media/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', { query: { w: 700, format: 'webp', quality: 86, as: 'metadata' }, import: 'default', eager: true }) as Record<string, Meta>
const full = import.meta.glob('../../about/media/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', { query: { w: 2000, format: 'webp', quality: 88 }, import: 'default', eager: true }) as Record<string, string>
// clips, with their size read from the file at build time (the video-meta plugin in vite.config.ts), so they're laid
// out in the box before they've downloaded. MP4 plays everywhere; MOV only in Safari.
const clips = import.meta.glob('../../about/media/*.{mp4,MP4,mov,MOV}', { query: '?video-meta', import: 'default', eager: true }) as Record<string, Meta>

/**
 * Everything in the box is drawn at its real size, so a camera looks like a camera next to an iPod. Sizes are the
 * longer side of the picture (not just the object: a strap or earphones in the picture count), in centimetres,
 * against a box 46cm across. To size something new, put it in its file name, e.g. "ticket (6cm).png"; otherwise it
 * uses the list below, or 10cm.
 */
export const BOX_CM = 46
const REAL_CM: Record<string, number> = {
  camera: 11, // a Cyber-shot W is about 9cm wide; the strap adds the rest
  ipod: 8.5, // a 3rd-gen nano is 7cm tall; the earphone loop hangs below
}
const DEFAULT_CM = 10

/**
 * A thing's corners can be rounded from its file name too: "Polaroid1 (radius 12).png" ("(r 12)" and "(radius 12px)"
 * work as well). The number is in pixels at the box's full size (1100px across); the corners shrink with the box, so
 * a thing keeps its shape on a phone. Without it the corners are as the picture has them.
 */
/**
 * And its scale, in percent: "camera (scale 120).png" draws it a fifth bigger than its real size, "(scale 80)"
 * smaller; 100 is as it is. (No "%" sign: the build tools read a % in a file name as the start of a URL escape.)
 */
const SCALE_RE = /\(\s*scale\s*[-:]?\s*([\d.]+)\s*\)/i

const RADIUS_RE = /\(\s*r(?:adius)?\s*[-:]?\s*([\d.]+)\s*(?:px)?\s*\)/i
export const BOX_PX = 1100 // the box's longer side at full size, which radii are given against

export type Artifact = { id: string; thumb: string; src: string; width: number; height: number; cm: number; radius?: number; video?: boolean }

/** The sketchbook isn't a picture: it's drawn, stickers and all (see Sketchbook.tsx), so it's in the box by name. */
export const SKETCHBOOK = 'sketchbook'

/** Everything in the box, in file-name order, and the sketchbook on top (if there's anything to put in it). */
export const artifacts: Artifact[] = [
  ...[...Object.keys(thumbs), ...Object.keys(clips)]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((path) => {
      const clip = clips[path]
      const t = clip ?? thumbs[path]
      const name = path.split('/').pop()!.replace(/\.[^.]+$/, '')
      const given = name.match(/\(\s*([\d.]+)\s*cm\s*\)/i)
      const round = name.match(RADIUS_RE)
      const scaled = name.match(SCALE_RE)
      const scale = scaled ? +scaled[1] / 100 : 1
      const id = name.replace(/\s*\([^)]*cm\s*\)/i, '').replace(RADIUS_RE, '').replace(SCALE_RE, '').replace(/\s+/g, ' ').trim()
      return {
        id,
        thumb: t.src,
        src: clip ? clip.src : full[path],
        width: t.width,
        height: t.height,
        cm: (given ? +given[1] : (REAL_CM[id.toLowerCase()] ?? DEFAULT_CM)) * scale,
        radius: round ? +round[1] : undefined,
        video: !!clip,
      }
    }),
  ...(drawings.length ? [{ id: SKETCHBOOK, thumb: '', src: '', width: COVER.w * 100, height: COVER.h * 100, cm: COVER.h }] : []),
]

// ----- what a thing in the box opens into, when it's more than a picture: its contents are in the control center
// ("control center/about box", see the README there); its own look is in /about/opened assets -----

const cameraPhotoFiles = import.meta.glob('../../control center/about box/camera photos/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', { query: { w: 1400, format: 'webp', quality: 82 }, import: 'default', eager: true }) as Record<string, string>
const cameraThumbFiles = import.meta.glob('../../control center/about box/camera photos/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', { query: { w: 320, format: 'webp', quality: 70 }, import: 'default', eager: true }) as Record<string, string>
// the arrow button art (used by the paper doll's outfit switcher, Collage.tsx)
const cameraButtonFiles = import.meta.glob('../../about/opened assets/camera buttons/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const buttonByName = (name: string) => Object.entries(cameraButtonFiles).find(([p]) => p.split('/').pop()!.toLowerCase().startsWith(name))?.[1]

/**
 * When a photo was taken, from its file name, where phones write it: IMG-20221017-WA0002, IMG20251020183650,
 * PXL_20251129_164755494. Undefined when the name doesn't say.
 */
function takenFrom(name: string) {
  const m = name.match(/(20\d\d)[-_]?(\d\d)[-_]?(\d\d)(?:[-_]?(\d\d)(\d\d)(\d\d))?/)
  if (!m || +m[2] < 1 || +m[2] > 12 || +m[3] < 1 || +m[3] > 31) return undefined
  const timed = m[4] !== undefined && +m[4] < 24 && +m[5] < 60
  return { taken: new Date(+m[1], +m[2] - 1, +m[3], timed ? +m[4] : 12, timed ? +m[5] : 0), timed }
}

export type CameraPhoto = { src: string; thumb: string; taken?: Date; timed?: boolean } // timed: the name said the time of day too

/**
 * The camera, opened (CameraViewer.tsx): every photo in "control center/about box/camera photos", in the order it
 * was taken, the way a camera keeps them (those whose names don't say when go last, in file-name order).
 */
export const camera = {
  photos: Object.keys(cameraPhotoFiles)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((p): CameraPhoto => ({ src: cameraPhotoFiles[p], thumb: cameraThumbFiles[p], ...takenFrom(p.split('/').pop()!) }))
    .sort((a, b) => (a.taken && b.taken ? +a.taken - +b.taken : a.taken ? -1 : b.taken ? 1 : 0)),
  buttons: { normal: buttonByName('default'), hover: buttonByName('hover'), pressed: buttonByName('pressed'), disabled: buttonByName('disabled') },
}

// ----- the iPod: every song in "control center/about box/songs", named "Song-[Title]; Artist Name-[Artist]" -----

const songFiles = import.meta.glob('../../control center/about box/songs/*.{mp3,MP3,m4a,M4A,aac,AAC,wav,WAV,ogg,OGG,oga,flac,FLAC,opus}', { query: '?url', import: 'default', eager: true }) as Record<string, string>

export type Song = { id: string; title: string; artist: string; src: string }

/**
 * File names are written "Song-[Song Name]; Artist Name-[Artist Name]", the same bracketed shape the /play
 * files use. Either field can be left out, and the order doesn't matter. A name that doesn't use the brackets
 * at all falls back to the older "Song Name - Artist Name" (a – or — works too, and so does "… by …").
 */
function readSongName(name: string) {
  const field = (key: string) => name.match(new RegExp(`${key}\\s*-\\s*\\[([^\\]]*)\\]`, 'i'))?.[1].trim()
  const title = field('Song')
  const artist = field('Artist(?:\\s*Name)?')
  if (title || artist) return { title: title || name.trim(), artist: artist || 'Unknown Artist' }

  // split at the last dash (titles can have dashes of their own); "by" only when there's no dash at all
  const m = name.match(/^(.*\S)\s+[-–—]\s+(\S.*)$/) ?? name.match(/^(.*\S)\s+by\s+(\S.*)$/i)
  return m ? { title: m[1].trim(), artist: m[2].trim() } : { title: name.trim(), artist: 'Unknown Artist' }
}

/** Every song, A to Z by title, the way an iPod's "All Songs" lists them. */
export const songs: Song[] = Object.keys(songFiles)
  .map((path) => {
    const id = path.split('/').pop()!.replace(/\.[^.]+$/, '')
    return { id, ...readSongName(id), src: songFiles[path] }
  })
  .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }))
