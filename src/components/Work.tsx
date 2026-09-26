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

const INTRO = {
  work: (
    <>
      i’ve worked on a bunch of 0 → 1 products, across{' '}
      <span className="hl hl--purple">corporate travel, agentic commerce and virtual corporate cards.</span>
    </>
  ),
  play: (
    <>
      lately, i’ve been deep into <span className="hl hl--pink">advanced prototyping</span> and learning{' '}
      <span className="hl hl--pink">front-end development</span>. also, i make art sometimes.
    </>
  ),
}

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
const PLAY_ALL = 'Everything' // the play row's first pill, like "Selected Works" for work
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

/**
 * Once content scrolls up behind the pinned header, a band fades in under it: white melting to clear, with a
 * light blur, so the tiles dissolve into the header rather than slide under a hard edge (Figma 919:16378).
 * At rest the band is hidden, so it never veils the first card.
 */
function useScrolledUnder(head: RefObject<HTMLDivElement | null>, deps: unknown[]) {
  useEffect(() => {
    const h = head.current!
    let raf = 0
    const check = () => {
      raf = 0
      // the first card or tile, not the content box, whose top padding is only the gap under the pills
      const content = h.parentElement?.querySelector<HTMLElement>('.work__content:not([hidden])')?.firstElementChild
      if (!content) return
      const under = content.getBoundingClientRect().top < h.getBoundingClientRect().bottom - 1
      h.classList.toggle('is-scrolled', under && content.getBoundingClientRect().bottom > h.getBoundingClientRect().bottom)
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(check)
    }
    addEventListener('scroll', on, { passive: true })
    addEventListener('resize', on)
    check()
    return () => {
      removeEventListener('scroll', on)
      removeEventListener('resize', on)
      cancelAnimationFrame(raf)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

export default function Work() {
  const [mode, setMode] = useState<Mode>('work')
  const [playSeen, setPlaySeen] = useState(false) // play stays mounted once visited, so its images don't reload
  const [flipped, setFlipped] = useState(false) // hides the "flip me" nudge once the lever has been used
  const [open, setOpen] = useState<number | null>(null) // index into the visible play items
  const [playTags, setPlayTags] = useState<string[]>([]) // none ticked = everything
  const [facet, setFacet] = useState<Record<Facet, string[]>>({ interfaces: [], distribution: [], domain: [] })
  const section = useRef<HTMLElement>(null)
  const head = useRef<HTMLDivElement>(null)
  const controls = useRef<HTMLDivElement>(null)
  const anchor = useRef<ScrollBehavior | null>(null) // how to bring the reader to the header after a mode change, if at all

  /** The scroll position at which the header pins — where the reader should be left after a toggle. */
  const pinPoint = () => {
    const pad = parseFloat(getComputedStyle(section.current!).paddingTop) || 0
    const top = parseFloat(getComputedStyle(head.current!).top) || 0
    return section.current!.getBoundingClientRect().top + scrollY + pad - top
  }

  const switchMode = (next: Mode) => {
    if (next === mode) return
    playFlip()
    // Work and play are very different heights, so toggling while
    // scrolled into the section would strand the reader somewhere random. Remember to put them back at the
    // start of the new content, with the header exactly where it already was.
    anchor.current = scrollY > pinPoint() + 1 ? 'instant' : null
    if (next === 'play') setPlaySeen(true)
    setFlipped(true)
    setMode(next)
  }

  // Anything else on the page (the dock, "exhibit a") can ask to see work or play; the section switches and
  // scrolls itself into view:  window.dispatchEvent(new CustomEvent('work:show', { detail: 'play' }))
  useEffect(() => {
    const on = (e: Event) => {
      const next = (e as CustomEvent<Mode>).detail
      if (next !== 'work' && next !== 'play') return
      if (next === 'play') setPlaySeen(true)
      setFlipped(true)
      anchor.current = 'smooth'
      setMode(next)
      if (next === mode) window.scrollTo({ top: pinPoint(), behavior: 'smooth' }) // no re-render coming, so go now
    }
    window.addEventListener('work:show', on)
    return () => window.removeEventListener('work:show', on)
  })

  useLayoutEffect(() => {
    const behavior = anchor.current
    if (!behavior) return
    anchor.current = null
    window.scrollTo({ top: pinPoint(), behavior })
  }, [mode])

  useHeadLift(head, controls)

  // Changing a filter while scrolled into the list starts the list over: the first matching card sits right
  // under the pinned header, which doesn't move. (A shorter list would otherwise leave the reader wherever the
  // page happened to end.) Nothing happens when the list hasn't been scrolled into yet.
  const filterKey = `${Object.values(facet).flat().join('|')}/${playTags.join('|')}`
  const lastFilter = useRef(filterKey)
  useLayoutEffect(() => {
    if (lastFilter.current === filterKey) return
    lastFilter.current = filterKey
    if (scrollY > pinPoint() + 1) window.scrollTo({ top: pinPoint(), behavior: 'instant' })
  }, [filterKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('work:mode', { detail: mode }))
  }, [mode])

  // A project shows if, for every filter with something ticked, it has at least one of the ticked values.
  const shownProjects = projects.filter((p) => FACETS.every(({ key }) => !facet[key].length || facet[key].some((v) => has(p[key], v))))
  const shownPlay = playItems.filter((p) => !playTags.length || playTags.some((t) => has(p.tags, t)))
  const workFiltered = FACETS.some(({ key }) => facet[key].length > 0)
  const clearWork = () => setFacet({ interfaces: [], distribution: [], domain: [] })
  const togglePlay = (t: string) => setPlayTags((on) => (has(on, t) ? on.filter((x) => x.toLowerCase() !== t.toLowerCase()) : [...on, t]))

  useScrolledUnder(head, [mode, shownProjects.length, shownPlay.length])

  return (
    <section className="work" id="work" ref={section}>
      <div className="work__inner">
        <div className="stack">
          <div className="stack__pane">
            {/* Pinned while the section scrolls. Both intros and both filter rows are always rendered, stacked in
                one grid cell each (.swap), so the header is always the height of its taller version and a toggle
                crossfades in place instead of reflowing everything below it. */}
            <div className="work__head" ref={head}>
              <div className="work__intros swap" data-reveal>
                {(['work', 'play'] as const).map((m) => (
                  <p key={m} className={`work__intro${mode === m ? ' is-on' : ''}`} inert={mode !== m}>
                    {INTRO[m]}
                  </p>
                ))}
              </div>

              <div className="work__controls" ref={controls}>
                <div className="modes" role="group" aria-label="Choose what to see">
                  <span className="modes__lead">here is</span>
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
                  <span className={`flip-hint${flipped ? ' is-gone' : ''}`} aria-hidden>
                    <svg viewBox="0 0 70 30" width="54" height="23" fill="none">
                      <path d="M66 22C52 28 27 27 9 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                      <path d="M15 7.5L8 13.5L15.5 18.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    psst, flip it!
                  </span>
                </div>

                {/* Figma 919:16952: the first pill is "everything", lit while nothing is filtered, and clicking it
                    clears the filters; the filters after the divider can each take several values. */}
                <div className="work__filters swap">
                  <div className={`pills${mode === 'work' ? ' is-on' : ''}`} aria-label="Filter projects" inert={mode !== 'work'}>
                    <button type="button" className={`pill${workFiltered ? '' : ' is-on'}`} aria-pressed={!workFiltered} onClick={clearWork}>
                      Selected Works
                    </button>
                    <span className="pills__divider" aria-hidden />
                    {FACETS.map(({ key, label }) => (
                      <Dropdown key={key} label={label} value={facet[key]} options={FACET_OPTIONS[key]} onChange={(v) => setFacet((f) => ({ ...f, [key]: v }))} />
                    ))}
                    {workFiltered && (
                      <button type="button" className="pills__clear" onClick={clearWork}>
                        Clear Filters
                      </button>
                    )}
                  </div>
                  <div className={`pills${mode === 'play' ? ' is-on' : ''}`} aria-label="Filter play" inert={mode !== 'play'}>
                    <button type="button" className={`pill${playTags.length ? '' : ' is-on'}`} aria-pressed={!playTags.length} onClick={() => setPlayTags([])}>
                      {PLAY_ALL}
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

            <div className="work__content" hidden={mode !== 'work'} key={`work-${Object.values(facet).flat().join('|')}`}>
              {shownProjects.length ? (
                <div className="cards">
                  {shownProjects.map((p) => (
                    <div className="stack__item" key={p.id}>
                      <ProjectCard p={p} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty">Nothing here yet.</p>
              )}
            </div>
            {(mode === 'play' || playSeen) && (
              <div className="work__content" hidden={mode !== 'play'} key={`play-${playTags.join('|')}`}>
                {shownPlay.length ? (
                  <div className="masonry">
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

function ProjectCard({ p }: { p: Project }) {
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
  return (
    <Tag className={`card${href ? '' : ' card--soon'}`} {...linkProps}>
      {soonAt && <ComingSoonCursor at={soonAt} />}
      {p.background && <img className="card__bg" src={p.background} alt="" />}
      <div className="card__shade" />
      <div className="card__thumb">
        {p.thumbnail && <img src={p.thumbnail} alt={p.title} />}
        <span className={`card__cta${href ? '' : ' card__cta--soon'}`}>
          {href ? (
            <>
              {read && <span className="card__cta-time">{read} min read</span>}
              <span className="card__cta-label">read case study</span>
              <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
                <path d="M4 12 12 4M5.5 4H12v6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </>
          ) : (
            'case study soon'
          )}
        </span>
      </div>
      <div className="card__side">
        <div className="card__clients">
          {clients.map((c, i) => (
            <span key={c.name} className="card__client-group">
              {i > 0 && (
                <svg className="card__x" width="20" height="20" viewBox="0 0 20 20" aria-label="×">
                  <path d="M15.625 4.375 4.375 15.625M15.625 15.625 4.375 4.375" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
