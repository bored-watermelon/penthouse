import { useEffect, useState } from 'react'

const EMAIL = 'heyiamsnehajain@gmail.com'

/**
 * A small floating pill, centred along the bottom, with the two things a recruiter is actually after: the resume,
 * and a way to reach her, one tap away from anywhere. It stays out of the way on the hero, where the chat already
 * offers both, and over the footer, which has its own.
 */
export default function Dock() {
  const [shown, setShown] = useState(false)
  const [copied, setCopied] = useState(false)

  // visible between the hero and the footer
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const stage = document.querySelector('.stage')
      const spacer = document.querySelector('.foot-spacer')
      const pastHero = stage ? stage.getBoundingClientRect().bottom < innerHeight * 0.35 : true
      const beforeFooter = spacer ? spacer.getBoundingClientRect().top > innerHeight * 0.85 : true
      setShown(pastHero && beforeFooter)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    update()
    return () => {
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.location.href = `mailto:${EMAIL}`
    }
  }

  return (
    <nav className={`dock${shown ? ' is-shown' : ''}`} aria-label="Resume and contact" inert={!shown}>
      <a className="dock__item dock__item--cta" href="/Sneha%20Jain%20Resume.pdf" download="Sneha Jain Resume.pdf">
        resume
        <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
          <path d="M8 2.5v9m0 0-3.5-3.5M8 11.5l3.5-3.5M3 14h10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
      <button type="button" className={`dock__item dock__item--mail${copied ? ' is-copied' : ''}`} onClick={copy} aria-label={copied ? 'Email copied' : `Copy email address, ${EMAIL}`}>
        {copied ? (
          'copied ✓'
        ) : (
          <>
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
              <rect x="2.5" y="4.5" width="15" height="11" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M3.5 6l6.5 5 6.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="dock__mail-label">say hi</span>
          </>
        )}
      </button>
    </nav>
  )
}
