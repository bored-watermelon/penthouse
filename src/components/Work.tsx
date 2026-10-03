import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import Lightbox from './Lightbox'
import Dropdown from './Dropdown'
import { playItems, projects, type PlayItem, type Project } from '../content'
import { caseStudies } from '../lib/caseStudy'
import { findLogo } from '../lib/logos'
import clockIcon from '../assets/clock-countdown.svg'
import { playFlip } from '../lib/flipSound'
import { navigate } from '../lib/router'
import PinSwitchArt from './PinSwitchArt'

type Mode = 'work' | 'play'

const has = (list: string[], tag: string) => list.some((t) => t.toLowerCase() === tag.toLowerCase())

// The play pills are built from the tags in /play file names. This list only sets their preferred order.
const PLAY_ORDER = ['Interfaces', 'Motion', 'Visuals', 'Art', 'Mobile']

function buildFilters(first: string, preferred: string[], found: string[]) {
  const unique = [...new Map(found.map((t) => [t.toLowerCase(), t])).values()]
  const known = preferred.filter((t) => has(unique, t))
  const extra = unique.filter((t) => !has(preferred, t)).sort((a, b) => a.localeCompare(b))
  return [first, ...known, ...extra]
}

type Facet = 'interfaces' | 'distribution' | 'domain'
const FACETS: { key: Facet; label: string }[] = [
  { key: 'interfaces', label: 'Interface' },
  { key: 'distribution', label: 'Distribution' },
  { key: 'domain', label: 'Domain' },
]
// Dropdown options are whatever values the /work files use, de-duplicated ignoring case.
const facetOptions = (key: Facet) =>
  [...new Map(projects.flatMap((p) => p[key]).map((v) => [v.toLowerCase(), v])).values()].sort((a, b) => a.localeCompare(b))
const FACET_OPTIONS = Object.fromEntries(FACETS.map((f) => [f.key, facetOptions(f.key)])) as Record<Facet, string[]>
const NO_FACETS: Record<Facet, string[]> = { interfaces: [], distribution: [], domain: [] }
const matches = (p: Project, key: Facet, picked: string[]) => !picked.length || picked.some((v) => has(p[key], v))
// Play shows in a new random order on every visit, rather than grouped folder by folder. Shuffled once per page
// load, so filtering and the viewer's next/previous keep a stable order while you're here.
const PLAY_MIXED = (() => {
  const a = [...playItems]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
})()
const PLAY_ALL = 'All' // the play row's first pill, like "Selected Works" for work
const PLAY_TAGS = buildFilters(PLAY_ALL, PLAY_ORDER, playItems.flatMap((i) => i.tags)).slice(1)

/**
 * On phones the whole header would eat half the screen, so it's allowed to ride up until only the toggle and
 * filters are left showing: its sticky `top` becomes minus the controls' offset. Measured rather than
 * hardcoded, because the intro's height depends on the width and the font.
 */
function useHeadLift(head: RefObject<HTMLDivElement | null>, controls: RefObject<HTMLDivElement | null>) {
  useLayoutEffect(() => {
    const h = head.current!
    const c = controls.current!
    const measure = () => {
      h.style.setProperty('--head-lift', `${12 - c.offsetTop}px`) // controls land 12px from the top
      // How much of the header stays on screen once pinned. The content gives that much back at its end (see
      // .work__content in CSS), so the header lets go while the last item is still visible beneath it,
      // instead of riding over it until it's gone.
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
  const [open, setOpen] = useState<number | null>(null) // index into the visible play items
  const [playTags, setPlayTags] = useState<string[]>([]) // none ticked = everything
  const [facet, setFacet] = useState<Record<Facet, string[]>>(NO_FACETS)
  const [visit, setVisit] = useState(0) // bumped on every switch, so the work cards start again from the first
  const section = useRef<HTMLElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const anchor = useRef<{ behavior: ScrollBehavior; at: 'start' | 'end' } | null>(null) // how to bring the reader to the new side
  const quiet = useRef(0) // until when the page is scrolling itself, which the scroll hand-over must not mistake for the reader

  /** The scroll position at which the header pins — where the reader should be left after a toggle. */
  const pinPoint = () => {
    const pad = parseFloat(getComputedStyle(section.current!).paddingTop) || 0
    const top = parseFloat(getComputedStyle(head.current!).top) || 0
    return section.current!.getBoundingClientRect().top + scrollY + pad - top
  }

  const jump = (top: number, behavior: ScrollBehavior) => {
    quiet.current = performance.now() + (behavior === 'smooth' ? 1200 : 300)
    window.scrollTo({ top, behavior })
  }

  /** The bottom of the last tile on the side showing, in page coordinates. */
  const listEnd = () => {
    const tiles = section.current?.querySelectorAll<HTMLElement>('.work__content:not([hidden]) .stack__item, .work__content:not([hidden]) .cards-grid > *')
    const lastTile = tiles?.[tiles.length - 1]
    return lastTile ? lastTile.getBoundingClientRect().bottom + scrollY : null
  }

  /** Every switch, however it's asked for (the lever, the dock, the scroll hand-over), goes through here: the lever
   *  clacks, and the new side starts fresh — no filters on, and the reader at its start, not wherever they'd got to
   *  on the other side. `at: 'end'` instead leaves them at the foot of the new list, which is what the scroll
   *  hand-over wants on the way back up, so work and play read as one continuous scroll.
   *  Returns false when there was nothing to switch. */
  const flip = (next: Mode, behavior: ScrollBehavior = 'instant', at: 'start' | 'end' = 'start') => {
    if (next === mode) return false
    playFlip()
    anchor.current = { behavior, at }
    if (next === 'play') setPlaySeen(true)
    setFacet(NO_FACETS)
    setPlayTags([])
    setOpen(null)
    setVisit((v) => v + 1)
    setMode(next)
    return true
  }
  const switchMode = (next: Mode) => flip(next)

  // Anything else on the page (the dock, "exhibit a") can ask to see work or play; the section switches and
  // scrolls itself into view:  window.dispatchEvent(new CustomEvent('work:show', { detail: 'play' }))
  useEffect(() => {
    const on = (e: Event) => {
      const next = (e as CustomEvent<Mode>).detail
      if (next !== 'work' && next !== 'play') return
      if (!flip(next, 'smooth')) jump(pinPoint(), 'smooth') // no switch, so no re-render coming: go now
    }
    // something else on the page is scrolling us somewhere; the hand-over must sit this one out
    const hush = () => { quiet.current = performance.now() + 1600 }
    window.addEventListener('work:show', on)
    window.addEventListener('nav:scroll', hush)
    return () => {
      window.removeEventListener('work:show', on)
      window.removeEventListener('nav:scroll', hush)
    }
  })

  // Work and play share one slot, so scrolling to the end of the work list hands over to play (the dock pill glides
  // work → play); scrolling back up to the top hands back to work. The two contents swap visibility with the mode,
  // so each trigger stops firing the moment it fires — no ping-pong.
  useEffect(() => {
    let raf = 0
    let lastY = window.scrollY
    const check = () => {
      raf = 0
      const down = window.scrollY > lastY
      lastY = window.scrollY
      if (performance.now() < quiet.current) return // the page moving itself (a switch, a filter), not the reader
      const sec = section.current
      if (!sec) return
      if (mode === 'work') {
        const cards = sec.querySelectorAll<HTMLElement>('.work__content:not([hidden]) .stack__item')
        const lastCard = cards[cards.length - 1]
        if (!lastCard || scrollY <= pinPoint() + 4) return
        // the last case study has come up to the middle of the screen: the end is reached. The work list has
        // half a screen of room under it (.work__content--work), so the page can get this far before the timeline shows
        const r = lastCard.getBoundingClientRect()
        if (down && (r.top + r.bottom) / 2 <= innerHeight / 2) flip('play')
      } else if (!down && scrollY <= pinPoint() + 4) flip('work', 'instant', 'end')
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(check)
    }
    addEventListener('scroll', on, { passive: true })
    return () => {
      removeEventListener('scroll', on)
      cancelAnimationFrame(raf)
    }
  }, [mode])

  useHeadLift(head, controls)

  // A switch, or a changed filter, while scrolled into the list starts the list over: its first item sits right
  // under the pinned header, which doesn't move. (Work and play are very different heights, and a shorter list
  // would otherwise strand the reader somewhere random.) Nothing moves when the list hasn't been scrolled into yet,
  // except that the dock always brings the section into view. These jumps are marked quiet, so the phone's scroll
  // hand-over doesn't read them as the reader scrolling back up to the top and flip the lever straight back.
  const filterKey = `${Object.values(facet).flat().join('|')}/${playTags.join('|')}`
  const last = useRef({ mode, filterKey })
  useLayoutEffect(() => {
    const was = last.current
    last.current = { mode, filterKey }
    if (was.mode === mode && was.filterKey === filterKey) return
    const how = (was.mode !== mode && anchor.current) || null
    const behavior = how?.behavior ?? 'instant'
    anchor.current = null
    quiet.current = Math.max(quiet.current, performance.now() + 300) // a shorter list can nudge the scroll by itself
    if (how?.at === 'end') {
      // coming back up out of play: land with the foot of the work list at the foot of the screen, so the reader
      // carries on from where play left off instead of being thrown to the top of the section
      const end = listEnd()
      if (end !== null) jump(Math.max(pinPoint(), end - innerHeight), 'instant')
      return
    }
    if (behavior === 'smooth' || scrollY > pinPoint() + 1) jump(pinPoint(), behavior)
  }, [mode, filterKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('work:mode', { detail: mode }))
  }, [mode])

  // A project shows if, for every filter with something ticked, it has at least one of the ticked values.
  // In the default view ("Selected Works", no filters) only the projects marked Selected show; once a filter is on,
  // it searches every project, chosen or not.
  const anyFilter = FACETS.some(({ key }) => facet[key].length > 0)
  const shownProjects = projects.filter((p) => (anyFilter || p.selected) && FACETS.every(({ key }) => matches(p, key, facet[key])))
  // Each dropdown offers only what's left once the other dropdowns have had their say: pick Interface → Web, and
  // Domain lists only the domains that have web work. A dropdown with nothing left isn't shown at all. What's
  // already ticked in it stays listed, so it can always be unticked.
  const facetLeft = (key: Facet) => {
    const pool = projects.filter((p) => FACETS.every((f) => f.key === key || matches(p, f.key, facet[f.key])))
    return FACET_OPTIONS[key].filter((o) => has(facet[key], o) || pool.some((p) => has(p[key], o)))
  }
  const featured = shownProjects.filter((p) => p.featured)
  const rest = shownProjects.filter((p) => !p.featured)
  const shownPlay = PLAY_MIXED.filter((p) => !playTags.length || playTags.some((t) => has(p.tags, t)))
  const workFiltered = anyFilter
  const clearWork = () => setFacet(NO_FACETS)
  const togglePlay = (t: string) => setPlayTags((on) => (has(on, t) ? on.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...on, t]))

  return (
    <section className="work" id="work" ref={section}>
      <div className="work__inner">
        <div className="stack">
          <div className="stack__pane">
            {/* Pinned while the section scrolls. One row, ruled off underneath (Figma 7264:47526): the work/play
                toggle on the left, that side's filters on the right. Both filter rows are always rendered, stacked
                in one grid cell (.swap), so the header keeps the height of its taller version and a toggle
                crossfades in place instead of reflowing everything below it. */}
            <div className="work__head" ref={head}>
              <div className="work__controls" ref={controls}>
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

                {/* Figma 919:16952: the first pill is "everything", lit while nothing is filtered, and clicking it
                    clears the filters; the filters after the divider can each take several values. */}
                <div className="work__filters swap">
                  <div className={`pills${mode === 'work' ? ' is-on' : ''}`} aria-label="Filter projects" inert={mode !== 'work'}>
                    <button type="button" className={`pill${workFiltered ? '' : ' is-on'}`} aria-pressed={!workFiltered} onClick={clearWork}>
                      Selected Works({shownProjects.length})
                    </button>
                    <span className="pills__divider" aria-hidden />
                    {FACETS.map(({ key, label }) => {
                      const left = facetLeft(key)
                      return left.length ? (
                        <Dropdown key={key} label={label} value={facet[key]} options={left} onChange={(v) => setFacet((f) => ({ ...f, [key]: v }))} />
                      ) : null
                    })}
                    {workFiltered && (
                      <button type="button" className="pills__clear" onClick={clearWork}>
                        Clear Filters
                      </button>
                    )}
                  </div>
                  <div className={`pills${mode === 'play' ? ' is-on' : ''}`} aria-label="Filter play" inert={mode !== 'play'}>
                    <button type="button" className={`pill${playTags.length ? '' : ' is-on'}`} aria-pressed={!playTags.length} onClick={() => setPlayTags([])}>
                      {PLAY_ALL}({shownPlay.length})
                    </button>
                    <span className="pills__divider" aria-hidden />
                    {PLAY_TAGS.map((t) => (
                      <button key={t} type="button" aria-pressed={has(playTags, t)} className={`pill${has(playTags, t) ? ' is-on' : ''}`} onClick={() => togglePlay(t)}>
                        {t}
                      </button>
                    ))}
                    {playTags.length > 0 && (
                      <button type="button" className="pills__clear" onClick={() => setPlayTags([])}>
                        Clear Filters
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="work__content work__content--work" hidden={mode !== 'work'} key={`work-${visit}-${Object.values(facet).flat().join('|')}`}>
              {shownProjects.length ? (
                <>
                  {/* the ones marked "Featured: yes" get a wide row each, the rest share a grid underneath */}
                  {featured.length > 0 && (
                    <CardRail count={featured.length}>
                      {featured.map((p) => (
                        <div className="stack__item" key={p.id}>
                          <ProjectCard p={p} />
                        </div>
                      ))}
                    </CardRail>
                  )}
                  {rest.length > 0 && (
                    <div className="cards-grid" data-reveal-children>
                      {rest.map((p) => (
                        <ProjectCard key={p.id} p={p} tile />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="empty">Nothing here yet.</p>
              )}
            </div>
            {(mode === 'play' || playSeen) && (
              <div className="work__content" hidden={mode !== 'play'} key={`play-${playTags.join('|')}`}>
                {shownPlay.length ? (
                  <div className="masonry" data-reveal-children>
                    {shownPlay.map((item, i) => (
                      <PlayTile key={item.id} item={item} onOpen={() => setOpen(i)} />
                    ))}
                  </div>
                ) : (
                  <p className="empty">Nothing here yet.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {open !== null && shownPlay[open] && (
        <Lightbox items={shownPlay} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </section>
  )
}

/**
 * The project cards. On a phone they're a row you swipe through, one card at a time with the next one peeking in,
 * and dots underneath to show where you are (CSS does the rest; see .cards in the phone styles).
 */
function CardRail({ children, count }: { children: React.ReactNode; count: number }) {
  const rail = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  const step = () => {
    const el = rail.current!
    const first = el.firstElementChild as HTMLElement | null
    return first ? first.offsetWidth + (parseFloat(getComputedStyle(el).columnGap) || 0) : el.clientWidth
  }
  useEffect(() => {
    const el = rail.current!
    const on = () => setAt(Math.round(el.scrollLeft / step()))
    el.addEventListener('scroll', on, { passive: true })
    return () => el.removeEventListener('scroll', on)
  }, [])
  return (
    <>
      <div className="cards" ref={rail} data-reveal-children>
        {children}
      </div>
      {count > 1 && (
        <div className="cards__dots">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              className={i === at ? 'is-on' : ''}
              aria-label={`Project ${i + 1} of ${count}`}
              aria-current={i === at}
              onClick={() => rail.current!.scrollTo({ left: i * step(), behavior: 'smooth' })}
            />
          ))}
        </div>
      )}
    </>
  )
}

/**
 * A project with no write-up yet swaps the pointer for a "Coming Soon" pill that follows the cursor
 * (Figma node 880:15350). Portalled to <body>, so nothing around the card can clip a position:fixed child.
 */
function ComingSoonCursor({ at }: { at: { x: number; y: number } }) {
  return createPortal(
    <div className="soon-cursor" style={{ transform: `translate3d(${at.x}px, ${at.y}px, 0)` }} aria-hidden>
      Coming Soon
      <img src={clockIcon} width={16} height={16} alt="" />
    </div>,
    document.body,
  )
}

function ProjectCard({ p, tile = false }: { p: Project; tile?: boolean }) {
  const clients = p.clients.map((c) => ({ name: c, logo: findLogo(c) }))
  const href = p.caseStudy
  const read = href?.startsWith('/case-studies/') ? caseStudies[p.slug]?.minutes : undefined
  const Tag = href ? 'a' : 'div'
  const [soonAt, setSoonAt] = useState<{ x: number; y: number } | null>(null)
  // A /case-studies/... link is our own in-site page: navigate client-side instead of a full reload.
  const linkProps = href
    ? { href, ...(href.startsWith('/case-studies/') && { onClick: (e: React.MouseEvent) => { e.preventDefault(); navigate(href) } }) }
    : {
        onPointerMove: (e: React.PointerEvent) => e.pointerType === 'mouse' && setSoonAt({ x: e.clientX, y: e.clientY }),
        onPointerLeave: () => setSoonAt(null),
      }
  // Figma 7264:47457: the shot on the left at its natural colours, the write-up beside it — no dark card around
  // it any more, and the "read" line sits under the tags instead of riding on the image.
  return (
    <Tag className={`card${tile ? ' card--tile' : ''}${href ? '' : ' card--soon'}`} {...linkProps}>
      {soonAt && <ComingSoonCursor at={soonAt} />}
      <div className="card__thumb">{p.thumbnail && <img src={p.thumbnail} alt={p.title} />}</div>
      <div className="card__side">
        <div className="card__clients">
          {clients.map((c, i) => (
            <span key={c.name} className="card__client-group">
              {i > 0 && (
                <svg className="card__x" width="12" height="12" viewBox="0 0 20 20" aria-label="×">
                  <path d="M15.625 4.375 4.375 15.625M15.625 15.625 4.375 4.375" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              <span className="client-pill">{c.logo ? <img src={c.logo.src} alt={c.name} /> : c.name}</span>
            </span>
          ))}
        </div>
        <div className="card__text">
          <h3>{p.title}</h3>
          <p>{p.description}</p>
          <div className="card__tags">
            {[...p.interfaces, ...p.distribution, ...p.domain].map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </div>
        <span className={`card__read${href ? '' : ' card__read--soon'}`}>
          {href ? `${read ?? 5} min read` : 'case study soon'}
          {href && (
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
              <path d="M4 12 12 4M5.5 4H12v6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </div>
    </Tag>
  )
}

function PlayTile({ item, onOpen }: { item: PlayItem; onOpen: () => void }) {
  return (
    <figure className="tile">
      <button type="button" className="tile__open" onClick={onOpen} aria-label={item.caption ? `Open: ${item.caption}` : 'Open'}>
        {item.video ? (
          <video src={item.src} autoPlay muted loop playsInline />
        ) : (
          <img src={item.thumb ?? item.src} width={item.width} height={item.height} alt={item.caption} loading="lazy" decoding="async" />
        )}
        {item.caption && <figcaption>{item.caption}</figcaption>}
      </button>
    </figure>
  )
}
