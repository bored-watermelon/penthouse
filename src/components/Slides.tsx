import { Children, useEffect, useRef, type ReactNode } from 'react'
import { DECK, EASE, HURRY, dropGhosts, enter, gsap, heroAway, heroBack, heroHome, heroToWork, hide, kindOf, workToHero } from '../lib/slideMotion'

/**
 * The hero, work, timeline and about, on one page that scrolls (see lib/slideMotion.ts for how each one comes in).
 *
 * Each section after the hero enters once, as it scrolls into view: its heading rolls up into place, and then what's
 * in it (the work tiles as they come up, the timeline's line and photos, about's walk and box).
 *
 * Wider than DECK.breakpoint, the hero and work still hand over as one move: a flick of the wheel, a swipe or a key
 * at the top of the page grows the hero's white card over the screen and lands on work, and scrolling back up to the
 * top of work shrinks it back onto the card. Further down it goes a screen at a time too: from the end of work's grid
 * one scroll glides to the timeline, the next to about, and back up the same way. Below the top of about, and inside
 * work's grid, the page just scrolls.
 *
 * With reduced motion, none of this runs at all.
 */
export default function Slides({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = matchMedia('(prefers-reduced-motion: reduce)')
    const wide = matchMedia(`(min-width: ${DECK.breakpoint + 1}px)`)
    let view: View | null = null
    let handover = () => {}
    // the hand-over comes and goes with the width (a turned tablet); the sections that have come in stay in
    const toggle = () => {
      handover()
      handover = view && wide.matches ? gate(root.current!, view) : () => {}
    }
    const begin = () => {
      handover()
      handover = () => {}
      view?.stop()
      view = reduce.matches ? null : onView(root.current!)
      toggle()
    }
    begin()
    reduce.addEventListener('change', begin)
    wide.addEventListener('change', toggle)
    return () => {
      handover()
      view?.stop()
      reduce.removeEventListener('change', begin)
      wide.removeEventListener('change', toggle)
    }
  }, [])

  return (
    <div className="slides" ref={root}>
      {Children.map(children, (child) => (
        <div className="slide" data-slide>
          {child}
        </div>
      ))}
    </div>
  )
}

const slidesIn = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(':scope > [data-slide]')]

/** Undoes whatever motion left on the sections, so each mode starts from the plain page. */
function reset(root: HTMLElement) {
  gsap.globalTimeline.getChildren(false, true, true).forEach((t) => t.kill())
  dropGhosts()
  for (const s of slidesIn(root)) {
    // only what GSAP has had its hands on: React sets inline transforms of its own (the doll's stars), and clearing a
    // transform takes the inline translate, rotate and scale with it (the timeline photos' tilts), so that's only
    // done where GSAP actually moved something
    const touched = [...s.querySelectorAll<HTMLElement>('[style]')].filter((el) => '_gsap' in el)
    if (touched.length) gsap.set(touched, { clearProps: 'opacity,visibility,clipPath,filter,strokeDasharray,strokeDashoffset,marginTop' })
    const moved = touched.filter((el) => el.style.transform)
    if (moved.length) gsap.set(moved, { clearProps: 'transform,transformOrigin' })
  }
  root.classList.remove('slides--animated', 'slides--gate')
}

// ----- each section enters once, as it comes into view -----

/** the page gliding from one section to the next (gate's `glide`): fast, but not a reader in a hurry */
let gliding = false

type View = { stop: () => void; claim: (slide: HTMLElement) => void; release: (slide: HTMLElement) => void }

/**
 * What has to be showing for a section to come in, and how much of it. The timeline waits for its line, and about for
 * its box, so what plays in them (the marbles, the walk, the box set down) plays where it can be seen; their headings
 * sit just above, so come in with them. Work comes in as soon as a little of it shows, so no blank band scrolls up.
 */
function cueOf(slide: HTMLElement): [Element, number] {
  const kind = kindOf(slide)
  const part = kind === 'timeline' ? slide.querySelector('.tl__board, .tlc') : kind === 'about' ? slide.querySelector('.toybox') : null
  return part ? [part, kind === 'timeline' ? 0.5 : 0.3] : [slide, DECK.inViewShare]
}

function onView(root: HTMLElement): View {
  root.classList.add('slides--animated')
  const slides = slidesIn(root).filter((s) => kindOf(s) && kindOf(s) !== 'hero')
  slides.forEach((s) => hide(s))
  const cues = new Map(slides.map((s) => [cueOf(s)[0], s]))
  // how fast the page is scrolling, px/s, eased over the last few frames
  let speed = 0
  let last = { y: scrollY, t: performance.now() }
  const onScroll = () => {
    const now = { y: scrollY, t: performance.now() }
    const dt = Math.max(1, now.t - last.t)
    speed = speed * 0.6 + (Math.abs(now.y - last.y) / dt) * 1000 * 0.4
    last = now
  }
  addEventListener('scroll', onScroll, { passive: true })
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const slide = cues.get(e.target)!
        // something taller than the screen counts as in view once it fills enough of the screen
        const needed = Math.min(e.boundingClientRect.height, innerHeight) * cueOf(slide)[1]
        if (!e.isIntersecting || e.intersectionRect.height < needed) continue
        io.unobserve(e.target)
        // got here fast, or already partway in (its top gone up off the screen): the same entrance, quicker
        const into = Math.max(0, -slide.getBoundingClientRect().top) / innerHeight
        const moving = !gliding && performance.now() - last.t < 150 ? speed : 0 // no scroll for a moment: they've stopped
        enter(slide, 1).timeScale(Math.min(HURRY.most, Math.max(1, moving / HURRY.speed, 1 + into * 3)))
      }
    },
    { threshold: Array.from({ length: 21 }, (_, i) => i / 20) },
  )
  cues.forEach((_, cue) => io.observe(cue))
  return {
    stop: () => {
      io.disconnect()
      removeEventListener('scroll', onScroll)
      reset(root)
    },
    // a section brought in by something else (the hand-over from the hero): it doesn't enter again on its own
    claim: (slide) => io.unobserve(cueOf(slide)[0]),
    // and handed back, hidden again: it enters on its own if it's scrolled to some other way (the scroll bar)
    release: (slide) => io.observe(cueOf(slide)[0]),
  }
}

// ----- wide screens: the hero and work hand over -----

/** The element under the pointer (or finger) that would scroll that way itself, inside `within` (the chat). */
function scrollerFor(target: EventTarget | null, within: HTMLElement, dir: number) {
  for (let el = target instanceof Element ? target : null; el && within.contains(el); el = el.parentElement) {
    if (el.scrollHeight <= el.clientHeight + 1) continue
    const room = dir > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 1
    if (!room) continue
    const y = getComputedStyle(el).overflowY
    if (y === 'auto' || y === 'scroll') return el
  }
  return null
}

function gate(root: HTMLElement, view: View) {
  const html = document.documentElement
  const [hero, work, timeline, about] = slidesIn(root)
  root.classList.add('slides--gate')
  if (scrollY > 2) heroAway(hero) // arriving down the page (a reload): the hero waits under the white
  let moving = false // a hand-over is under way: input waits until it has done enough (see `unlockAt`)
  let playing: gsap.core.Timeline | null = null

  const workTop = () => work.getBoundingClientRect().top + scrollY
  const atHero = () => scrollY < 2
  const atWork = () => Math.abs(scrollY - workTop()) < 2
  const modalOpen = () => html.classList.contains('has-showcase') || !!document.querySelector('.lightbox:not(.is-docked)')
  const loading = () => html.classList.contains('is-loading')
  /** which sections are showing changed (lib/onScreen.ts listens, to pause what can't be seen) */
  const changed = () => window.dispatchEvent(new Event('scroll'))

  // ----- further down: the end of work, the timeline and about, a screen each -----
  // Past the end of work's grid the next scroll goes all the way to the timeline, and the next all the way to about,
  // like turning to the next slide; and back up the same way, to the top of work's grid. Below the top of about the page scrolls as any page does,
  // on down to the footer under the peeled corner.
  const topOf = (el: HTMLElement) => el.getBoundingClientRect().top + scrollY
  /** where the page sits with the last of the grid at the bottom of the screen */
  const workEnd = () => {
    const grid = work.querySelector<HTMLElement>('.work__content:not([hidden])')
    return grid ? Math.max(workTop(), grid.getBoundingClientRect().bottom + scrollY - innerHeight) : workTop()
  }
  /** where about is landed on: with its heading just where the timeline's sits on the screen, so going from one to the
   *  other only the words seem to change */
  const aboutStop = () => {
    const [mine, theirs] = [about.querySelector<HTMLElement>('.work__intro'), timeline.querySelector<HTMLElement>('.work__intro')]
    if (!mine || !theirs) return topOf(about)
    return topOf(mine) - (topOf(theirs) - topOf(timeline))
  }
  /** Where one step from here lands going down (1) or up (-1), or null where the page just scrolls. */
  const stepFrom = (dir: number) => {
    if (!timeline || !about) return null
    const y = scrollY
    const [end, tl, me] = [workEnd(), topOf(timeline), aboutStop()]
    if (dir > 0) return y >= end - 2 && y < tl - 2 ? tl : y >= tl - 2 && y < me - 2 ? me : null
    // back up from the timeline, work is gone back to from its top, not wherever in the grid it was left
    return y > tl + 2 && y <= me + 2 ? tl : y > end + 2 && y <= tl + 2 ? workTop() : null
  }
  /** One step: the page glides there, with input held until it's landed. */
  const glide = (to: number) => {
    if (moving || modalOpen() || loading()) return false
    moving = true
    gliding = true
    playing?.progress(1)
    const at = { y: scrollY }
    const tl = gsap.timeline({
      onComplete: () => {
        moving = gliding = false
        if (playing === tl) playing = null
        changed()
      },
    })
    tl.to(at, { y: to, duration: DECK.glide, ease: EASE.glide, onUpdate: () => window.scrollTo({ top: at.y, behavior: 'instant' }) })
    playing = tl
    return true
  }

  /** One hand-over: down to work (1), back to the hero from the top of work (-1), or `direct`ly back to the hero from
   *  wherever the page has already got to above work (the white lying over it, see heroAway). */
  const play = (dir: number, direct = false) => {
    if (moving || modalOpen() || loading()) return false
    moving = true
    playing?.progress(1)
    view.claim(work)
    const land = (top: number) => () => {
      window.scrollTo({ top, behavior: 'instant' })
      if (dir < 0) view.release(work)
      changed()
    }
    const { tl, unlockAt } = dir > 0 ? heroToWork(hero, work, land(workTop())) : direct ? heroBack(hero, work, land(0)) : workToHero(work, hero, land(0))
    tl.call(() => void (moving = false), undefined, unlockAt)
    tl.eventCallback('onComplete', () => {
      if (playing === tl) playing = null
    })
    playing = tl
    return true
  }

  // ----- one wheel gesture: a flick and its momentum -----
  // A trackpad keeps sending a flick's momentum for a second or more, so a gesture only ends when the wheel goes quiet,
  // turns round, or picks up again after dying down (a new flick on top of the old one's momentum). A gesture that has
  // moved (or scrolled the page up to the top of work) is spent: the rest of it doesn't carry on past.
  // A gesture that set off from where a step goes from (the end of the grid, the timeline, the top of about) steps; one
  // that has scrolled its way there (down through the grid, up through about) stops at the edge, so what's there can be
  // seen, and only the next one steps on.
  const wheel = { at: 0, dir: 0, travel: 0, peak: 0, recent: [] as number[], spent: false, fromStep: false }
  const onWheel = (e: WheelEvent) => {
    if (e.ctrlKey || e.defaultPrevented || modalOpen()) return
    if (loading()) return e.preventDefault()
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * innerHeight : e.deltaY
    const dir = Math.sign(dy)
    if (!dir) return
    const t = performance.now()
    const size = Math.abs(dy)
    const recent = wheel.recent.length ? wheel.recent.reduce((a, b) => a + b, 0) / wheel.recent.length : 0
    const pickedUp = wheel.spent && wheel.recent.length >= 3 && size >= 15 && size > recent * 2 && wheel.peak > recent * 4
    if (t - wheel.at > DECK.wheelGapMs || dir !== wheel.dir || pickedUp) Object.assign(wheel, { dir, travel: 0, peak: 0, recent: [], spent: false, fromStep: stepFrom(dir) !== null })
    wheel.at = t
    wheel.recent.push(size)
    if (wheel.recent.length > 3) wheel.recent.shift()
    wheel.peak = Math.max(wheel.peak, size)
    // mid-move, and the rest of a flick that has moved: it doesn't carry on scrolling past where the move landed
    if (moving) wheel.spent = true
    if (wheel.spent) return e.preventDefault()

    const step = stepFrom(dir)
    if (!wheel.fromStep && timeline && about) {
      const edge = dir > 0 ? workEnd() : aboutStop()
      const y = scrollY
      const crossing = dir > 0 ? y < edge - 2 && y + size > edge : y > edge + 2 && y - size < edge
      if (crossing || step !== null) {
        e.preventDefault()
        wheel.spent = true
        if (crossing) window.scrollTo({ top: edge, behavior: 'instant' })
        return
      }
    }
    if (step !== null && !scrollerFor(e.target, document.body, dir)) {
      e.preventDefault()
      wheel.travel += size
      if (wheel.travel < DECK.wheelTravel) return
      wheel.spent = true
      return void glide(step)
    }

    const down = dir > 0
    if (down ? !atHero() : scrollY - size > workTop() || scrollY < workTop() - 1) return // the page scrolling as any page does
    if (down && scrollerFor(e.target, hero, 1)) return // the chat scrolls itself
    e.preventDefault()
    if (!down) {
      // scrolling up to the top of work (or on from it): the hand-over back to the hero, from right there
      window.scrollTo({ top: workTop(), behavior: 'instant' })
      wheel.spent = true
      return void play(-1)
    }
    wheel.travel += size
    if (wheel.travel < DECK.wheelTravel) return
    wheel.spent = true
    play(dir)
  }

  // Scrolled up past the top of work in one go (a flick that overshoots, a finger's fling, the scroll bar): what shows
  // there is the white over the hero, so the hero comes back straight out of it, without going back to work first.
  let prevY = scrollY
  const onScroll = () => {
    const y = scrollY
    const top = workTop()
    if (!moving && prevY >= top - 1 && y < top - 1 && !modalOpen()) play(-1, true)
    prevY = scrollY
  }

  const onKey = (e: KeyboardEvent) => {
    if (modalOpen() || loading() || e.metaKey || e.ctrlKey || e.altKey) return
    const el = e.target as HTMLElement
    if (el.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return
    let dir = 0
    if (e.key === 'ArrowDown' || e.key === 'PageDown') dir = 1
    else if (e.key === 'ArrowUp' || e.key === 'PageUp') dir = -1
    else if (e.key === ' ' && !el.closest('button, a, [role="button"]')) dir = e.shiftKey ? -1 : 1
    const step = dir ? stepFrom(dir) : null
    if (step !== null) {
      e.preventDefault()
      if (!e.repeat) glide(step)
      return
    }
    if (!dir || !(dir > 0 ? atHero() : atWork())) return
    e.preventDefault()
    if (!e.repeat) play(dir)
  }

  // a swipe at the top of the page (or of work), or between the end of work, the timeline and about, hands over or
  // steps; anywhere else the page scrolls under the finger
  let touch: { y: number; target: EventTarget | null } | null = null
  const onTouchStart = (e: TouchEvent) => {
    const ours = atHero() || atWork() || stepFrom(1) !== null || stepFrom(-1) !== null
    touch = e.touches.length === 1 && ours ? { y: e.touches[0].clientY, target: e.target } : null
  }
  const onTouchMove = (e: TouchEvent) => {
    if (!touch || modalOpen() || e.touches.length !== 1) return
    const dir = Math.sign(touch.y - e.touches[0].clientY)
    const ours = (dir !== 0 && stepFrom(dir) !== null) || (dir > 0 ? atHero() && !scrollerFor(touch.target, hero, 1) : dir < 0 && atWork())
    if ((moving || ours) && e.cancelable) e.preventDefault()
  }
  const onTouchEnd = (e: TouchEvent) => {
    if (!touch || modalOpen() || loading()) return (touch = null)
    const dy = touch.y - e.changedTouches[0].clientY
    const dir = Math.sign(dy)
    const step = dir ? stepFrom(dir) : null
    if (step !== null) {
      if (Math.abs(dy) > DECK.swipePx) glide(step)
      return (touch = null)
    }
    if (Math.abs(dy) > DECK.swipePx && (dir > 0 ? atHero() && !scrollerFor(touch.target, hero, 1) : atWork())) play(dir)
    touch = null
  }

  // "skip to my work" (App.tsx): the hand-over, with the focus brought along to work's first control
  const onSkip = (e: Event) => {
    if (!atHero() || !play(1)) return
    e.preventDefault()
    const t0 = performance.now()
    const land = () => {
      const first = work.querySelector<HTMLElement>('button, a[href]')
      if (atWork() && first) return first.focus({ preventScroll: true })
      if (performance.now() - t0 < 2500) requestAnimationFrame(land)
    }
    requestAnimationFrame(land)
  }

  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('wheel', onWheel, { passive: false })
  addEventListener('keydown', onKey)
  addEventListener('touchstart', onTouchStart, { passive: true })
  addEventListener('touchmove', onTouchMove, { passive: false })
  addEventListener('touchend', onTouchEnd, { passive: true })
  addEventListener('skip:work', onSkip)

  return () => {
    playing?.progress(1)
    heroHome(hero)
    root.classList.remove('slides--gate')
    removeEventListener('scroll', onScroll)
    removeEventListener('wheel', onWheel)
    removeEventListener('keydown', onKey)
    removeEventListener('touchstart', onTouchStart)
    removeEventListener('touchmove', onTouchMove)
    removeEventListener('touchend', onTouchEnd)
    removeEventListener('skip:work', onSkip)
  }
}
