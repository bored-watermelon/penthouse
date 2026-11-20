import { useSyncExternalStore } from 'react'

/**
 * The landing intro (Loader.tsx): a white screen counting to 100 while the hero's photo loads, which then shrinks
 * into the hero's white card. It only plays when someone lands on the home page, and only the first time in a tab;
 * a case study opened directly starts as it always did.
 *
 * While it plays, <html> carries two classes: is-loading (the page can't scroll under it) and is-intro (the hero's
 * grey words start out dark, then fade to their grey once the card is showing, see .about__copy). Set here, as the
 * module loads, so they're on before the first paint.
 */
const SEEN = 'intro-seen'
const seen = () => {
  try {
    return sessionStorage.getItem(SEEN) === '1'
  } catch {
    return false
  }
}
// Once per visit: coming back to the home page in the same tab (a reload, back from a case study) skips straight to it.
// the landing screen is off for now; to bring it back, put back: location.pathname === '/' && !seen()
export const introWanted = false && location.pathname === '/' && !seen()

let done = !introWanted
const listeners = new Set<() => void>()
if (introWanted) document.documentElement.classList.add('is-loading', 'is-intro')

/** The white has landed on the card: the page is free, and the chat can start. */
export function finishIntro() {
  if (done) return
  done = true
  try {
    sessionStorage.setItem(SEEN, '1')
  } catch {
    /* storage blocked: it just plays again next time */
  }
  document.documentElement.classList.remove('is-loading')
  listeners.forEach((l) => l())
  // a beat with the whole sentence dark, then the joining words step back and leave the dark ones standing
  window.setTimeout(() => document.documentElement.classList.remove('is-intro'), 500)
}

export function useIntroDone() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => done,
  )
}
