// The paper-doll collage of me beside the about box. Everything comes from /about/mybodycollage:
//   faces/, top/, bottom/, shoes/   one picture per option; the arrows cycle through whatever's in each folder
//   bottom/                         a single trouser leg (the other leg is the same picture, mirrored)
//   shoes/                          a single shoe, side on (the other foot is the same picture, mirrored)
//   hands/top.png, hands/bottom.png the two arms, always the same, pointing at the box
//   doodles/                        the starbursts behind me and the arrows on the handwritten notes

const pick = (files: Record<string, string>) =>
  Object.keys(files)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((p) => files[p])
const one = (files: Record<string, string>) => Object.values(files)[0] as string | undefined

const faces = import.meta.glob('../../about/mybodycollage/faces/*.{png,PNG,webp}', { query: { w: 360, format: 'webp', quality: 86 }, import: 'default', eager: true }) as Record<string, string>
const tops = import.meta.glob('../../about/mybodycollage/top/*.{png,PNG,webp}', { query: { w: 760, format: 'webp', quality: 86 }, import: 'default', eager: true }) as Record<string, string>
const bottoms = import.meta.glob('../../about/mybodycollage/bottom/*.{png,PNG,webp}', { query: { w: 340, format: 'webp', quality: 86 }, import: 'default', eager: true }) as Record<string, string>
const shoes = import.meta.glob('../../about/mybodycollage/shoes/*.{png,PNG,webp}', { query: { w: 360, format: 'webp', quality: 86 }, import: 'default', eager: true }) as Record<string, string>
const handTop = import.meta.glob('../../about/mybodycollage/hands/top.{png,PNG,webp}', { query: { w: 520, format: 'webp', quality: 86 }, import: 'default', eager: true }) as Record<string, string>
const handBottom = import.meta.glob('../../about/mybodycollage/hands/bottom.{png,PNG,webp}', { query: { w: 520, format: 'webp', quality: 86 }, import: 'default', eager: true }) as Record<string, string>
const doodles = import.meta.glob('../../about/mybodycollage/doodles/*.svg', { query: '?url', import: 'default', eager: true }) as Record<string, string>
const doodle = (name: string) => Object.entries(doodles).find(([p]) => p.endsWith(`/${name}.svg`))?.[1]

export const collage = {
  faces: pick(faces),
  tops: pick(tops),
  bottoms: pick(bottoms),
  shoes: pick(shoes),
  hands: { top: one(handTop), bottom: one(handBottom) },
  stars: { red: doodle('star-red'), yellow: doodle('star-yellow') },
  arrows: { face: doodle('arrow-face'), box: doodle('arrow-box') },
}
export type Part = 'faces' | 'tops' | 'bottoms' | 'shoes'
