// The life timeline: everything comes from /timeline, in the project root. One folder per chunk of time:
//   timeline/2019-2023/details.txt   "Heading : College" and "Caption : …". A heading in brackets, like
//                                    "[Juspay.svg]", is a logo from /logos instead of text.
//   timeline/2019-2023/media/*       pictures and videos, shown in blobs while that chunk is hovered
// "Present" as the end of a folder name means this year.
import type { PlayItem } from '../content'
import { findLogo } from './logos'

type Meta = { src: string; width: number; height: number }

const details = import.meta.glob('../../timeline/*/details.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
const thumbs = import.meta.glob('../../timeline/*/media/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', { query: { w: 640, format: 'webp', quality: 82, as: 'metadata' }, import: 'default', eager: true }) as Record<string, Meta>
const full = import.meta.glob('../../timeline/*/media/*.{png,PNG,jpg,JPG,jpeg,JPEG,webp}', { query: { w: 2000, format: 'webp', quality: 86 }, import: 'default', eager: true }) as Record<string, string>
const clips = import.meta.glob('../../timeline/*/media/*.{mp4,MP4,webm,mov,MOV}', { query: '?url', import: 'default', eager: true }) as Record<string, string>

export type Chunk = {
  id: string // the folder name
  from: number
  to: number
  heading: { text: string } | { logo: string; name: string }
  caption: string
  media: PlayItem[]
}

export const NOW = new Date().getFullYear()

const folderOf = (path: string) => path.split('/timeline/')[1].split('/')[0]

/** "Heading : …" / "Caption : …"; a line without a key carries on the one before it. */
function parse(txt: string) {
  const out: Record<string, string> = {}
  let key = ''
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*(heading|caption)\s*:\s*(.*)$/i)
    if (m) out[(key = m[1].toLowerCase())] = m[2].trim()
    else if (key && line.trim()) out[key] += ' ' + line.trim()
  }
  return out
}

function headingOf(raw = '') {
  const logo = raw.match(/^\[(.+)\]$/)
  if (logo) {
    const name = logo[1].replace(/\.\w+$/, '')
    const found = findLogo(name)
    if (found) return { logo: found.src, name }
    return { text: name } // no such file in /logos: show its name rather than nothing
  }
  return { text: raw }
}

function mediaOf(folder: string): PlayItem[] {
  const inFolder = (paths: string[]) => paths.filter((p) => folderOf(p) === folder)
  const pics = inFolder(Object.keys(thumbs)).map((p) => ({ path: p, src: full[p], thumb: thumbs[p].src, width: thumbs[p].width, height: thumbs[p].height, video: false }))
  const vids = inFolder(Object.keys(clips)).map((p) => ({ path: p, src: clips[p], video: true }))
  return [...pics, ...vids]
    .sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true }))
    .map(({ path, ...m }) => ({ id: path.split('/').pop()!, tags: [], caption: '', ...m }))
}

export const chunks: Chunk[] = Object.keys(details)
  .map((path) => {
    const id = folderOf(path)
    const [a, b] = id.split(/\s*[-–]\s*/)
    const d = parse(details[path])
    return {
      id,
      from: parseInt(a, 10),
      to: /present|now/i.test(b ?? '') ? NOW : parseInt(b ?? a, 10),
      heading: headingOf(d.heading),
      caption: d.caption ?? '',
      media: mediaOf(id),
    }
  })
  .filter((c) => !Number.isNaN(c.from))
  .sort((a, b) => a.from - b.from)
