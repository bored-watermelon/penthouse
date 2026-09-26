import { useEffect, useState } from 'react'

// The phone's motion sensors, shared by the about box (shake the phone to shake the box) and the footer (the
// eyes on the resume pill follow the phone's tilt). iPhones only hand these over once the visitor has tapped to
// allow it; everywhere else they just arrive. Only touch devices use them: a laptop's are no use here.

type Asker = { requestPermission?: () => Promise<'granted' | 'denied'> }
const motionApi = typeof DeviceMotionEvent !== 'undefined' ? (DeviceMotionEvent as unknown as Asker) : undefined
const tiltApi = typeof DeviceOrientationEvent !== 'undefined' ? (DeviceOrientationEvent as unknown as Asker) : undefined
// Only iPhones and iPads actually ask (iPadOS says it's a Mac); other browsers may have the function but just say yes.
const apple = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1
const mustAsk = apple && typeof motionApi?.requestPermission === 'function'

let state: 'granted' | 'denied' | 'unasked' = mustAsk ? 'unasked' : 'granted'
const subs = new Set<() => void>()

/** Asks for the sensors. Must run straight from a tap (iOS only shows its prompt in response to one). */
export async function askMotion() {
  if (!mustAsk) return true
  try {
    // both at once, inside the same tap; on iOS they share one permission, so this is one prompt
    const [m, t] = await Promise.all([motionApi!.requestPermission!(), tiltApi?.requestPermission?.() ?? Promise.resolve('granted' as const)])
    state = m === 'granted' && t === 'granted' ? 'granted' : 'denied'
  } catch {
    state = 'denied'
  }
  subs.forEach((f) => f())
  return state === 'granted'
}

export const isTouchDevice = () => matchMedia('(hover: none) and (pointer: coarse)').matches

/** Whether the sensors can be used yet, and whether a tap is still needed to allow them. */
export function useMotionAccess() {
  const [, bump] = useState(0)
  useEffect(() => {
    const f = () => bump((n) => n + 1)
    subs.add(f)
    return () => {
      subs.delete(f)
    }
  }, [])
  return { allowed: state === 'granted', needsTap: state === 'unasked', ask: askMotion }
}

/**
 * A sensor reading turned into screen directions (x right, y down), whichever way the phone is being held. The
 * sensors report in the phone's own frame, which turns with it; the page doesn't.
 */
export function toScreen(x: number, y: number) {
  const angle = ((screen.orientation?.angle ?? (window as unknown as { orientation?: number }).orientation ?? 0) + 360) % 360
  if (angle === 90) return { x: -y, y: -x }
  if (angle === 180) return { x: -x, y }
  if (angle === 270) return { x: y, y: x }
  return { x, y: -y }
}
