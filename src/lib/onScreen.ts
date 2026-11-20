import { useEffect, type RefObject } from 'react'

/**
 * Tells a component when one of its elements can actually be seen, so a loop that redraws every frame (the hero's
 * ball and logo ticker, the about box's physics) only runs while there's something to look at.
 */
export function watchOnScreen(el: Element, onChange: (seen: boolean) => void) {
  let was: boolean | null = null
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting === was) return
    was = e.isIntersecting
    onChange(was)
  })
  io.observe(el)
  return () => io.disconnect()
}

/**
 * A silent looping clip plays only while it can be seen. Until then it has only fetched its first few bytes (it's
 * given preload="metadata" and no autoPlay), rather than downloading whole as the page opens.
 */
export function usePlayWhenSeen(video: RefObject<HTMLVideoElement | null>) {
  useEffect(() => {
    const v = video.current
    if (!v) return
    return watchOnScreen(v, (seen) => (seen ? void v.play().catch(() => {}) : v.pause()))
  }, [video])
}
