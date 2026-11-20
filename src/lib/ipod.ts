// Where the iPod is: put away in the about box, out in the middle of the screen, or tucked into the bottom-left
// corner, still playing, while the rest of the site is used (see IpodHost in Ipod.tsx).

export type IpodPlace = 'away' | 'open' | 'docked'

let place: IpodPlace = 'away'
const watchers = new Set<() => void>()

export const ipod = {
  get: () => place,
  watch(fn: () => void) {
    watchers.add(fn)
    return () => void watchers.delete(fn)
  },
  moveTo(p: IpodPlace) {
    place = p
    watchers.forEach((fn) => fn())
  },
}

/** Takes the iPod out of the box (or back out of the corner) into the middle of the screen. */
export const openIpod = () => ipod.moveTo('open')
