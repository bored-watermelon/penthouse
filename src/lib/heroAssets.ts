const stem = (path: string) => path.split('/').pop()!.replace(/\.[^.]+$/, '')

const files = import.meta.glob('../../media/hero elements/*.{png,PNG,jpg,jpeg,webp}', {
  query: { w: 900, format: 'webp', quality: 90 },
  import: 'default',
  eager: true,
}) as Record<string, string>

/** The cut-outs in /media/hero elements, by file name: me, basketball, art-attack. */
export const heroImage = Object.fromEntries(Object.entries(files).map(([p, url]) => [stem(p), url])) as Record<string, string>

// The line art is SVG, loaded as its own URL rather than converted to webp: the stars behind the selfie, and
// the little icons that sit in the text.
const svgFiles = import.meta.glob('../../media/hero elements/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const byName = (keep: (name: string) => boolean) =>
  Object.fromEntries(
    Object.entries(svgFiles)
      .map(([p, url]) => [stem(p), url] as const)
      .filter(([name]) => keep(name)),
  ) as Record<string, string>

/** The stars behind the selfie, by file name: star1 (red), star2 (gold). */
export const heroStar = byName((n) => n.startsWith('star'))

/** The icons that sit in the paragraphs, by file name without the prefix: commerce, cards, travel. */
export const heroIcon = Object.fromEntries(
  Object.entries(byName((n) => n.startsWith('icon-'))).map(([name, url]) => [name.slice(5), url]),
) as Record<string, string>
