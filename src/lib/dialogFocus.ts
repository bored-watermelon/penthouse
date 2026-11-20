import { useEffect, type RefObject } from 'react'

/**
 * A viewer takes the keyboard's focus while it's open, so the keys and a screen reader are in it and not on the page
 * behind it, and hands it back to whatever opened it (the thing in the box, the tile) when it closes. `open` false
 * (the iPod, docked in its corner) leaves the focus where it is.
 */
export function useDialogFocus(dialog: RefObject<HTMLElement | null>, open = true) {
  useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    dialog.current?.focus({ preventScroll: true })
    return () => {
      if (before?.isConnected) before.focus({ preventScroll: true })
    }
  }, [dialog, open])
}
