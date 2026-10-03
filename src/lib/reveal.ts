import { useEffect } from 'react'

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
          if (step) (e.target as HTMLElement).style.transitionDelay = `${Math.min(step, 5) * 70}ms`
          step++
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    )
    // a container's children are marked on the spot, so the CSS that hides them needs no separate rule
    const mark = (root: ParentNode) =>
      root.querySelectorAll('[data-reveal-children]').forEach((group) => {
        for (const child of group.children) if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', '')
      })
    const watch = (root: ParentNode) => {
      mark(root)
      root.querySelectorAll('[data-reveal]:not(.is-in)').forEach((el) => io.observe(el))
    }
    watch(document)
    const mo = new MutationObserver((muts) =>
      muts.forEach((m) => {
        // a child appearing inside a group (the article's HTML, a filtered list) still needs marking
        if (m.target instanceof Element && m.target.hasAttribute('data-reveal-children')) watch(m.target.parentNode ?? document)
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
