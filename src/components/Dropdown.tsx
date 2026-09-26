import { useEffect, useRef, useState } from 'react'

type Props = { label: string; value: string[]; options: string[]; onChange: (v: string[]) => void }

/**
 * A pill-shaped filter with a menu of options (Figma node 919:16952). More than one option can be ticked; the
 * menu stays open while picking, and the pill reads "All" when nothing is ticked, else the ticked options.
 */
export default function Dropdown({ label, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const picked = (o: string) => value.some((v) => v.toLowerCase() === o.toLowerCase())
  const toggle = (o: string) => onChange(picked(o) ? value.filter((v) => v.toLowerCase() !== o.toLowerCase()) : [...value, o])
  // keep the pill's text in the menu's order, whatever order things were ticked in
  const shown = options.filter(picked)

  return (
    <div className="dd" ref={root}>
      <button type="button" className={`dd__btn${shown.length ? ' is-on' : ''}${open ? ' is-open' : ''}`} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="dd__label">{label} :</span>
        <span className="dd__value">{shown.length ? shown.join(', ') : 'All'}</span>
        <svg className="dd__chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="dd__menu" role="listbox" aria-label={label} aria-multiselectable="true">
          {options.map((o) => (
            <li key={o} role="option" aria-selected={picked(o)}>
              <button type="button" className={picked(o) ? 'is-picked' : ''} onClick={() => toggle(o)}>
                {o}
                {picked(o) && (
                  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
                    <path d="M4 10.5 8 14.5 16 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
