import { useState } from 'react'
import Ticker from './Ticker'
import { findLogo } from '../lib/logos'

/** A place in the "rudrapur → roorkee → mumbai" line, with a small note that appears on hover or focus. */
function Place({ children, note, past = false }: { children: React.ReactNode; note: string; past?: boolean }) {
  const Tag = past ? 's' : 'span'
  return (
    <span className="place" tabIndex={0} aria-label={note}>
      <Tag>{children}</Tag>
      <span className="place__note" aria-hidden>
        {note}
      </span>
    </span>
  )
}

const EMAIL = 'heyiamsnehajain@gmail.com'

/**
 * On phones and tablets the chat beside the hero is dropped (typing a message into a fake chat is fiddly on a
 * touch keyboard), so its two useful bits sit under the text instead: the resume, and the email address.
 */
function HeroActions() {
  const [copied, setCopied] = useState(false)
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
    <div className="about__ctas">
      <a className="cta cta--resume" href="/Sneha%20Jain%20Resume.pdf" download="Sneha Jain Resume.pdf">
        download resume
        <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
          <path d="M8 2.5v9m0 0-3.5-3.5M8 11.5l3.5-3.5M3 14h10" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
      <button type="button" className={`cta${copied ? ' is-copied' : ''}`} onClick={copy} aria-label={copied ? 'Email copied' : `Copy email address, ${EMAIL}`}>
        {copied ? 'copied ✓' : 'copy email'}
        {!copied && (
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden>
            <rect x="5" y="5" width="8.5" height="8.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 10.5V4a1.5 1.5 0 0 1 1.5-1.5H11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </div>
  )
}

export default function About() {
  const juspay = findLogo('Juspay')
  return (
    <section className="about">
      <p className="about__note">
        do not question my design decisions.
        <br />i did not question them myself.
      </p>

      <div className="about__copy">
        <p data-reveal>
          i am <span className="chip">sneha</span>, a product designer from
          <br />
          <Place past note="where it all started">
            rudrapur 🍼
          </Place>{' '}
          →{' '}
          <Place past note="IIT Roorkee, B.Tech ’23">
            roorkee 🎓
          </Place>{' '}
          →{' '}
          <Place note="home, for now">mumbai 💼</Place>
        </p>
        <p data-reveal>
          before i was a designer, i was a kid frantically following along to{' '}
          <a className="purple" href="https://youtu.be/YDi9-uXXRfc?si=Izbf_ubp6q1wHw8t" target="_blank" rel="noreferrer">
            Art Attack
          </a>{' '}
          and devouring the tutorials on{' '}
          <a className="pink" href="https://www.arvindguptatoys.com/toys.html" target="_blank" rel="noreferrer">
            arvindguptatoys.com
          </a>
          .
        </p>
        <p data-reveal>
          these days, i’m getting my hands dirty in the world of payments at{' '}
          {juspay ? <img className="inline-logo" src={juspay.src} alt="Juspay" /> : 'Juspay'}.
        </p>
        <p data-reveal>
          i may not have 8 years of experience, but give me a weekend and an ominous deadline and i can lowkey learn anything.
        </p>
        <HeroActions />
      </div>

      <footer className="worked">
        <span className="worked__label">worked with</span>
        <Ticker />
      </footer>
    </section>
  )
}
