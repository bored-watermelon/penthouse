import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Tile } from '../content'
import CaseStudy from './CaseStudy'
import Logos from './Logos'
import CloseButton from './CloseButton'

const clock = (s: number) => (Number.isFinite(s) && s >= 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '0:00')

/**
 * A clip in the viewer, with its own controls under it (Figma 7374:8083): play/pause, a bar to scrub along, and
 * the time. It starts playing with its sound on, since opening it was a click.
 */
function Player({ src, onReady }: { src: string; onReady: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [length, setLength] = useState(0)
  const toggle = () => {
    const v = video.current!
    if (v.paused) v.play().catch(() => undefined)
    else v.pause()
  }
  return (
    <>
      <video
        ref={video}
        className="showcase__visual"
        src={src}
        autoPlay
        playsInline
        loop
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => setLength(e.currentTarget.duration)}
        onLoadedData={onReady}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
      />
      <div className="player">
        <button type="button" className="player__play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? (
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden>
              <path d="M3 2v8M9 2v8" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden>
              <path d="M3 1.5v9l7.5-4.5z" fill="currentColor" />
            </svg>
          )}
        </button>
        <input
          className="player__bar"
          type="range"
          min={0}
          max={length || 0}
          step={0.01}
          value={time}
          aria-label="Seek"
          style={{ '--p': `${length ? (time / length) * 100 : 0}%` } as React.CSSProperties}
          onChange={(e) => {
            video.current!.currentTime = +e.target.value
            setTime(+e.target.value)
          }}
        />
        <span className="player__time">
          {clock(time)}/{clock(length)}
        </span>
      </div>
    </>
  )
}

/**
 * Whatever a tile in the work or play grid opens into, in the middle of the screen over the page, frosted
 * (Figma 7374:7628). A picture or a clip shows with its chip, its logos, heading and subtitle; a case study opens
 * as its whole write-up in a panel that scrolls on its own. Clicking anywhere on the frosted glass (the pointer
 * turns into a cross there), Escape, or the browser's back button closes it.
 */
export default function Showcase({ tile, onClose }: { tile: Tile; onClose: () => void }) {
  const [slug, setSlug] = useState(tile.slug)
  const [leaving, setLeaving] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const done = useRef(onClose)
  useEffect(() => {
    done.current = onClose
  })

  const finish = () => {
    setLeaving(true)
    window.setTimeout(() => done.current(), matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220)
  }
  // It sits on its own history entry, so the back button closes it instead of leaving the page. Closing it any
  // other way steps back off that entry, which lands in the popstate handler below.
  const close = () => (history.state?.showcase ? history.back() : finish())

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null
    if (!history.state?.showcase) history.pushState({ showcase: true }, '')
    document.documentElement.classList.add('has-showcase') // the page underneath stays put
    box.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close()
    const onPop = () => finish()
    addEventListener('keydown', onKey)
    addEventListener('popstate', onPop)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('popstate', onPop)
      document.documentElement.classList.remove('has-showcase')
      before?.focus({ preventScroll: true })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // only the glass itself closes it; a click on what's shown on it doesn't
  const onGlass = (e: React.MouseEvent) => e.target === e.currentTarget && close()
  const m = tile.media
  const caseStudy = tile.kind === 'case' && tile.written && slug // one not written yet shows its thumbnail, like any piece
  // A piece comes up only once its picture or clip is there to show, so nothing round it (its caption) shows on its
  // own first. A slow one is given a moment, then shown anyway.
  const [ready, setReady] = useState(false)
  const isReady = () => setReady(true)
  useEffect(() => {
    const t = window.setTimeout(isReady, 1500)
    return () => window.clearTimeout(t)
  }, [])
  // a play piece's heading is the text from its file name, the same as its label in the grid; it has no chip
  const heading = tile.heading || undefined
  const chip = tile.section !== 'play' && tile.tags[0]

  return createPortal(
    <div
      className={`showcase${caseStudy ? ' showcase--case' : ''}${leaving ? ' is-leaving' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={heading || 'Viewer'}
      tabIndex={-1}
      ref={box}
      onClick={onGlass}
    >
      {caseStudy ? (
        <div className="showcase__panel">
          <div className="showcase__scroll" data-scroller>
            <CaseStudy slug={caseStudy} onClose={close} onOpen={setSlug} />
          </div>
        </div>
      ) : (
        m && (
          <figure className={`showcase__piece${ready ? ' is-ready' : ''}`} onClick={onGlass}>
            {chip && <span className="chip-tag">{chip.toLowerCase()}</span>}
            <div className={`showcase__frame${tile.backdrop ? ' has-backdrop' : ''}`} style={tile.bg ? { background: tile.bg } : undefined}>
              {tile.backdrop && (
                <span className="showcase__bg" aria-hidden>
                  {tile.backdrop.video ? <video src={tile.backdrop.src} autoPlay muted loop playsInline /> : <img src={tile.backdrop.src} alt="" />}
                </span>
              )}
              {m.video ? (
                <Player src={m.src} onReady={isReady} />
              ) : (
                <img className="showcase__visual" src={m.src} alt={heading ?? ''} onLoad={isReady} onError={isReady} ref={(el) => void (el?.complete && el.naturalWidth && isReady())} />
              )}
            </div>
            {(tile.logos.length > 0 || heading || tile.subtitle) && (
              <figcaption className="showcase__cap">
                <Logos names={tile.logos} />
                {heading && <span className="showcase__heading">{heading}</span>}
                {tile.subtitle && <span className="showcase__sub">{tile.subtitle}</span>}
              </figcaption>
            )}
          </figure>
        )
      )}
      <CloseButton onClose={close} />
    </div>,
    document.body,
  )
}
