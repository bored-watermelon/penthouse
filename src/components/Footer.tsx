import { useEffect, useRef, useState } from 'react'
import CatGame from './CatGame'
import DragWord from './DragWord'
import { useDrag } from '../lib/useDrag'
import { doodle, footerVideo, sticker } from '../lib/footerAssets'
import { isTouchDevice, useMotionAccess } from '../lib/motion'

/**
 * The headline is laid out on the Figma frame (1728 wide, "was" set at 106px), so every size below is in
 * design pixels and converted to em of the headline. The whole thing then scales with one font-size.
 */
const u = (px: number) => `${+(px / 106).toFixed(4)}em`

/** A sticker or doodle inside a cluster. x/y/w/h are design px; crop is the image's box as % of the slot, as in Figma. */
type BitSpec = { src?: string; x: number; y: number; w: number; h: number; rot?: number; crop?: [number, number, number, number] }
type Cluster = { w: number; h: number; bits: BitSpec[] }

const CLUSTERS: Record<string, Cluster> = {
  // heart, DVD and goldfish, after the "i"
  afterI: {
    w: 103, h: 101,
    bits: [
      { src: doodle.heart, x: -2, y: -2, w: 47, h: 51 },
      { src: sticker('_ (25)'), x: 5, y: 61, w: 70, h: 40, crop: [-17.9, -76.82, 135.79, 243.71] },
      { src: sticker('_ (20)'), x: 47, y: 4, w: 56, h: 76, crop: [-23.94, 0, 287.1, 172.25] },
    ],
  },
  // smiley sticky note over pencil shavings, after "was"
  afterWas: {
    w: 94, h: 168,
    bits: [
      { src: sticker('@geminis'), x: 7.7, y: 18.22, w: 78, h: 80, crop: [-37.5, -35, 175, 170] },
      { src: sticker('_ (24)'), x: 4.7, y: 101.22, w: 63, h: 62, crop: [-15.28, -15.28, 130.56, 130.56] },
    ],
  },
  // lightning bolt and camera, after "created"
  afterCreated: {
    w: 126.4, h: 171.6,
    bits: [
      { src: doodle.bolt, x: 2.7, y: 8.03, w: 38, h: 67.97 },
      { src: sticker('_ (26)'), x: 24.51, y: 85.48, w: 78.98, h: 62.6, rot: -15.71, crop: [-18.15, -35.98, 136.3, 171.96] },
    ],
  },
  cd: { w: 68, h: 69, bits: [{ src: sticker('archive'), x: 0, y: 0, w: 68, h: 69 }] },
  // arrows and a blue heart, pointing at "create"
  afterTo: {
    w: 111, h: 126,
    bits: [
      { src: sticker('_ (23)'), x: 35, y: 19.44, w: 61, h: 87 },
      { src: sticker('_ (21)'), x: 0, y: 67, w: 53, h: 53, crop: [-129.24, -80.51, 265.34, 320.94] },
    ],
  },
  // pencil, star and the End key, signing off after "create"
  afterCreate: {
    w: 153, h: 130.5,
    bits: [
      { src: doodle.pencil, x: 5.05, y: 71.82, w: 81.87, h: 58.87 },
      { src: sticker('journaling'), x: 18, y: 7.7, w: 66, h: 56 },
      { src: sticker('_ (22)'), x: 95, y: 44.7, w: 42, h: 42 },
    ],
  },
}

/** Each sticker can be picked up and moved, like the words. */
function Bit({ b }: { b: BitSpec }) {
  const { pos, z, dragging, handlers } = useDrag()
  if (!b.src) return null
  return (
    <span
      className={`bit${b.crop ? ' bit--crop' : ''}${dragging ? ' is-dragging' : ''}`}
      style={{
        left: u(b.x), top: u(b.y), width: u(b.w), height: u(b.h), zIndex: z,
        transform: `translate(${pos.x}px, ${pos.y}px) rotate(${(b.rot ?? 0) + (dragging ? 4 : 0)}deg) scale(${dragging ? 1.08 : 1})`,
      }}
      {...handlers}
    >
      <img
        src={b.src}
        alt=""
        draggable={false}
        style={b.crop ? { left: `${b.crop[0]}%`, top: `${b.crop[1]}%`, width: `${b.crop[2]}%`, height: `${b.crop[3]}%` } : undefined}
      />
    </span>
  )
}

function Stickers({ c, gap }: { c: Cluster; gap: number }) {
  return (
    <span className="cluster" style={{ width: u(c.w), height: u(c.h), marginRight: u(gap) }} aria-hidden>
      {c.bits.map((b, i) => (
        <Bit key={i} b={b} />
      ))}
    </span>
  )
}

/**
 * The footer sits fixed behind the page ("sheet"). The invisible spacer after the sheet gives the page
 * enough scroll length to slide the sheet up and uncover it.
 */
export default function Footer() {
  const spacer = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const eyes = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const pill = useDrag()
  const motion = useMotionAccess()
  const [touch] = useState(isTouchDevice)

  useEffect(() => {
    // active: any of the footer is showing. revealed: most of it is, so the socials don't drop before anyone's looking.
    const io = new IntersectionObserver(
      ([e]) => {
        setActive(e.isIntersecting)
        setRevealed(e.intersectionRatio >= 0.7)
      },
      { threshold: [0, 0.7] },
    )
    io.observe(spacer.current!)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const v = video.current
    if (!v) return
    if (active) v.play().catch(() => {})
    else v.pause()
  }, [active])

  // the googly eyes on the resume sticker look at the cursor
  useEffect(() => {
    if (!active) return
    const look = (e: PointerEvent) => {
      eyes.current?.querySelectorAll<HTMLElement>('.eye').forEach((eye) => {
        const r = eye.getBoundingClientRect()
        const travel = r.width * 0.35 // as far out as the Figma eyes look
        const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
        eye.style.setProperty('--px', `${Math.cos(a) * travel}px`)
        eye.style.setProperty('--py', `${Math.sin(a) * travel}px`)
      })
    }
    window.addEventListener('pointermove', look)
    return () => window.removeEventListener('pointermove', look)
  }, [active])

  // On a phone there's no cursor to watch, so the pupils roll like marbles with the phone's tilt: tip it right
  // and they roll right, tip the top back and they roll down. Measured from how it's being held (which drifts
  // along slowly), so holding it still at any angle brings them back to the middle.
  useEffect(() => {
    if (!active || !touch || !motion.allowed) return
    let base: { x: number; y: number } | null = null
    const on = (e: DeviceOrientationEvent) => {
      if (e.beta == null || e.gamma == null) return
      const angle = ((screen.orientation?.angle ?? 0) + 360) % 360
      // the tilt in screen directions, whichever way round the phone is
      const [tx, ty] = angle === 90 ? [e.beta, -e.gamma] : angle === 270 ? [-e.beta, e.gamma] : angle === 180 ? [-e.gamma, -e.beta] : [e.gamma, e.beta]
      if (!base) base = { x: tx, y: ty }
      base.x += (tx - base.x) * 0.02
      base.y += (ty - base.y) * 0.02
      let dx = (tx - base.x) / 18
      let dy = (ty - base.y) / 18
      const m = Math.hypot(dx, dy)
      if (m > 1) {
        dx /= m
        dy /= m
      }
      eyes.current?.querySelectorAll<HTMLElement>('.eye').forEach((eye) => {
        const travel = eye.getBoundingClientRect().width * 0.35
        eye.style.setProperty('--px', `${dx * travel}px`)
        eye.style.setProperty('--py', `${dy * travel}px`)
      })
    }
    window.addEventListener('deviceorientation', on)
    return () => window.removeEventListener('deviceorientation', on)
  }, [active, touch, motion.allowed])

  return (
    <>
      <footer className={`foot${active ? ' is-active' : ''}`} aria-label="Contact">
        {footerVideo && <video ref={video} className="foot__video" src={footerVideo} muted loop playsInline preload="auto" />}

        <div className="foot__center">
          <div className="foot__text">
            <a
              className={`resume-pill${pill.dragging ? ' is-dragging' : ''}`}
              href="/Sneha%20Jain%20Resume.pdf"
              download="Sneha Jain Resume.pdf"
              draggable={false}
              style={{ zIndex: pill.z, transform: `translate(-50%, -50%) translate(${pill.pos.x}px, ${pill.pos.y}px) rotate(-6.74deg) scale(1.05)` }}
              {...pill.handlers}
              // a drag that ends on the pill shouldn't also download the file
              onClick={(e) => pill.moved.current && e.preventDefault()}
            >
              {/* the face does the hover and drag moves; the link itself stays put so the cursor doesn't flicker */}
              <span className="resume-pill__face">
                Download resume
                <span className="eyes" ref={eyes} aria-hidden>
                  <span className="eye" />
                  <span className="eye" />
                </span>
              </span>
            </a>

            <p className="foot__l1">
              <DragWord className="foot__word" style={{ marginRight: u(-4) }}>i</DragWord>
              <Stickers c={CLUSTERS.afterI} gap={-4} />
              <DragWord className="foot__word" style={{ marginRight: u(-4) }}>was</DragWord>
              <Stickers c={CLUSTERS.afterWas} gap={-4} />
              <DragWord className="foot__word sel" style={{ marginRight: u(-4) }}>
                <i className="sel__h sel__h--l" aria-hidden />
                created
                <i className="sel__h sel__h--r" aria-hidden />
              </DragWord>
              <Stickers c={CLUSTERS.afterCreated} gap={0} />
            </p>
            <p className="foot__l2">
              <Stickers c={CLUSTERS.cd} gap={-10} />
              <DragWord className="foot__to" style={{ marginRight: u(-10) }}>[to]</DragWord>
              <Stickers c={CLUSTERS.afterTo} gap={-10} />
              <DragWord className="foot__create" style={{ marginRight: u(-10) }}>
                <img src={doodle.create} alt="create" draggable={false} style={{ width: u(346), height: u(68) }} />
              </DragWord>
              <Stickers c={CLUSTERS.afterCreate} gap={0} />
            </p>
          </div>
          {/* iPhones need a tap before the eyes can follow the phone's tilt */}
          {touch && motion.needsTap && (
            <button type="button" className="foot__eyes-ask" onClick={motion.ask}>
              tap, then tilt your phone 👀
            </button>
          )}
        </div>

        <CatGame active={active} revealed={revealed} />

        <p className="foot__rights" data-solid>
          <img src={doodle.copyright} alt="" width={20} height={20} />
          <span>
            copy<s>right</s> wrong → sneha, {new Date().getFullYear()}
          </span>
        </p>

        <small className="foot__credit" data-solid>
          video and image courtesies : lubhawani, RAHUL, harsh
        </small>
      </footer>
      <div className="foot-spacer" ref={spacer} aria-hidden />
    </>
  )
}
