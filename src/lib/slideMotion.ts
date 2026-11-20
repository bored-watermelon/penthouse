import gsap from 'gsap'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(SplitText)

// ---------------------------------------------------------------------------------------------------------------
// Tuning knobs. Seconds unless marked.
// ---------------------------------------------------------------------------------------------------------------

/** the page, and what counts as asking the hero and work to hand over (Slides.tsx) */
export const DECK = {
  breakpoint: 900, // at or below this width (px): no hand-over, the hero just scrolls away like the rest
  inViewShare: 0.12, // how much of a section (or of the screen, for a tall one) must show before it enters: soon after it comes in, so no blank band scrolls up first
  wheelGapMs: 160, // a pause in the wheel longer than this ends a gesture; the next flick is a new one
  wheelTravel: 36, // px of wheel in one gesture before it moves (a mouse notch is about 100, so one notch does it)
  swipePx: 48,
}

/**
 * The curves, shared by everything here so it moves as one piece: whatever leaves picks up speed on its way
 * out, whatever arrives comes in fast and takes its time to settle, and whatever travels across the screen eases
 * at both ends.
 */
export const EASE = {
  leave: 'power3.in',
  arrive: 'expo.out',
  settle: 'power3.out',
  travel: 'power4.inOut',
}

/** Work going back to the hero: its toggle rolls down out of its row, the rest of it drifting the same way. */
export const SWAP = {
  outDuration: 0.42,
  outStagger: 0.03,
  travel: 105, // yPercent: a line moves a little more than its own height, so it clears its slot
  drift: 28, // px the rest of a section drifts as it goes
  contentOut: 0.34,
  unlockAfter: 0.55, // after work starts arriving from the hero, the next flick is taken
}

/** a section's heading: each word fades in from blurred to sharp, one after another */
export const WORDS = {
  duration: 0.7,
  stagger: 0.06,
  spread: 0.6, // the most the stagger adds up to, however many words
  blur: 10, // px they start at
  ease: 'power2.out',
}

/** hero ↔ work: the copy rolls out of its slots, the chat fades, and the white card grows over the screen */
export const HERO = {
  beat: 0.06, // a breath before anything moves
  copyOut: 0.5,
  copyStagger: 0.025,
  fadeOut: 0.32, // the chat, the divider, the note and the yellow strip
  growAt: 0.12,
  growDuration: 0.78, // EASE.travel
  handover: 0.86, // share of the grow after which the white is, to the eye, the whole screen: work takes over
  // back again (work → hero): the white shrinks onto the card and the copy drops back into its slots
  shrinkDuration: 0.8,
  copyInAt: 0.3, // into the shrink
  copyIn: 0.85,
  copyInStagger: 0.04,
  fadeIn: 0.5,
}

/**
 * work and play: the tiles come in one by one as they're reached, in reading order (row by row from the top, left to
 * right along each), each rising a little, settling from a touch smaller and sharpening out of a soft blur.
 */
export const TILES = {
  y: 36, // px
  scale: 0.96,
  blur: 6, // px
  duration: 0.95,
  ease: 'expo.out',
  stagger: 0.09,
  spread: 0.7, // the most the stagger adds up to, however many arrive together
  row: 120, // px: tiles whose tops are within this of a row's first count as that row (the columns are staggered)
}

/**
 * timeline, one thing after another: the heading, then the line draws from the left, the marbles roll in along it,
 * the period headings come up left to right, and then the photos open. The line and the marbles only play the first
 * time the timeline shows after the page loads; after that they're just there, and the rest comes up as before.
 */
export const LINE = {
  at: 0.35, // after the heading starts: its words have as good as landed
  draw: 1, // the first time
  ease: 'power1.inOut',
  again: 0.5, // later visits: the line and its dots come up with the section
}
/** The dots roll in along the line from its start, the furthest setting off first, like marbles tipped into a
 *  channel, and each rolls to a stop at its year. */
export const MARBLES = {
  overlap: 0.1, // they set off this much before the line has finished drawing
  stagger: 0.035,
  near: 0.5, // the nearest dot's roll
  far: 0.75, // added for the furthest dot's roll
  ease: 'power2.out', // off fast, slowed by the line, rolling to a stop
}
/** the period headings and the years, left to right */
export const LABELS = {
  overlap: 0.15, // they start this much before the last marble stops
  againAt: 0.3, // later visits: after the line starts coming up
  y: 8, // px they rise
  duration: 0.55,
  stagger: 0.07,
  spread: 0.5, // the most the stagger adds up to
}
/** then the photos, opening out from their middles, left to right */
export const PHOTOS = {
  after: 0.2, // after the last heading starts
  duration: 0.75,
  zoom: 1.15, // how far into each picture it starts, settling as its frame opens
  stagger: 0.08,
}

/** about: the character walks in from the left, the first time about shows after the page loads; after that it's there */
export const WALK = {
  at: 0.12, // after the heading starts
  duration: 1.4,
  ease: 'power1.out', // slowing for the last stride
  steps: 5, // strides; each one is tied to the distance covered, so the feet never slide
  bob: 6, // px the body drops as the legs are furthest apart
  sway: 1.8, // deg rocked either side
  legSwing: 13, // deg each leg swings either side of where it rests
  noteAfter: 0.05, // the handwritten note, after the walk
  again: 0.6, // later visits: it just comes up, like the box
}

/**
 * about: the box is set down. It's seen from above, so it starts a little nearer the eye (bigger, tilted, its shadow
 * far off and soft) and falls to the blanket; landing, the cardboard gives a touch and everything inside hops. Once
 * per visit to the site; after that it's already there.
 */
export const BOX = {
  at: 0.28, // after the heading starts
  fall: 0.5, // accelerating, like anything falling
  lift: 0.16, // how much bigger it starts
  tilt: -4, // deg
  give: 0.016, // how far past its size it sinks on landing
  giveDuration: 0.08,
  settle: 0.4,
  noteAfter: 0.12, // the note on it, after landing
  again: 0.6, // later visits: it just comes up
  flag: 'slides:box-dropped', // sessionStorage
}

// ---------------------------------------------------------------------------------------------------------------

export type Kind = 'hero' | 'work' | 'timeline' | 'about'
export const kindOf = (slide: HTMLElement): Kind | null =>
  slide.querySelector('.stage') ? 'hero' : slide.querySelector('.work') ? 'work' : slide.querySelector('.tl') ? 'timeline' : slide.querySelector('.me') ? 'about' : null


/** gsap.set, quietly skipping an empty list (a section without that part) */
const set = (targets: Element[], vars: gsap.TweenVars) => targets.length > 0 && gsap.set(targets, vars)
const all = <T extends Element = HTMLElement>(root: ParentNode, sel: string) => [...root.querySelectorAll<T>(sel)]
const present = (...els: (HTMLElement | null)[]) => els.filter((x): x is HTMLElement => !!x)
/** a stagger that never adds up to more than `spread`, however many there are */
const spaced = (n: number, each: number, spread: number) => Math.min(each, spread / Math.max(1, n - 1))

/** a once-only flag; reading it with `write` also sets it */
function flag(store: 'local' | 'session', key: string, write = false) {
  try {
    const s = store === 'local' ? localStorage : sessionStorage
    const was = s.getItem(key) === '1'
    if (write) s.setItem(key, '1')
    return was
  } catch {
    return false // private mode and the like: it just plays again
  }
}

// ----- masked lines -----
// Text slides out of a slot line by line. Splitting the text itself would rewrite DOM that React owns (headings and
// the hero copy have live parts), so a split copy is laid exactly over it and animated instead, with the real one
// hidden underneath. Once the text has landed the copy goes and the real one shows again.

const ghosts = new Map<HTMLElement, { ghost: HTMLElement; split: SplitText; type: 'lines' | 'words' }>()

// Things that hang out of their line, shadow and all (the hero's icon cards), and how far, in em of the text, above
// and below. A line holding one has its slot opened up that far, so nothing of it is cut off the moment the copy
// takes over, and travels that much further to clear the bigger slot.
const BLEED = { selector: '.icon-tile', up: 0.6, down: 1.2 }
const travels = new WeakMap<Element, number>()
/** how far (yPercent) a line moves to clear its slot */
const travelOf = (line: Element) => travels.get(line) ?? SWAP.travel

/** The copy laid over a block of text, split the given way: made the first time it's asked for, and made again if
 *  it was split the other way. */
function ghostOf(el: HTMLElement, type: 'lines' | 'words') {
  let g = ghosts.get(el)
  if (g && g.type !== type) {
    dropGhost(el)
    g = undefined
  }
  if (!g) {
    const ghost = el.cloneNode(true) as HTMLElement
    ghost.removeAttribute('data-slide-head')
    ghost.removeAttribute('id')
    ghost.setAttribute('aria-hidden', 'true')
    ghost.setAttribute('data-ghost', '') // so it's never taken for the text it copies
    ghost.inert = true // nor its links and buttons for real ones: the keyboard's focus never lands in it
    Object.assign(ghost.style, { position: 'absolute', left: '0px', top: '0px', width: `${el.getBoundingClientRect().width}px`, margin: '0', pointerEvents: 'none' })
    el.after(ghost)
    // wherever its containing block is, move it onto the original
    const a = el.getBoundingClientRect()
    const b = ghost.getBoundingClientRect()
    Object.assign(ghost.style, { left: `${a.left - b.left}px`, top: `${a.top - b.top}px` })
    el.style.visibility = 'hidden'
    g = { ghost, type, split: type === 'lines' ? SplitText.create(ghost, { type: 'lines', mask: 'lines' }) : SplitText.create(ghost, { type: 'words' }) }
    if (type === 'lines') {
      const em = parseFloat(getComputedStyle(el).fontSize)
      for (const line of g.split.lines as HTMLElement[]) {
        if (!line.querySelector(BLEED.selector)) continue
        const [up, down] = [BLEED.up * em, BLEED.down * em]
        Object.assign(line.parentElement!.style, { overflow: 'visible', clipPath: `inset(${-up}px -100vw ${-down}px)` })
        travels.set(line, SWAP.travel + (100 * (up + down)) / line.offsetHeight)
      }
    }
    ghosts.set(el, g)
  }
  return g
}

const ghostLines = (el: HTMLElement) => ghostOf(el, 'lines').split.lines as HTMLElement[]

/** A text's words, and the pictures set among them (about's heading has one), in reading order. */
function ghostWords(el: HTMLElement) {
  const { ghost, split } = ghostOf(el, 'words')
  const pieces = [...(split.words as HTMLElement[]), ...ghost.querySelectorAll<HTMLElement>('img')]
  return pieces.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
}

function dropGhost(el: HTMLElement) {
  const g = ghosts.get(el)
  if (!g) return
  g.split.revert()
  g.ghost.remove()
  el.style.visibility = ''
  ghosts.delete(el)
}

/** Lays the copies down (all of them, or those in one section), showing the real text. A copy's lines are measured
 *  for the layout it was made in, so one made a while ago is laid down and made again before it moves. */
export function dropGhosts(within?: HTMLElement) {
  for (const el of [...ghosts.keys()]) if (!within || within.contains(el)) dropGhost(el)
}

/** The lines of some text blocks. A block marked data-slide-head-block (the work toggle row) isn't text: its children
 *  are its lines, and it masks them itself while they move. */
function linesOf(els: HTMLElement[]) {
  const lines: HTMLElement[] = []
  const blocks: HTMLElement[] = []
  const texts: HTMLElement[] = []
  for (const el of els) {
    if (el.hasAttribute('data-slide-head-block')) {
      blocks.push(el)
      lines.push(...(el.children as unknown as HTMLElement[]))
    } else {
      texts.push(el)
      lines.push(...ghostLines(el))
    }
  }
  return { lines, blocks, texts }
}

/** The words of some headings. A block marked data-slide-head-block (the work toggle row) isn't text: the things in
 *  its row are its words. */
function wordsOf(els: HTMLElement[]) {
  const words: HTMLElement[] = []
  const texts: HTMLElement[] = []
  for (const el of els) {
    if (el.hasAttribute('data-slide-head-block')) {
      const row = el.children.length === 1 ? el.children[0] : el
      words.push(...(row.children as unknown as HTMLElement[]))
    } else {
      texts.push(el)
      words.push(...ghostWords(el))
    }
  }
  return { words, texts }
}
const blurred = { opacity: 0, filter: `blur(${WORDS.blur}px)` }

/** Headings coming in: each word fades in from blurred to sharp, a moment after the one before. */
function wordsIn(els: HTMLElement[]) {
  const { words, texts } = wordsOf(els)
  const tl = gsap.timeline({
    onComplete: () => {
      texts.forEach(dropGhost)
      set(words, { clearProps: 'opacity,filter' })
    },
  })
  if (words.length)
    tl.fromTo(words, blurred, { opacity: 1, filter: 'blur(0px)', duration: WORDS.duration, ease: WORDS.ease, stagger: spaced(words.length, WORDS.stagger, WORDS.spread) }, 0)
  return tl
}

// a little slack above and below, so a control that pokes out of its row (the pin switch) isn't trimmed
const MASK = 'inset(-8px -100vw)'

type LineMotion = { duration: number; stagger: number; ease: string }
const LINES_SPREAD = 0.3 // the most a block's line-by-line stagger adds up to (the hero's copy runs to a dozen lines)

/** Lines rolling into their slots: up from below going forward, down from above going back (the last line first,
 *  as it's the one nearest where they come from). */
function linesIn(els: HTMLElement[], dir: number, m: LineMotion) {
  const { lines, blocks, texts } = linesOf(els)
  const tl = gsap.timeline({
    onComplete: () => {
      texts.forEach(dropGhost)
      set([...blocks, ...lines], { clearProps: 'clipPath,transform,opacity' })
    },
  })
  set(blocks, { clipPath: MASK })
  if (lines.length)
    tl.fromTo(
      lines,
      { yPercent: (_: number, line: Element) => dir * travelOf(line), opacity: 0 },
      { yPercent: 0, opacity: 1, duration: m.duration, ease: m.ease, stagger: { each: spaced(lines.length, m.stagger, LINES_SPREAD), from: dir > 0 ? 'start' : 'end' } },
      0,
    )
  return tl
}

/** Lines rolling out of their slots: up going forward, down going back. A slight fade goes with them. */
function linesOut(els: HTMLElement[], dir: number, m: LineMotion) {
  const { lines, blocks } = linesOf(els)
  const tl = gsap.timeline()
  set(blocks, { clipPath: MASK })
  if (lines.length)
    tl.to(lines, { yPercent: (_: number, line: Element) => -dir * travelOf(line), opacity: 0, duration: m.duration, ease: m.ease, stagger: { each: spaced(lines.length, m.stagger, LINES_SPREAD), from: dir > 0 ? 'start' : 'end' } }, 0)
  return tl
}

const headsOf = (slide: HTMLElement) => all(slide, '[data-slide-head]')
const headIn = (slide: HTMLElement) => wordsIn(headsOf(slide))
const headOut = (slide: HTMLElement, dir: number) => linesOut(headsOf(slide), dir, { duration: SWAP.outDuration, stagger: SWAP.outStagger, ease: EASE.leave })

/** The rest of a section leaving: a fade, drifting the way the deck is moving. */
function driftOut(tl: gsap.core.Timeline, targets: Element[], dir: number) {
  if (targets.length) tl.to(targets, { opacity: 0, y: -dir * SWAP.drift, duration: SWAP.contentOut, ease: 'power2.in' }, 0)
}

// ----- hero -----

const copyOf = (hero: HTMLElement) => all(hero, '.about__copy > p:not([data-ghost])')
const heroFades = (hero: HTMLElement) => all(hero, '.chat, .divider, .about__note, .worked, .ball-field')
// The white that grows out of the card. It lies over the photo and the chat but under the card, so the copy is
// seen rolling out of its slots while it grows, and once it has grown the card is lost in it: one white screen.
const veilOf = (hero: HTMLElement) => hero.querySelector<HTMLElement>('.stage__veil')!

/** The white card's outline, as a clip-path on the veil (which covers the whole stage). */
function cardClip(hero: HTMLElement) {
  const card = hero.querySelector('.about')!
  const c = card.getBoundingClientRect()
  const d = veilOf(hero).getBoundingClientRect()
  const r = parseFloat(getComputedStyle(card).borderTopLeftRadius) || 0
  return `inset(${c.top - d.top}px ${d.right - c.right}px ${d.bottom - c.bottom}px ${c.left - d.left}px round ${r}px)`
}
const FULL = 'inset(0px 0px 0px 0px round 0px)'

/** Hero leaving for work: the copy rolls up out of its slots, the chat fades, the white card grows over the screen. */
function heroLeave(hero: HTMLElement) {
  const tl = gsap.timeline()
  const veil = veilOf(hero)
  tl.add(linesOut(copyOf(hero), 1, { duration: HERO.copyOut, stagger: HERO.copyStagger, ease: EASE.leave }), 0)
  const fades = heroFades(hero)
  if (fades.length) tl.to(fades, { opacity: 0, duration: HERO.fadeOut, ease: 'power2.out' }, 0)
  tl.fromTo(veil, { visibility: 'visible', clipPath: cardClip(hero) }, { clipPath: FULL, duration: HERO.growDuration, ease: EASE.travel, immediateRender: false }, HERO.growAt)
  return tl
}

/** Back to the hero: the white shrinks onto the card, the copy drops back into its slots and the chat returns. */
function heroArrive(hero: HTMLElement) {
  const fades = heroFades(hero)
  const veil = veilOf(hero)
  const tl = gsap.timeline({ onComplete: () => set(fades, { clearProps: 'opacity' }) })
  tl.fromTo(veil, { visibility: 'visible', clipPath: FULL }, { clipPath: cardClip(hero), duration: HERO.shrinkDuration, ease: EASE.travel, immediateRender: false }, 0)
  // the white has landed exactly on the card's own white: it goes, and the card carries on
  tl.call(() => lift(veil), undefined, HERO.shrinkDuration)
  tl.add(linesIn(copyOf(hero), -1, { duration: HERO.copyIn, stagger: HERO.copyInStagger, ease: EASE.arrive }), HERO.copyInAt)
  if (fades.length) tl.fromTo(fades, { opacity: 0 }, { opacity: 1, duration: HERO.fadeIn, ease: 'power2.out' }, HERO.copyInAt)
  return tl
}

/** Puts the white away. */
const lift = (veil: HTMLElement) => {
  veil.classList.remove('is-over')
  gsap.set(veil, { visibility: 'hidden', clearProps: 'clipPath' })
}

/**
 * The hero while the reader is down the page: under the white, which lies over the whole of it, card and all
 * (.stage__veil.is-over). Scrolled back up past the top of work, even for a moment before the hand-over back has
 * started, all that shows of it is that white, which then shrinks back onto the card.
 */
export function heroAway(hero: HTMLElement) {
  const veil = veilOf(hero)
  veil.classList.add('is-over')
  gsap.set(veil, { visibility: 'visible', clipPath: FULL })
}
/** The hero as it rests (the hand-over turned off, a narrow screen). */
export function heroHome(hero: HTMLElement) {
  lift(veilOf(hero))
  dropGhosts(hero)
  set(heroFades(hero), { clearProps: 'opacity' })
}

// ----- work -----

const tilesOf = (slide: HTMLElement) => all(slide, '.wall__tile')

/** The tiles on screen, in reading order: row by row, left to right. */
function tilesInView(slide: HTMLElement) {
  return tilesOf(slide)
    .map((el) => ({ el, r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 0 && r.bottom > 0 && r.top < innerHeight)
    .sort((a, b) => Math.round(a.r.top / 40) - Math.round(b.r.top / 40) || a.r.left - b.r.left)
    .map(({ el }) => el)
}

/** Work's toggle comes in word by word; the tiles come up on their own as they scroll into view (lib/reveal.ts). */
function workEnter(slide: HTMLElement) {
  return gsap.timeline().add(headIn(slide), 0)
}

function workExit(slide: HTMLElement, dir: number) {
  const tl = gsap.timeline()
  tl.add(headOut(slide, dir), 0)
  driftOut(tl, tilesInView(slide), dir)
  return tl
}

// ----- timeline -----

const timelineGroup = (slide: HTMLElement) => all(slide, '.tl__board, .tl__years, .tlc').filter((el, _, list) => !list.some((o) => o !== el && o.contains(el)))

/**
 * The line, read once: its length, and its height at a given x.
 * The line runs left to right, so x only ever grows along it.
 */
function readLine(path: SVGPathElement) {
  const length = path.getTotalLength()
  const n = 160
  const xs = new Float32Array(n + 1)
  const ys = new Float32Array(n + 1)
  for (let i = 0; i <= n; i++) {
    const p = path.getPointAtLength((i / n) * length)
    xs[i] = p.x
    ys[i] = p.y
  }
  const find = (x: number) => {
    if (x <= xs[0]) return { i: 0, f: 0 }
    if (x >= xs[n]) return { i: n - 1, f: 1 }
    let lo = 0
    let hi = n
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (xs[mid] < x) lo = mid
      else hi = mid
    }
    return { i: lo, f: (x - xs[lo]) / (xs[hi] - xs[lo] || 1) }
  }
  return {
    length,
    x0: xs[0],
    yAt: (x: number) => {
      const { i, f } = find(x)
      return ys[i] + (ys[i + 1] - ys[i]) * f
    },
  }
}

let rolled = false // the line has drawn and the marbles rolled since the page loaded

function timelineEnter(slide: HTMLElement, dir: number) {
  const tl = gsap.timeline()
  tl.add(headIn(slide), 0)
  const group = timelineGroup(slide)
  const svg = slide.querySelector<SVGSVGElement>('.tl__svg')
  const path = svg?.querySelector<SVGPathElement>(':scope > path')
  if (!svg || !path) {
    // the phone's upright line has no draw of its own: it comes up with the heading
    if (group.length) tl.fromTo(group, { opacity: 0, y: dir * SWAP.drift }, { opacity: 1, y: 0, duration: TILES.duration, ease: EASE.settle, clearProps: 'opacity,transform' }, LINE.at)
    return tl
  }
  const dots = all<SVGCircleElement>(svg, ':scope > circle')
  // whatever an entrance cut short left on the line and its dots goes
  gsap.set(path, { clearProps: 'strokeDasharray,strokeDashoffset' })
  set(dots, { clearProps: 'opacity,transform,transformOrigin' })
  const first = !rolled
  rolled = true
  let labelsAt: number

  if (first) {
    if (group.length) tl.set(group, { clearProps: 'opacity,transform' }, LINE.at)
    // The line can change shape as the marbles roll (hovering a period lifts the bump under it, and the dots' resting
    // heights with it), so they follow where it is now, read again whenever it has moved, not where it was.
    let shape = path.getAttribute('d')
    let line = readLine(path)
    const now = () => {
      const d = path.getAttribute('d')
      if (d !== shape) {
        shape = d
        line = readLine(path)
      }
      return line
    }
    tl.fromTo(path, { strokeDasharray: line.length, strokeDashoffset: line.length }, { strokeDashoffset: 0, duration: LINE.draw, ease: LINE.ease, clearProps: 'strokeDasharray,strokeDashoffset' }, LINE.at)
    const rollAt = LINE.at + LINE.draw - MARBLES.overlap
    const cx = (d: SVGCircleElement) => d.cx.baseVal.value
    const cy = (d: SVGCircleElement) => d.cy.baseVal.value
    const far = Math.max(1, ...dots.map((d) => cx(d) - line.x0 + d.r.baseVal.value + 1))
    // Placed again whenever the line changes, too. It's redrawn in a frame callback of its own (Timeline.tsx) that
    // can run after this frame's tick, and a marble placed before that would be painted where the line was.
    const rolling = new Set<() => void>()
    const watch = new MutationObserver(() => {
      if (!tl.isActive()) return watch.disconnect() // cut short
      rolling.forEach((place) => place())
    })
    tl.call(() => watch.observe(path, { attributes: true, attributeFilter: ['d'] }), undefined, rollAt)
    let stopped = rollAt
    dots
      .sort((a, b) => cx(b) - cx(a))
      .forEach((dot, i) => {
        const tx = cx(dot)
        // from just off the start of the line (off the screen's edge), so each one rolls in whole rather than
        // appearing on the line: a grow from nothing would also be scaled about where the dot was when it set off,
        // which isn't where it is once the line has moved
        const from = line.x0 - dot.r.baseVal.value - 1
        const run = tx - from
        const setX = gsap.quickSetter(dot, 'x', 'px')
        const setY = gsap.quickSetter(dot, 'y', 'px')
        // rolling along the line, so over the bump it rides the bump; its own resting height moves with the line too
        const roll = { p: 0 }
        const place = () => {
          const x = from + run * roll.p
          setX(x - tx)
          setY(now().yAt(x) - cy(dot))
        }
        gsap.set(dot, { opacity: 0, x: from - tx, y: line.yAt(from) - cy(dot) })
        const at = rollAt + i * MARBLES.stagger
        const duration = MARBLES.near + MARBLES.far * (run / far)
        tl.set(dot, { opacity: 1 }, at)
        tl.to(roll, { p: 1, duration, ease: MARBLES.ease, onStart: () => void rolling.add(place), onUpdate: place, onComplete: () => void rolling.delete(place) }, at)
        // stopped at its year, it's handed back to the line, which keeps it on itself however it moves from here
        tl.set(dot, { clearProps: 'opacity,transform' }, at + duration)
        stopped = Math.max(stopped, at + duration)
      })
    tl.call(() => watch.disconnect(), undefined, stopped)
    labelsAt = stopped - LABELS.overlap
  } else {
    if (group.length) tl.fromTo(group, { opacity: 0 }, { opacity: 1, duration: LINE.again, ease: EASE.settle, clearProps: 'opacity,transform' }, LINE.at)
    labelsAt = LINE.at + LABELS.againAt
  }

  // The period headings and years, left to right. They rise by their margin, not a transform: they're placed with
  // CSS `translate` (the headings hang above the line by their own height), which a GSAP transform would replace
  // while it ran, dropping them onto the line.
  const byX = (els: HTMLElement[]) => els.map((el) => ({ el, x: el.getBoundingClientRect().left })).sort((a, b) => a.x - b.x).map((e) => e.el)
  const labels = byX(all(slide, '.tl__head, .tl__years > li'))
  const each = spaced(labels.length, LABELS.stagger, LABELS.spread)
  if (labels.length)
    tl.fromTo(
      labels,
      { marginTop: LABELS.y, opacity: 0 },
      { marginTop: 0, opacity: 1, duration: LABELS.duration, stagger: each, ease: EASE.settle, clearProps: 'opacity,marginTop' },
      labelsAt,
    )
  // Then the photos open out from their middles, each picture settling inside its frame as it opens. The frame itself
  // is only clipped: its tilt is an inline `rotate` of React's (and its fade-in belongs to its own loading, see
  // .tl__blob), which a transform of GSAP's would wipe for good.
  const photos = byX(all(slide, '.tl__media > .tl__blob:not(.is-leaving)'))
  const photosAt = labelsAt + each * Math.max(0, labels.length - 1) + PHOTOS.after
  if (photos.length) {
    const open = { duration: PHOTOS.duration, stagger: PHOTOS.stagger, ease: EASE.arrive }
    tl.fromTo(photos, { clipPath: 'inset(50% 50% 50% 50% round 24px)' }, { ...open, clipPath: 'inset(0% 0% 0% 0% round 24px)', clearProps: 'clipPath' }, photosAt)
    const pictures = photos.map((b) => b.firstElementChild).filter((el): el is HTMLElement => !!el)
    tl.fromTo(pictures, { scale: PHOTOS.zoom }, { ...open, scale: 1, clearProps: 'transform' }, photosAt)
  }
  return tl
}

// ----- about -----

// The box itself is moved every frame by its physics (AboutMe.tsx), so its entrance moves what holds it.
const stageOf = (slide: HTMLElement) => slide.querySelector<HTMLElement>('.toybox__stage')
const dollOf = (slide: HTMLElement) => slide.querySelector<HTMLElement>('.collage__doll')
const dollNoteOf = (slide: HTMLElement) => slide.querySelector<HTMLElement>('.collage__note--me')
let walked = false // since the page loaded: a reload walks it in again

/**
 * The character walks in from the left. Each stride is tied to the ground covered rather than the clock, so as the
 * walk slows for the last step the legs slow with it, and it comes to a stop standing exactly as it rests.
 */
function walkIn(slide: HTMLElement) {
  const tl = gsap.timeline()
  const doll = dollOf(slide)
  const note = dollNoteOf(slide)
  // hidden on phones: left showing, in case the phone is turned and it appears
  if (!doll || !doll.offsetWidth) return set(present(doll, note), { clearProps: 'opacity' }), tl
  const legs = all(slide, '.collage__leg')
  set([doll, ...legs], { clearProps: 'transform' })
  if (walked) {
    tl.fromTo(present(doll, note), { opacity: 0 }, { opacity: 1, duration: WALK.again, ease: EASE.settle, clearProps: 'opacity' }, 0)
    return tl
  }
  walked = true
  const rest = legs.map((leg) => Number(gsap.getProperty(leg, 'rotation')) || 0)
  const off = doll.getBoundingClientRect().right + 24 // all the way off the left edge
  // its whole starting pose in one go, so it can't be seen standing in place for a frame first
  gsap.set(doll, { opacity: 1, x: -off, y: 0, rotation: 0, transformOrigin: '50% 100%' })
  const setX = gsap.quickSetter(doll, 'x', 'px')
  const setY = gsap.quickSetter(doll, 'y', 'px')
  const setR = gsap.quickSetter(doll, 'rotation', 'deg')
  const legR = legs.map((leg) => gsap.quickSetter(leg, 'rotation', 'deg'))
  const walk = { p: 0 }
  const pose = () => {
    const s = Math.sin(walk.p * WALK.steps * Math.PI) // a stride per half turn: 0 with the legs together
    setX(-off * (1 - walk.p))
    setY(WALK.bob * Math.abs(s))
    setR(WALK.sway * s)
    legR.forEach((r, i) => r(rest[i] + (i % 2 ? 1 : -1) * WALK.legSwing * s))
  }
  pose()
  tl.to(walk, { p: 1, duration: WALK.duration, ease: WALK.ease, onUpdate: pose }, 0)
  tl.set([doll, ...legs], { clearProps: 'transform,transformOrigin' })
  if (note) tl.fromTo(note, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.5, ease: EASE.settle, clearProps: 'opacity,transform' }, WALK.duration + WALK.noteAfter)
  return tl
}

/** The box set down: from a little nearer the eye, falling to the blanket, giving a touch as it lands. */
function boxIn(slide: HTMLElement) {
  const tl = gsap.timeline()
  const stage = stageOf(slide)
  if (!stage) return tl
  if (flag('session', BOX.flag, true)) {
    tl.fromTo(stage, { opacity: 0, y: 0, scale: 1.03 }, { opacity: 1, scale: 1, duration: BOX.again, ease: EASE.settle, clearProps: 'opacity,transform' }, 0)
    return tl
  }
  const card = slide.querySelector<HTMLElement>('.toybox__cardboard')
  const note = slide.querySelector<HTMLElement>('.toybox__note')
  tl.fromTo(stage, { opacity: 0 }, { opacity: 1, duration: BOX.fall * 0.4, ease: 'power1.out' }, 0)
  tl.fromTo(stage, { y: 0, scale: 1 + BOX.lift, rotation: BOX.tilt, transformOrigin: '50% 60%' }, { scale: 1, rotation: 0, duration: BOX.fall, ease: 'power2.in' }, 0)
  // high up, its shadow falls far off and soft; it closes in under the box as it comes down
  if (card)
    tl.fromTo(
      card,
      { filter: 'drop-shadow(0px 70px 50px rgba(16, 28, 64, 0.14))' },
      { filter: 'drop-shadow(0px 22px 26px rgba(16, 28, 64, 0.38))', duration: BOX.fall, ease: 'power2.in', clearProps: 'filter' },
      0,
    )
  if (note) tl.fromTo(note, { opacity: 0 }, { opacity: 1, duration: 0.4, ease: 'power1.out', clearProps: 'opacity' }, BOX.fall + BOX.noteAfter)
  // the landing: the cardboard sinks a hair past its size and springs back, and the things inside hop
  tl.call(() => window.dispatchEvent(new Event('toybox:thump')), undefined, BOX.fall)
  tl.to(stage, { scale: 1 - BOX.give, duration: BOX.giveDuration, ease: 'power2.out' }, BOX.fall)
  tl.to(stage, { scale: 1, duration: BOX.settle, ease: 'power2.out', clearProps: 'opacity,transform,transformOrigin' }, BOX.fall + BOX.giveDuration)
  return tl
}

function aboutEnter(slide: HTMLElement) {
  const tl = gsap.timeline()
  tl.add(headIn(slide), 0)
  tl.add(walkIn(slide), WALK.at)
  tl.add(boxIn(slide), BOX.at)
  return tl
}

// ----- per section -----

/** A section arriving (dir 1 from above, -1 from below), as a timeline that starts by hiding what it brings. */
export function enter(slide: HTMLElement, dir: number): gsap.core.Timeline {
  dropGhosts(slide)
  const kind = kindOf(slide)
  if (kind === 'work') return workEnter(slide)
  if (kind === 'timeline') return timelineEnter(slide, dir)
  if (kind === 'about') return aboutEnter(slide)
  return gsap.timeline()
}

/** A section's hidden state before it has entered: set from JS, so without it everything simply shows. (The work
 *  tiles are left to come up on their own as the page scrolls.) */
export function hide(slide: HTMLElement) {
  if (kindOf(slide) === 'hero') return
  set(wordsOf(headsOf(slide)).words, blurred)
  set(timelineGroup(slide), { opacity: 0 })
  set(present(stageOf(slide), dollOf(slide), dollNoteOf(slide)), { opacity: 0 })
}

/** A section back as it rests, out of sight once it has left (so scrolling to it shows it as it is). */
function settle(slide: HTMLElement) {
  dropGhosts(slide)
  const { lines, blocks } = linesOf(headsOf(slide).filter((h) => h.hasAttribute('data-slide-head-block')))
  set([...blocks, ...lines], { clearProps: 'clipPath,transform,opacity' })
  set(wordsOf(blocks).words, { clearProps: 'opacity,filter' })
  set(tilesOf(slide), { clearProps: 'opacity,transform' })
}

/**
 * Wide screens: the hero handing over to work, as one move. The copy rolls out of its slots, the chat fades, and the
 * white card grows over the screen; once it covers it, `land` moves the page down to work (unseen: it's the same
 * white), and work's toggle comes in. The hero stays under the white, out of sight above (heroAway). `unlockAt` is
 * when the next move can be taken.
 */
export function heroToWork(hero: HTMLElement, work: HTMLElement, land: () => void) {
  const tl = gsap.timeline()
  const at = HERO.beat + HERO.growAt + HERO.growDuration * HERO.handover
  tl.add(heroLeave(hero), HERO.beat)
  tl.call(
    () => {
      land()
      heroAway(hero)
      dropGhosts(hero)
      set(heroFades(hero), { clearProps: 'opacity' })
    },
    undefined,
    at,
  )
  tl.add(enter(work, 1), at)
  return { tl, unlockAt: at + SWAP.unlockAfter }
}

/**
 * And back, from the top of work: its toggle rolls down out of its row and the tiles drift down; the white goes up
 * over the screen, `land` moves the page up to the hero under it, and it shrinks onto the card as the copy drops back
 * into its slots. Work is put back as it was, out of sight below.
 */
export function workToHero(work: HTMLElement, hero: HTMLElement, land: () => void) {
  const tl = gsap.timeline()
  const out = workExit(work, -1)
  tl.add(out, 0)
  const at = out.duration()
  tl.call(
    () => {
      gsap.set(veilOf(hero), { visibility: 'visible', clipPath: FULL })
      // back under the card, which is as white as it is, its contents all still out of sight (heroArrive)
      veilOf(hero).classList.remove('is-over')
      land()
      settle(work)
    },
    undefined,
    at,
  )
  tl.add(heroArrive(hero), at)
  return { tl, unlockAt: at + HERO.shrinkDuration }
}

/**
 * Back to the hero when the reader is already looking at it: scrolled up past the top of work in one go, so the white
 * lying over the hero (heroAway) is what's showing. No going back down to work to see it leave: the white just
 * shrinks onto the card as the copy drops into its slots, from where they are.
 */
export function heroBack(hero: HTMLElement, work: HTMLElement, land: () => void) {
  const tl = gsap.timeline()
  tl.call(
    () => {
      gsap.set(veilOf(hero), { visibility: 'visible', clipPath: FULL })
      veilOf(hero).classList.remove('is-over') // back under the card, its contents all still out of sight (heroArrive)
      land()
      settle(work)
    },
    undefined,
    0,
  )
  tl.add(heroArrive(hero), 0)
  return { tl, unlockAt: HERO.shrinkDuration }
}

/** How much faster a section comes in when the reader gets to it fast (a flick that carries on past where they meant
 *  to stop) or lands already partway into it: the same sequence, quicker, so nothing is left blank for long. */
export const HURRY = {
  speed: 1400, // px/s of scrolling above which they're moving fast
  most: 3.5, // the most it's sped up
}

export { gsap }
