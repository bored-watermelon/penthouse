import { useEffect, useRef, useState } from 'react'
import { collage, type Part } from '../lib/collage'
import { camera } from '../lib/about'

/**
 * Me, as a paper doll: a face, a top, two trouser legs and shoes, each swappable with the arrows beside it, and two
 * arms reaching over to the box. Hovering wiggles the face, hands and legs towards the box.
 *
 * Laid out on the Figma frame ("about", node 910:15714): positions are design px in a 540 × 875 area, turned into
 * percentages so the whole doll scales as one. (Taller than the Figma frame: the legs start just above the shortest
 * top's hem, and still reach the ground.)
 */
const W = 540
const H = 990
const at = (x: number, y: number, w: number, h: number): React.CSSProperties => ({ left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(w / W) * 100}%`, height: `${(h / H) * 100}%` })

/** Where each set of swap arrows sits: the centre of the left one and the right one. */
const ARROWS: Record<Part, { label: string; y: number; l: number; r: number }> = {
  faces: { label: 'face', y: 96, l: 146, r: 342 },
  tops: { label: 'top', y: 262, l: 58, r: 440 },
  bottoms: { label: 'bottoms', y: 700, l: 92, r: 424 },
  shoes: { label: 'shoes', y: 945, l: 40, r: 505 },
}

function Swap({ part, dir, onClick }: { part: Part; dir: 'prev' | 'next'; onClick: () => void }) {
  const a = ARROWS[part]
  const b = camera.buttons
  const url = (u?: string) => (u ? `url("${u}")` : undefined)
  return (
    <button
      type="button"
      className={`collage__swap cambtn cambtn--${dir}`}
      aria-label={`${dir === 'prev' ? 'previous' : 'next'} ${a.label}`}
      onClick={onClick}
      style={{
        left: `${((dir === 'prev' ? a.l : a.r) / W) * 100}%`,
        top: `${(a.y / H) * 100}%`,
        '--b-normal': url(b.normal),
        '--b-hover': url(b.hover ?? b.normal),
        '--b-pressed': url(b.pressed ?? b.normal),
        '--b-disabled': url(b.disabled ?? b.normal),
      } as React.CSSProperties}
    />
  )
}

/** Every outfit piece, fetched up front, so swapping never shows a gap while the next one downloads. */
const preload = () => [...collage.faces, ...collage.tops, ...collage.bottoms, ...collage.shoes].forEach((src) => (new Image().src = src))

export default function Collage() {
  const doll = useRef<HTMLElement>(null)
  const [pick, setPick] = useState<Record<Part, number>>({ faces: 0, tops: 0, bottoms: 0, shoes: 0 })
  const [changed, setChanged] = useState<Part | null>(null)
  const cycle = (part: Part, step: 1 | -1) => {
    setPick((p) => ({ ...p, [part]: (p[part] + step + collage[part].length) % collage[part].length }))
    setChanged(part)
  }

  useEffect(preload, [])

  // a quick squash on whatever just changed (the same <img> gets a new picture, so nothing blinks)
  useEffect(() => {
    if (!changed || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    doll.current?.querySelectorAll<HTMLElement>(`[data-part="${changed}"]`).forEach((el) =>
      el.animate([{ scale: '0.92' }, { scale: '1.03' }, { scale: '1' }], { duration: 320, easing: 'ease-out' }),
    )
  }, [pick, changed])
  const face = collage.faces[pick.faces]
  const top = collage.tops[pick.tops]
  const leg = collage.bottoms[pick.bottoms]
  const shoe = collage.shoes[pick.shoes]

  return (
    <div className="collage">
      <p className="collage__note collage__note--me">
        a 24 yr old who feels like she’s running out of time (she’s not)
        {collage.arrows.face && <img className="collage__note-arrow" src={collage.arrows.face} alt="" />}
      </p>

      <figure ref={doll} className="collage__doll" aria-label="a paper-doll collage of me; the arrows change my face, top, bottoms and shoes">
        {collage.stars.red && <img className="collage__star" src={collage.stars.red} alt="" style={at(14, 144, 185.25, 225.56)} />}
        {collage.stars.yellow && <img className="collage__star" src={collage.stars.yellow} alt="" style={{ ...at(314, 414, 166, 194.64), transform: 'rotate(88.24deg)' }} />}

        {face && <img data-part="faces" className="collage__part collage__face" src={face} alt="" style={at(166, 2, 153, 199)} />}
        {collage.hands.top && <img className="collage__part collage__hand collage__hand--top" src={collage.hands.top} alt="" style={at(295, 113, 242, 129)} />}
        {collage.hands.bottom && <img className="collage__part collage__hand collage__hand--bottom" src={collage.hands.bottom} alt="" style={at(328, 280, 212, 136)} />}

        {/* each leg is a trouser leg and a shoe, hung from the hip, so the shoe goes wherever the leg swings. The two
            meet (and overlap a little) at their inner top corners, so they read as one pair of trousers, not two halves. */}
        {leg && (
          <>
            <span className="collage__leg collage__leg--l" style={at(148, 440, 121.5, 550)}>
              <img data-part="bottoms" className="collage__part collage__trouser" src={leg} alt="" />
              {shoe && <img data-part="shoes" className="collage__part collage__shoe" src={shoe} alt="" />}
            </span>
            <span className="collage__leg collage__leg--r" style={at(210.5, 440, 121.5, 550)}>
              <img data-part="bottoms" className="collage__part collage__trouser" src={leg} alt="" />
              {shoe && <img data-part="shoes" className="collage__part collage__shoe" src={shoe} alt="" />}
            </span>
          </>
        )}

        {top && <img data-part="tops" className="collage__part collage__top" src={top} alt="" style={at(80, 175, 336, 320)} />}

        {(Object.keys(ARROWS) as Part[]).map((part) =>
          collage[part].length > 1 ? (
            <span key={part}>
              <Swap part={part} dir="prev" onClick={() => cycle(part, -1)} />
              <Swap part={part} dir="next" onClick={() => cycle(part, 1)} />
            </span>
          ) : null,
        )}
      </figure>
    </div>
  )
}
