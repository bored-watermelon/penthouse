import { useEffect } from 'react'
import { SplitText } from 'gsap/SplitText'
import { gsap } from './slideMotion'

/** Text in a written-up piece (a case study) comes in a line at a time, each fading in from blurred to sharp. */
const LINES = { duration: 0.6, stagger: 0.08, blur: 8, ease: 'power2.out' }
// a piece of text to bring in line by line: one with nothing else of the kind inside it
const TEXT = 'h1, h2, h3, h4, p, li, figcaption, blockquote, .cs__stats > div'
// what comes up whole instead: pictures and clips, and the laid-out parts (an annotated sentence, iteration cards)
const BLOCK = 'figure, img, video, .cs-statement, .cs-iters__grid > *'

/**
 * Anything marked data-reveal eases in the first time it scrolls into view. A container marked
 * data-reveal-children does the same for each of its children, which is how a list or a grid gets its contents
 * one at a time without every item needing the attribute (and how the case study's article, which arrives as
 * a block of HTML, is covered at all).
 *
 * Things that come into view together cascade: the observer hands us one batch per frame, so a row of tiles
 * arriving at once is stepped rather than appearing in one lump. The step is capped, so a big batch — switching
 * to play with a screenful of tiles already in view — never turns into a long wait for the last one.
 *
 * A container marked data-reveal-text (a case study's write-up) is gone through more finely: each piece of text in it
 * comes in a line at a time as it's reached, fading in from blurred to sharp, and its pictures and laid-out parts
 * come up whole. Under data-reveal-seen (a case study already read this visit) it's all simply there.
 *
 * Elements added later (a new route, the play tab mounting) are picked up too. Without JS, or with reduced
 * motion, nothing is hidden in the first place: the hiding CSS only applies under html.js-reveal.
 */
export function useReveal(deps: unknown[] = []) {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    document.documentElement.classList.add('js-reveal')
    const io = new IntersectionObserver(
      (entries) => {
        let step = 0
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const el = e.target as HTMLElement
          io.unobserve(el)
          if (el.hasAttribute('data-reveal-lines')) {
            lines(el, Math.min(step, 5) * 0.07)
            step++
            continue
          }
          if (step) el.style.transitionDelay = `${Math.min(step, 5) * 70}ms`
          step++
          el.classList.add('is-in')
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    )
    // a container's children are marked on the spot, so the CSS that hides them needs no separate rule
    const mark = (root: ParentNode) => {
      root.querySelectorAll('[data-reveal-children]').forEach((group) => {
        for (const child of group.children) if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', '')
      })
      root.querySelectorAll('[data-reveal-text]').forEach((group) => {
        const blocks = [...group.querySelectorAll(BLOCK)].filter((el) => !el.parentElement?.closest(BLOCK))
        blocks.forEach((el) => el.hasAttribute('data-reveal-lines') || el.setAttribute('data-reveal', ''))
        group.querySelectorAll(TEXT).forEach((el) => {
          if (el.querySelector(TEXT) || el.closest(BLOCK) || el.hasAttribute('data-reveal-lines')) return
          el.setAttribute('data-reveal-lines', '')
        })
      })
    }
    const watch = (root: ParentNode) => {
      mark(root)
      root.querySelectorAll('[data-reveal]:not(.is-in), [data-reveal-lines]:not(.is-in)').forEach((el) => io.observe(el))
    }
    watch(document)
    const mo = new MutationObserver((muts) =>
      muts.forEach((m) => {
        // a child appearing inside a group (the article's HTML, a filtered list) still needs marking
        if (m.target instanceof Element && m.target.matches('[data-reveal-children], [data-reveal-text]')) watch(m.target.parentNode ?? document)
        m.addedNodes.forEach((n) => n instanceof Element && (n.matches('[data-reveal]') ? io.observe(n) : watch(n)))
      }),
    )
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

/** A piece of text coming in a line at a time, each line from blurred to sharp. Laid back as it was once in, so it
 *  rewraps as normal if the screen changes. */
function lines(el: HTMLElement, delay: number) {
  el.classList.add('is-in')
  if (el.closest('[data-reveal-seen]')) return
  const split = SplitText.create(el, { type: 'lines' })
  gsap.fromTo(
    split.lines,
    { opacity: 0, filter: `blur(${LINES.blur}px)` },
    { opacity: 1, filter: 'blur(0px)', duration: LINES.duration, ease: LINES.ease, stagger: LINES.stagger, delay, onComplete: () => split.revert() },
  )
}
