import './fonts'

const stem = (path: string) => path.split('/').pop()!.replace(/\.[^.]+$/, '')

const stickerFiles = import.meta.glob('../../media/footer elements/*.{png,PNG,webp}', { query: { w: 700, format: 'webp', quality: 86 }, import: 'default', eager: true }) as Record<string, string>
const logoFiles = import.meta.glob('../../media/social media logos/*.{png,PNG,webp,svg}', { query: { w: 256, format: 'webp', quality: 90 }, import: 'default', eager: true }) as Record<string, string>
const videoFiles = import.meta.glob('../../media/backgrounds/footer video*.{mp4,webm}', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const catFiles = import.meta.glob('../../media/backgrounds/footer cat*.{png,webp}', { query: { w: 900, format: 'webp', quality: 88 }, import: 'default', eager: true }) as Record<string, string>

export const footerVideo = Object.values(videoFiles)[0]
export const footerCat = Object.values(catFiles)[0]

/** Social links. The logo is whichever file in /media/social media logos has this name. */
const SOCIAL: { name: string; label: string; href: string }[] = [
  { name: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/bored._.melon' },
  { name: 'twitter', label: 'X', href: 'https://x.com/snehaxdesign' },
  { name: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/in/sneha-jain-02' },
  { name: 'goodreads', label: 'Goodreads', href: 'https://www.goodreads.com/user/show/158208044-sneha-jain' },
]
const logoByName = new Map(Object.entries(logoFiles).map(([p, url]) => [stem(p).toLowerCase(), url]))
export const socials = SOCIAL.flatMap((s) => {
  const src = logoByName.get(s.name) ?? logoByName.get(s.label.toLowerCase())
  return src ? [{ ...s, src, round: s.name === 'goodreads' }] : []
})

/** A footer sticker, looked up by the start of its file name in /media/footer elements. */
const stickerByName = Object.entries(stickerFiles).map(([p, url]) => [stem(p).toLowerCase(), url] as const)
export const sticker = (name: string) => stickerByName.find(([n]) => n.startsWith(name.toLowerCase()))?.[1]

/** The hand-drawn bits from the Figma footer (heart, bolt, pencil) and the text-selection handle. */
const doodleFiles = import.meta.glob('../../media/footer doodles/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>
export const doodle = Object.fromEntries(Object.entries(doodleFiles).map(([p, url]) => [stem(p), url])) as Record<string, string>
