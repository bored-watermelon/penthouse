import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { sections, type Tile } from '../content'
import { caseStudies } from '../lib/caseStudy'
import { playFlip } from '../lib/flipSound'
import PinSwitchArt from './PinSwitchArt'
import Logos from './Logos'
import Showcase from './Showcase'
import { usePlayWhenSeen } from '../lib/onScreen'
import { TILES as REVEAL, gsap } from '../lib/slideMotion'

type Mode = 'work' | 'play'

const lastPart = (id: string) => id.split('/').pop()!

/**
 * A section's tiles, in the order of their names in the control center. A section where nothing is numbered
 * (play, as it stands) is shuffled instead, once per page load, so it doesn't read as one tag after another;
 * numbering any file there ("01_…") hands the order back to the names.
 */
function arrange(tiles: Tile[]) {
  if (tiles.some((t) => /^\d+_/.test(lastPart(t.id)))) return tiles
  const a = [...tiles]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const TILES: Record<Mode, Tile[]> = { work: arrange(sections.work ?? []), play: arrange(sections.play ?? []) }

/**
 * On phones the whole header would eat half the screen, so it's allowed to ride up until only the toggle is left
 * showing: its sticky `top` becomes minus the controls' offset. Measured rather than hardcoded, because the
 * intro's height depends on the width and the font.
 */
function useHeadLift(head: RefObject<HTMLDivElement | null>, controls: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const h = head.current!
    const c = controls.current!
    const measure = () => {
      // on the section, for the header and the words laid over it (.work__ink) both
      const work = h.closest<HTMLElement>('.work')!
      work.style.setProperty('--head-lift', `${12 - c.offsetTop}px`) // controls land 12px from the top
      work.style.setProperty('--head-h', `${h.offsetHeight}px`)
      // How much of the header stays on screen once pinned: its sticky range ends a screen less this before the
      // content does (see .work__content in CSS), so the header goes up with the grid once the grid's end shows.
      const pinned = h.offsetHeight + (parseFloat(getComputedStyle(h).top) || 0)
      h.closest<HTMLElement>('.work')?.style.setProperty('--head-pinned', `${pinned}px`)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(h)
    measure()
    return () => ro.disconnect()
  }, [head, controls])
}


export default function Work() {
  const [mode, setMode] = useState<Mode>('work')
  const [playSeen, setPlaySeen] = useState(false) // play stays mounted once visited, so its images don't reload
  const [open, setOpen] = useState<Tile | null>(null) // what's showing in the viewer
  const [visit, setVisit] = useState(0) // bumped on every switch, so the work cards start again from the first
  const section = useRef<HTMLElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const anchor = useRef<ScrollBehavior | null>(null) // how to bring the reader to the new side

  /** The scroll position at which the header pins — where the reader should be left after a toggle. */
  const pinPoint = () => {
    const pad = parseFloat(getComputedStyle(section.current!).paddingTop) || 0
    const top = parseFloat(getComputedStyle(head.current!).top) || 0
    return section.current!.getBoundingClientRect().top + scrollY + pad - top
  }

  const jump = (top: number, behavior: ScrollBehavior) => window.scrollTo({ top, behavior })

  /** Every switch, however it's asked for (the lever, the labels beside it, a "work:show" event), goes through here:
   *  the lever clacks, and the new side starts fresh, with the reader at its start, not wherever they'd got to on
   *  the other side. Returns false when there was nothing to switch. */
  const flip = (next: Mode, behavior: ScrollBehavior = 'instant') => {
    if (next === mode) return false
    playFlip()
    anchor.current = behavior
    if (next === 'play') setPlaySeen(true)
    setOpen(null)
    setVisit((v) => v + 1)
    setMode(next)
    return true
  }
  const switchMode = (next: Mode) => flip(next)

  // Anything else on the page can ask to see work or play; the section switches and scrolls itself into view:
  //   window.dispatchEvent(new CustomEvent('work:show', { detail: 'play' }))
  useEffect(() => {
    const on = (e: Event) => {
      const next = (e as CustomEvent<Mode>).detail
      if (next !== 'work' && next !== 'play') return
      if (!flip(next, 'smooth')) jump(pinPoint(), 'smooth') // no switch, so no re-render coming: go now
    }
    window.addEventListener('work:show', on)
    return () => window.removeEventListener('work:show', on)
  })

  useHeadLift(head, controls)

  // A switch while scrolled into the list starts the list over: its first item sits right under the pinned header,
  // which doesn't move. (Work and play are very different heights, and a shorter list would otherwise strand the
  // reader somewhere random.) Nothing moves when the list hasn't been scrolled into yet, except that a "work:show"
  // always brings the section into view.
  const last = useRef(mode)
  useLayoutEffect(() => {
    if (last.current === mode) return
    last.current = mode
    const behavior = anchor.current ?? 'instant'
    anchor.current = null
    if (behavior === 'smooth' || scrollY > pinPoint() + 1) jump(pinPoint(), behavior)
  }, [mode]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="work" id="work" ref={section}>
      <div className="work__inner">
        <div className="stack">
          <div className="stack__pane">
            {/* Pinned while the section scrolls: the work/play toggle (Figma 7264:47526). */}
            <div className="work__head" ref={head}>
              <div className="work__controls" ref={controls} data-slide-head data-slide-head-block>
                <div className="modes" role="group" aria-label="Choose what to see">
                  <button type="button" className={`modes__label${mode === 'work' ? ' is-on' : ''}`} onClick={() => switchMode('work')}>
                    all work
                  </button>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={mode === 'play'}
                    aria-label="Switch between work and play"
                    className={`pin-switch pin-switch--${mode}`}
                    onClick={() => switchMode(mode === 'work' ? 'play' : 'work')}
                  >
                    <PinSwitchArt />
                  </button>
                  <button type="button" className={`modes__label modes__label--play${mode === 'play' ? ' is-on' : ''}`} onClick={() => switchMode('play')}>
                    some play
                  </button>
                </div>
              </div>
            </div>
            {/* The toggle's words again, laid exactly over the header's and drawn in "difference" against whatever
                is under them (see .work__ink), so they always stand out; the header's own are there to be clicked. */}
            <div className="work__ink" aria-hidden>
              <div className="work__controls" data-slide-head data-slide-head-block>
                <div className="modes">
                  <span className={`modes__label${mode === 'work' ? ' is-on' : ''}`}>all work</span>
                  <span className="pin-switch" />
                  <span className={`modes__label modes__label--play${mode === 'play' ? ' is-on' : ''}`}>some play</span>
                </div>
              </div>
            </div>

            <div className="work__content" hidden={mode !== 'work'} key={`work-${visit}`}>
              <Wall mode="work" tiles={TILES.work} visit={visit} onOpen={setOpen} />
            </div>
            {(mode === 'play' || playSeen) && (
              <div className="work__content" hidden={mode !== 'play'}>
                <Wall mode="play" tiles={TILES.play} visit={visit} onOpen={setOpen} />
              </div>
            )}
          </div>
        </div>
      </div>
      {open && <Showcase tile={open} onClose={() => setOpen(null)} />}
    </section>
  )
}

// How many columns the grid has: three on a laptop, two on a tablet, and on a phone one for work, two for play (its
// pieces are pictures, and read well small).
const COLUMNS = [
  { query: '(min-width: 1000px)', n: 3 },
  { query: '(min-width: 641px)', n: 2 },
]
const columnCount = (mode: Mode) => COLUMNS.find((c) => matchMedia(c.query).matches)?.n ?? (mode === 'play' ? 2 : 1)
function useColumns(mode: Mode) {
  const [n, setN] = useState(() => columnCount(mode))
  useEffect(() => {
    const lists = COLUMNS.map((c) => matchMedia(c.query))
    const on = () => setN(columnCount(mode))
    lists.forEach((l) => l.addEventListener('change', on))
    return () => lists.forEach((l) => l.removeEventListener('change', on))
  }, [mode])
  return n
}

/** The margin round inset media unless its name says otherwise, in % of the tile's width (as in .wall__media). */
const INSET = { x: 10, y: 11 }

/** A tile's height as a share of its width, for sharing tiles out between the columns before anything has loaded. */
function tileHeight(t: Tile) {
  const m = t.media
  const media = m?.width && m.height ? m.height / m.width : 0.75 // clips and SVGs don't say; most are about 4:3
  if (t.edge) return media
  const x = (t.inset?.x ?? INSET.x) / 100
  const y = (t.inset?.y ?? INSET.y) / 100
  return media * (1 - 2 * x) + 2 * y // inset media is narrower, with room above and below
}

/**
 * The tiles come in one by one as they're reached (see TILES in lib/slideMotion.ts): whatever comes into view
 * together is put in reading order, row by row from the top and left to right along each, and each follows the one
 * before. They come in afresh every time the grid is come to: switched to (`visit`), or arrived at from outside the
 * section (down from the hero, or back up from the timeline), since leaving it altogether puts them all back to wait.
 * A tile that has come in stays in while the reader is in the section, even when it's moved to another column (made
 * afresh) as the columns are levelled. With reduced motion they're simply there.
 */
function useTileReveal(wall: RefObject<HTMLDivElement | null>, visit: number, deps: unknown[]) {
  const seen = useRef(new Set<string>())
  const io = useRef<{ observer: IntersectionObserver; watching: WeakSet<Element> } | null>(null)
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches
  const watcher = () =>
    (io.current ??= {
      watching: new WeakSet(),
      observer: new IntersectionObserver(
        (entries) => {
          // into rows (the columns are staggered, so a row is the tiles whose tops are near the first one's), each
          // read left to right
          const rows: { top: number; left: number; el: HTMLElement }[][] = []
          entries
            .filter((e) => e.isIntersecting)
            .map((e) => ({ el: e.target as HTMLElement, top: e.boundingClientRect.top, left: e.boundingClientRect.left }))
            .sort((a, b) => a.top - b.top)
            .forEach((t) => {
              const row = rows[rows.length - 1]
              if (row && t.top - row[0].top < REVEAL.row) row.push(t)
              else rows.push([t])
            })
          const arriving = rows.flatMap((row) => row.sort((a, b) => a.left - b.left).map((t) => t.el))
          if (!arriving.length) return
          arriving.forEach((el) => {
            io.current?.observer.unobserve(el)
            io.current?.watching.delete(el)
            seen.current.add(el.dataset.tile!)
          })
          const each = Math.min(REVEAL.stagger, REVEAL.spread / Math.max(1, arriving.length - 1))
          gsap.to(arriving, { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: REVEAL.duration, ease: REVEAL.ease, stagger: each, clearProps: 'opacity,transform,filter' })
        },
        { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
      ),
    })
  /** Every tile not in yet waits, hidden, for its turn. */
  const arm = () => {
    if (!wall.current || still()) return
    const { observer, watching } = watcher()
    for (const tile of wall.current.querySelectorAll<HTMLElement>('[data-tile]')) {
      if (seen.current.has(tile.dataset.tile!) || watching.has(tile)) continue
      watching.add(tile)
      gsap.killTweensOf(tile)
      gsap.set(tile, { opacity: 0, y: REVEAL.y, scale: REVEAL.scale, filter: `blur(${REVEAL.blur}px)` })
      observer.observe(tile)
    }
  }
  /** All of them back to wait, to come in again. */
  const rearm = () => {
    seen.current.clear()
    if (io.current) {
      io.current.observer.disconnect()
      io.current.watching = new WeakSet()
    }
    arm()
  }
  // set before the first paint, so none shows and then vanishes
  useLayoutEffect(arm, deps) // eslint-disable-line react-hooks/exhaustive-deps
  // switched to: they come in again
  const lastVisit = useRef(visit)
  useLayoutEffect(() => {
    if (lastVisit.current === visit) return
    lastVisit.current = visit
    rearm()
  }, [visit]) // eslint-disable-line react-hooks/exhaustive-deps
  // the section left altogether (up to the hero, down into the timeline): they come in again when it's come back to
  useEffect(() => {
    const section = wall.current?.closest('.work')
    if (!section) return
    // (a section only touching the screen's edge, as work does under the hero, counts as left)
    const away = new IntersectionObserver(([e]) => e.intersectionRect.height < 2 && rearm(), { threshold: [0, 0.01] })
    away.observe(section)
    return () => {
      away.disconnect()
      io.current?.observer.disconnect()
      io.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

/**
 * Shares the tiles out between the columns: the top row in the order of the names, then the rest so the columns end
 * as level as they can, each column reading down in name order. Up to 9 below the top row, every way of sharing them
 * is tried (3^9 is under 20,000); past that, each goes to whichever column is shortest so far.
 */
function share(tiles: Tile[], n: number, tall: (t: Tile) => number) {
  const top = tiles.slice(0, n)
  const rest = tiles.slice(n)
  const heights = top.map(tall).concat(new Array(Math.max(0, n - top.length)).fill(0))
  let pick: number[]
  if (n > 1 && rest.length <= 9) {
    let best = Infinity
    pick = []
    const at: number[] = []
    const h = [...heights]
    const go = (k: number) => {
      if (k === rest.length) {
        const spread = Math.max(...h) - Math.min(...h)
        if (spread < best - 1e-6) [best, pick] = [spread, [...at]]
        return
      }
      for (let c = 0; c < n; c++) {
        at[k] = c
        h[c] += tall(rest[k])
        go(k + 1)
        h[c] -= tall(rest[k])
      }
    }
    go(0)
  } else {
    const h = [...heights]
    pick = rest.map((t) => {
      const c = h.indexOf(Math.min(...h))
      h[c] += tall(t)
      return c
    })
  }
  const cols: Tile[][] = top.map((t) => [t]).concat(Array.from({ length: Math.max(0, n - top.length) }, () => []))
  rest.forEach((t, k) => cols[pick[k]].push(t))
  return cols
}

/**
 * The grid (after zegzulka.com): equal columns, each tile as tall as its media, tiles of the same width stacked
 * with the same gap all round, shared out by `share`. Until a tile has been measured its height is guessed from its
 * media (tileHeight).
 */
function Wall({ mode, tiles, visit, onOpen }: { mode: Mode; tiles: Tile[]; visit: number; onOpen: (t: Tile) => void }) {
  const n = useColumns(mode)
  const wall = useRef<HTMLDivElement>(null)
  // Each tile's real height as a share of its width, once it's laid out: a clip or an SVG only says how tall it is
  // once it has loaded, and the labels under the media on a touch screen add to it. The tiles are shared out again
  // with these, so the columns do end level.
  const [measured, setMeasured] = useState<Record<string, number>>({})
  useEffect(() => {
    const el = wall.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setMeasured((had) => {
        let next = had
        for (const tile of el.querySelectorAll<HTMLElement>('[data-tile]')) {
          if (!tile.offsetWidth || !tile.offsetHeight) continue
          const r = tile.offsetHeight / tile.offsetWidth
          const id = tile.dataset.tile!
          if (Math.abs((had[id] ?? 0) - r) > 0.01) next = { ...next, [id]: r }
        }
        return next
      })
    })
    // looked at again whenever the tiles have been shared out afresh: a tile that changed column is a new element
    el.querySelectorAll('[data-tile]').forEach((t) => ro.observe(t))
    return () => ro.disconnect()
  }, [n, tiles, measured])
  useTileReveal(wall, visit, [n, tiles, measured])
  if (!tiles.length) return <p className="empty">Nothing here yet.</p>
  const cols = share(tiles, n, (t) => (measured[t.id] ?? tileHeight(t)) + 0.02) // the gap, near enough
  return (
    <div className={`wall wall--${mode}`} ref={wall} style={{ '--cols': n } as React.CSSProperties}>
      {cols.map((col, i) => (
        <div key={i} className="wall__col">
          {col.map((t) => (
            <WallTile key={t.id} t={t} onOpen={() => onOpen(t)} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** A clip in a tile plays on its own while it can be seen, silent and looping, and says how long it is. */
function TileVideo({ src, onLength }: { src: string; onLength: (s: number) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  usePlayWhenSeen(video)
  return <video ref={video} src={src} muted loop playsInline preload="metadata" onLoadedMetadata={(e) => onLength(e.currentTarget.duration)} />
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

/**
 * One tile: the media, filling the tile's width (or sitting inside it on its background, with "Edge-[no]"), and
 * its logos, always in the top-left corner. The rest comes up along its foot when it's pointed at: the heading on the
 * left, straight on the media, and what kind of thing it is on the right, on a white label (its tag, or the case
 * study's read). The subtitle waits for the viewer.
 * Without a pointer to point with, the labels just stay up.
 */
function WallTile({ t, onOpen }: { t: Tile; onOpen: () => void }) {
  const [length, setLength] = useState(0)
  const m = t.media
  const isCase = t.kind === 'case'
  const minutes = isCase && t.written ? caseStudies[t.slug!]?.minutes : undefined
  // a play piece says what it is with its file name's text, on the white label (and has no heading beside it)
  const play = t.section === 'play'
  const about = !!t.heading && !play
  const kind = isCase ? (
    <>case study · {t.written ? <>{minutes ?? 5} min <b>read ↗</b></> : 'soon'}</>
  ) : play ? (
    t.heading || undefined
  ) : (
    t.tags[0]?.toLowerCase()
  )
  const back = t.backdrop
  const inner = (
    <>
      {/* a media folder's bg.*, filling the tile behind the media; a clip plays on its own like any other */}
      {back && (
        <span className="wall__bg" aria-hidden>
          {back.video ? <video src={back.src} autoPlay muted loop playsInline preload="metadata" /> : <img src={back.thumb ?? back.src} alt="" loading="lazy" decoding="async" />}
        </span>
      )}
      <span className="wall__media">
        {m && (m.video ? <TileVideo src={m.src} onLength={setLength} /> : <img src={m.thumb ?? m.src} width={m.width} height={m.height} alt="" loading="lazy" decoding="async" />)}
      </span>
      {t.logos.length > 0 && (
        <span className="wall__logos">
          <Logos names={t.logos} />
        </span>
      )}
      {m?.video && length > 0 && <span className="wall__label wall__time">▶ {clock(length)}</span>}
      {(about || kind) && (
        <span className="wall__labels">
          {about && (
            <span className="wall__label wall__about">
              <span className="wall__heading">{t.heading}</span>
            </span>
          )}
          {kind && <span className="wall__label wall__kind">{kind}</span>}
        </span>
      )}
    </>
  )
  const props = {
    'data-tile': t.id,
    className: `wall__tile wall__tile--${t.kind}${t.edge ? ' is-edge' : ''}${t.shadow ? ' has-shadow' : ''}${isCase && !t.written ? ' is-soon' : ''}`,
    style: {
      ...(t.bg && { '--tile-bg': t.bg }),
      ...(t.inset && { '--inset-x': `${t.inset.x}%` }),
      ...(t.inset?.y !== undefined && { '--inset-y': `${t.inset.y}%` }),
      ...(t.radius !== undefined && { '--media-r': `${t.radius}px` }),
    } as React.CSSProperties,
  }
  // a written case study is a real link to its page (so it can be opened in a new tab), opening in the viewer here
  if (isCase && t.written)
    return (
      <a
        {...props}
        href={`/case-studies/${t.slug}`}
        aria-label={t.heading || undefined}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey) return
          e.preventDefault()
          onOpen()
        }}
      >
        {inner}
      </a>
    )
  // the rest, a case study not written yet among them, open their media in the viewer
  return (
    <button type="button" {...props} onClick={onOpen} aria-label={t.heading ? `Open: ${t.heading}` : 'Open'}>
      {inner}
    </button>
  )
}
