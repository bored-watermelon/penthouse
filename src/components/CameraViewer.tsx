import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { camera } from '../lib/about'

/** One of the camera's arrow buttons, drawn from the button art in each state (hover, pressed, and disabled at the ends). */
function CamButton({ dir, disabled, onClick }: { dir: 'prev' | 'next'; disabled: boolean; onClick: () => void }) {
  const b = camera.buttons
  const at = camera.pad[dir]
  const url = (u?: string) => (u ? `url("${u}")` : undefined)
  return (
    <button
      type="button"
      className={`cambtn cambtn--${dir}`}
      disabled={disabled}
      aria-label={dir === 'prev' ? 'Previous photo' : 'Next photo'}
      onClick={onClick}
      style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%`, '--b-normal': url(b.normal), '--b-hover': url(b.hover ?? b.normal), '--b-pressed': url(b.pressed ?? b.normal), '--b-disabled': url(b.disabled ?? b.normal) } as React.CSSProperties}
    />
  )
}

// The camera art is fetched and decoded ahead of time, so the viewer opens whole instead of the photo arriving first.
let bodyReady = false
let warming: Promise<void> | null = null
export function preloadCamera() {
  if (warming) return warming
  const b = camera.buttons
  const load = (src?: string) => {
    if (!src) return Promise.resolve()
    const img = new Image()
    img.src = src
    return img.decode().catch(() => {})
  }
  ;[b.normal, b.hover, b.pressed, b.disabled].forEach(load)
  load(camera.photos[0])
  warming = load(camera.body).then(() => {
    bodyReady = true
  })
  return warming
}

/**
 * The camera from the box, opened up: its screen shows the photos in "camera photos", one at a time, like flicking
 * through a camera's playback. The arrow buttons (or ← →, or a swipe) step through them; Esc or a click outside closes.
 */
export default function CameraViewer({ onClose }: { onClose: () => void }) {
  const photos = camera.photos
  const [i, setI] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const [ready, setReady] = useState(bodyReady) // the camera stays hidden until its body can be drawn
  const swipe = useRef<number | null>(null)
  const s = camera.screen

  const go = (step: 1 | -1) => setI((n) => Math.min(photos.length - 1, Math.max(0, n + step)))
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

  useEffect(() => {
    if (ready) return
    let live = true
    preloadCamera().then(() => live && setReady(true))
    return () => {
      live = false
    }
  }, [ready])

  // have the photos either side ready, so flicking through doesn't wait on a download
  useEffect(() => {
    ;[i - 1, i + 1].forEach((k) => {
      if (photos[k]) new Image().src = photos[k]
    })
  }, [i, photos])

  return createPortal(
    <div className={`lightbox camview${leaving ? ' is-leaving' : ''}`} role="dialog" aria-modal="true" aria-label="my camera roll" onClick={close}>
      <div
        className={`camview__inner${ready ? '' : ' is-waiting'}`}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => (swipe.current = e.clientX)}
        onPointerUp={(e) => {
          if (swipe.current === null) return
          const dx = e.clientX - swipe.current
          swipe.current = null
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
        }}
      >
        <div className="camview__camera">
          {/* the photo sits behind the camera's body, showing through the hole where its screen is */}
          <div className="camview__screen" style={{ left: `${s.l * 100}%`, top: `${s.t * 100}%`, width: `${(s.r - s.l) * 100}%`, height: `${(s.b - s.t) * 100}%` }}>
            {photos[i] && <img key={i} src={photos[i]} alt={`photo ${i + 1} of ${photos.length}`} draggable={false} />}
            <span className="camview__osd" aria-hidden>
              {i + 1}/{photos.length}
            </span>
          </div>
          <img className="camview__body" src={camera.body} alt="" draggable={false} />
          {/* the arrows sit on the left and right of the camera's own round direction pad */}
          <CamButton dir="prev" disabled={i === 0} onClick={() => go(-1)} />
          <CamButton dir="next" disabled={i >= photos.length - 1} onClick={() => go(1)} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
