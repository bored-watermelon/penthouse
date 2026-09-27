const stem = (path: string) => path.split('/').pop()!.replace(/\.[^.]+$/, '')

const files = import.meta.glob('../../media/hero elements/*.{png,PNG,jpg,jpeg,webp}', {
  query: { w: 900, format: 'webp', quality: 90 },
  import: 'default',
  eager: true,
}) as Record<string, string>

/** The cut-outs in /media/hero elements, by file name: me, basketball, art-attack. */
export const heroImage = Object.fromEntries(Object.entries(files).map(([p, url]) => [stem(p), url])) as Record<string, string>

// The twinkling stars are SVG art (star1, star2), loaded as their own URLs rather than converted to webp.
const starFiles = import.meta.glob('../../media/hero elements/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>

/** The stars behind the selfie, by file name: star1 (red), star2 (gold). */
export const heroStar = Object.fromEntries(Object.entries(starFiles).map(([p, url]) => [stem(p), url])) as Record<string, string>
