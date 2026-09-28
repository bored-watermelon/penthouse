import { useEffect, useRef, useState } from 'react'
import Ticker from './Ticker'
import Basketball from './Basketball'
import { findLogo } from '../lib/logos'
import { heroImage, heroStar } from '../lib/heroAssets'

/**
 * A place in the "rudrapur → roorkee → mumbai" line; the past two are struck through. The emoji stays
 * upright and clear — it's a marker of what happened there, not part of the word that's being crossed out.
 */
function Place({ name, emoji, past = false }: { name: string; emoji?: string; past?: boolean }) {
  const Tag = past ? 's' : 'span'
  return (
    <span className="place">
      <Tag>{name}</Tag>
      {emoji && (
        <>
          {' '}
          <span className="place__emoji">{emoji}</span>
        </>
      )}
    </span>
  )
}

/**
 * The photo-and-name pair. The photo sits directly on top of the "sneha," chip, overlapping it a touch — both
 * are inline children of a flex-column wrapper, so the photo IS part of the paragraph's first line box. That
 * means the card's padding-top spaces the photo from the top, not the chip. Tapping either lights the stars.
 */
function Selfie() {
  const [lit, setLit] = useState(false)
  const timer = useRef(0)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  const flash = () => {
    setLit(true)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setLit(false), 2600)
  }
  return (
    <span className={`selfie${lit ? ' is-lit' : ''}`} onPointerDown={flash}>
      <span className="selfie__art">
        <img className="selfie__star selfie__star--red" src={heroStar.star1} alt="" aria-hidden draggable={false} />
        <img className="selfie__star selfie__star--gold" src={heroStar.star2} alt="" aria-hidden draggable={false} />
        <img className="selfie__photo" src={heroImage.me} alt="Sneha in a leopard-print beanie, a cat’s eyes held over her own" />
      </span>
      <span className="chip">sneha,</span>
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
        <p className="about__geo" data-reveal>
          i am <Selfie /> a product designer from <Place past name="rudrapur" emoji="🍼" /> → <Place past name="roorkee" emoji="🎓" /> → <Place name="mumbai" emoji="💼" />
        </p>
        <p data-reveal>
          before i was a designer, i was a kid frantically following along to{' '}
          <a className="art-attack" href="https://youtu.be/YDi9-uXXRfc?si=Izbf_ubp6q1wHw8t" target="_blank" rel="noreferrer">
            <img src={heroImage['art-attack']} alt="Art Attack" draggable={false} />
          </a>{' '}
          and making toys from{' '}
          <a className="lime" href="https://www.arvindguptatoys.com/toys.html" target="_blank" rel="noreferrer">
            arvindguptatoys.com
          </a>
        </p>
        <p data-reveal>
          these days, i’m getting my hands dirty in the world of payments at{' '}
          {juspay ? <img className="inline-logo" src={juspay.src} alt="Juspay" /> : 'Juspay'}
        </p>
        <p data-reveal>
          i may not have 8 years of experience, but given a weekend and an ominous deadline,{' '}
          <span className="pink">i can lowkey learn anything</span>.
        </p>
        <HeroActions />
      </div>

      <Basketball />

      <footer className="worked">
        <span className="worked__label">worked with</span>
        <Ticker />
      </footer>
    </section>
  )
}
