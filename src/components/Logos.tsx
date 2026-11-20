import { findLogo } from '../lib/logos'

/** "Juspay × Visa": each name as its file from /logos (or the name itself, if there isn't one), crossed. */
export default function Logos({ names }: { names: string[] }) {
  if (!names.length) return null
  return (
    <span className="logos">
      {names.map((name, i) => {
        const logo = findLogo(name)
        return (
          <span key={name} className="logos__one">
            {i > 0 && (
              <svg className="logos__x" width="12" height="12" viewBox="0 0 20 20" aria-label="×">
                <path d="M15.625 4.375 4.375 15.625M15.625 15.625 4.375 4.375" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {logo ? <img src={logo.src} alt={name} /> : <span className="logos__name">{name}</span>}
          </span>
        )
      })}
    </span>
  )
}
