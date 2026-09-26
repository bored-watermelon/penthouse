// The "about me" box: everything comes from /about, in the project root.
//   cardboard.*        the open box, seen from above (transparent around it)
//   reality.*          the picture in the heading
//   media/*            the things inside the box, one file each; they open full size when clicked

type Meta = { src: string; width: number; height: number }
const one = (files: Record<string, string>) => Object.values(files)[0] as string | undefined

const boxFiles = import.meta.glob('../../about/cardboard.{png,webp}', { query: { w: 2200, format: 'webp', quality: 84 }, import: 'default', eager: true }) as Record<string, string>
const realityFiles = import.meta.glob('../../about/reality.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', { query: { w: 900, format: 'webp', quality: 84 }, import: 'default', eager: true }) as Record<string, string>

export const cardboard = one(boxFiles)
export const reality = one(realityFiles)

const thumbs = import.meta.glob('../../about/media/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', { query: { w: 700, format: 'webp', quality: 86, as: 'metadata' }, import: 'default', eager: true }) as Record<string, Meta>
const full = import.meta.glob('../../about/media/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', { query: { w: 2000, format: 'webp', quality: 88 }, import: 'default', eager: true }) as Record<string, string>

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

export type Artifact = { id: string; thumb: string; src: string; width: number; height: number; cm: number }

/** Everything in the box, in file-name order. */
export const artifacts: Artifact[] = Object.keys(thumbs)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .map((path) => {
    const t = thumbs[path]
    const name = path.split('/').pop()!.replace(/\.[^.]+$/, '')
    const given = name.match(/\(\s*([\d.]+)\s*cm\s*\)/i)
    const id = name.replace(/\s*\([^)]*cm\s*\)/i, '').trim()
    return { id, thumb: t.src, src: full[path], width: t.width, height: t.height, cm: given ? +given[1] : (REAL_CM[id.toLowerCase()] ?? DEFAULT_CM) }
  })

// ----- /about/opened assets: what a thing in the box opens into, when it's more than a picture -----

const openCameraFiles = import.meta.glob('../../about/opened assets/opened camera.png', { query: { w: 2000, format: 'webp', quality: 88 }, import: 'default', eager: true }) as Record<string, string>
const cameraPhotoFiles = import.meta.glob('../../about/opened assets/camera photos/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', { query: { w: 1400, format: 'webp', quality: 82 }, import: 'default', eager: true }) as Record<string, string>
const cameraButtonFiles = import.meta.glob('../../about/opened assets/camera buttons/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const buttonByName = (name: string) => Object.entries(cameraButtonFiles).find(([p]) => p.split('/').pop()!.toLowerCase().startsWith(name))?.[1]

/**
 * The camera, opened: the back of the camera (its screen is a see-through hole the photos show through), every
 * photo in "camera photos" in file-name order, and the arrow button in each of its states. The art points right;
 * the left button is the same art mirrored.
 */
export const camera = {
  body: one(openCameraFiles),
  // the screen hole in "opened camera.png", as fractions of the picture
  screen: { l: 0.1102, t: 0.2809, r: 0.5604, b: 0.7733 },
  // where the arrow buttons sit, on the left and right of the direction pad (centres, as fractions of the picture)
  pad: { prev: { x: 0.6987, y: 0.5313 }, next: { x: 0.8617, y: 0.5313 } },
  photos: Object.keys(cameraPhotoFiles)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((p) => cameraPhotoFiles[p]),
  buttons: { normal: buttonByName('default'), hover: buttonByName('hover'), pressed: buttonByName('pressed'), disabled: buttonByName('disabled') },
}

// ----- the iPod: every song in "opened assets/songs", named "Song Name - Artist Name" -----

const songFiles = import.meta.glob('../../about/opened assets/songs/*.{mp3,MP3,m4a,M4A,aac,AAC,wav,WAV,ogg,OGG,oga,flac,FLAC,opus}', { query: '?url', import: 'default', eager: true }) as Record<string, string>

export type Song = { id: string; title: string; artist: string; src: string }

/** "Song Name - Artist Name" (a – or — works too, and so does "Song Name by Artist"); anything else is just a title. */
function readSongName(name: string) {
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
