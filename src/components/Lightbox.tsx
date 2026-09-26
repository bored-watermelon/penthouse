import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PlayItem } from '../content'

type Props = { items: PlayItem[]; index: number; onIndex: (i: number) => void; onClose: () => void }

const NEAR = 2 // photos either side of the one on show that are loaded ahead, so flicking never waits

type Stage = { w: number; h: number }
function useStage() {
  const [s, set] = useState<Stage>(() => ({ w: innerWidth, h: innerHeight }))
  useEffect(() => {
    const on = () => set({ w: innerWidth, h: innerHeight })
    addEventListener('resize', on)
    return () => removeEventListener('resize', on)
  }, [])
  return s
}

/**
 * One photo in the strip. Its box is sized from the picture's shape before the picture itself arrives, and shows
 * the small version the grid already loaded until the full one is in, so nothing jumps or sits empty.
 */
function Slide({ item, near, current, stage }: { item: PlayItem; near: boolean; current: boolean; stage: Stage }) {
  const [sharp, setSharp] = useState(false)
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = video.current
    if (!v) return
    if (current) v.play().catch(() => {})
    else v.pause()
  }, [current, near])

  const small = stage.w <= 860
  const maxW = Math.min(1100, stage.w - (small ? 32 : 192))
  const maxH = stage.h - (small ? 230 : 210)
  const ratio = item.width && item.height ? item.width / item.height : 0
  const size = ratio ? (maxW / maxH > ratio ? { width: maxH * ratio, height: maxH } : { width: maxW, height: maxW / ratio }) : null
  const stop = (e: React.MouseEvent) => e.stopPropagation() // clicks on the photo itself don't close the viewer

  return (
    <div className="lb-slide" style={{ width: stage.w }} aria-hidden={!current}>
      <figure className="lightbox__figure">
        {item.video ? (
          near && <video ref={video} className="lb-free" src={item.src} muted loop playsInline controls onClick={stop} />
        ) : size ? (
          <span className="lb-media" style={{ ...size, backgroundImage: item.thumb ? `url("${item.thumb}")` : undefined }} onClick={stop}>
            {near && (
              <img
                src={item.src}
                alt={item.caption}
                draggable={false}
                className={sharp ? 'is-sharp' : ''}
                ref={(el) => {
                  if (el?.complete && el.naturalWidth && !sharp) setSharp(true)
                }}
                onLoad={() => setSharp(true)}
              />
            )}
          </span>
        ) : (
          near && <img className="lb-free" src={item.src} alt={item.caption} draggable={false} onClick={stop} />
        )}
        {(item.caption || item.tags.length > 0) && (
          <figcaption>
            {item.caption && <span className="lightbox__caption">{item.caption}</span>}
            {item.tags.length > 0 && <span className="lightbox__tags"> • {item.tags.join(', ')}</span>}
          </figcaption>
        )}
      </figure>
    </div>
  )
}

/**
 * The full-size viewer: every photo side by side on one strip, like a phone's photos app. Swipe or drag and the
 * strip follows the finger, then settles on the next one (or springs back); the arrows and ← → keys slide it too.
 */
export default function Lightbox({ items, index, onIndex, onClose }: Props) {
  const stage = useStage()
  const [leaving, setLeaving] = useState(false)
  const [dx, setDx] = useState(0) // how far the strip has been dragged off the current photo
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ id: number; x0: number; y0: number; t0: number; on: boolean } | null>(null)
  const swiped = useRef(false) // a drag ends in a click on the backdrop, which shouldn't close the viewer

  const go = (step: 1 | -1) => {
    const next = index + step
    if (next >= 0 && next < items.length) onIndex(next)
  }
  const close = () => {
    setLeaving(true)
    window.setTimeout(onClose, 220)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', onKey)
    document.documentElement.style.overflow = 'hidden' // lock page scroll behind the viewer
    return () => {
      window.removeEventListener('keydown', onKey)
      document.documentElement.style.overflow = ''
    }
  })

  const onDown = (e: React.PointerEvent) => {
    swiped.current = false
    if ((e.target as Element).closest('.lightbox__arrow, video')) return
    drag.current = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), on: false }
  }
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const mx = e.clientX - d.x0
    if (!d.on) {
      if (Math.abs(mx) < 6 || Math.abs(mx) < Math.abs(e.clientY - d.y0)) return
      d.on = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    // past the first or last photo it gives, but only a little
    const pastEnd = (index === 0 && mx > 0) || (index === items.length - 1 && mx < 0)
    setDx(pastEnd ? mx * 0.25 : mx)
  }
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (!d?.on) return
    swiped.current = true
    setDragging(false)
    setDx(0)
    const mx = e.clientX - d.x0
    const speed = mx / Math.max(1, performance.now() - d.t0) // px per ms: a quick flick counts even if short
    if (mx < -stage.w * 0.18 || speed < -0.45) go(1)
    else if (mx > stage.w * 0.18 || speed > 0.45) go(-1)
  }

  if (!items[index]) return null

  return createPortal(
    <div
      className={`lightbox lightbox--strip${leaving ? ' is-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={items[index].caption || 'Preview'}
      onClick={() => (swiped.current ? (swiped.current = false) : close())}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <div className={`lb-track${dragging ? ' is-dragging' : ''}`} style={{ transform: `translate3d(${-index * stage.w + dx}px, 0, 0)` }}>
        {items.map((it, i) => (
          <Slide key={it.id} item={it} near={Math.abs(i - index) <= NEAR} current={i === index} stage={stage} />
        ))}
      </div>

      {index > 0 && (
        <button type="button" className="lightbox__arrow lightbox__arrow--prev" aria-label="Previous" onClick={(e) => (e.stopPropagation(), go(-1))}>
          ←
        </button>
      )}
      {index < items.length - 1 && (
        <button type="button" className="lightbox__arrow lightbox__arrow--next" aria-label="Next" onClick={(e) => (e.stopPropagation(), go(1))}>
          →
        </button>
      )}
    </div>,
    document.body,
  )
}
