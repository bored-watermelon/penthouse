import { useEffect, useMemo, useRef, useState } from 'react'
import { caseStudies } from '../lib/caseStudy'
import { navigate } from '../lib/router'
import { writtenCases } from '../content'

const EMAIL = 'heyiamsnehajain@gmail.com'

// Renders a case study's write-up (see lib/caseStudy.ts). The left nav is built from the doc's own "##"
// headings — not hand-maintained — and highlights whichever section is currently in view.
//
// It's either a page of its own (/case-studies/<slug>, for a link someone was sent), or, given onClose, the
// inside of the viewer that opens over the work grid (Showcase.tsx). In the viewer it scrolls its panel instead of
// the page, and the next case study opens in place through onOpen. There's no back button: the viewer closes from its
// glass, Escape or the browser's back, and the page is left the way any page is.
const READ = 'case-studies-read' // sessionStorage: the slugs read this visit
function readCases(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(READ) ?? '[]')
  } catch {
    return []
  }
}

export default function CaseStudy({ slug, onClose, onOpen }: { slug: string; onClose?: () => void; onOpen?: (slug: string) => void }) {
  const doc = caseStudies[slug]
  const [active, setActive] = useState<string | null>(null)
  const [progress, setProgress] = useState(0) // 0..1, how far through the write-up the reader is
  const [copied, setCopied] = useState(false)
  const article = useRef<HTMLDivElement>(null)
  // its text comes in line by line the first time it's read in a visit; opened again, it's simply there
  const seen = useMemo(() => readCases().includes(slug), [slug])
  useEffect(() => {
    try {
      const read = readCases()
      if (!read.includes(slug)) sessionStorage.setItem(READ, JSON.stringify([...read, slug]))
    } catch {
      /* storage blocked: it comes in line by line every time */
    }
  }, [slug])

  // what scrolls: the viewer's panel, or the page
  const scroller = () => article.current?.closest<HTMLElement>('[data-scroller]') ?? null

  useEffect(() => {
    if (onClose) {
      scroller()?.scrollTo(0, 0) // a new case study opened in place starts at its top
      return
    }
    document.title = doc ? `${doc.title} — Sneha Jain` : 'Case study — Sneha Jain'
    window.scrollTo(0, 0)
  }, [doc]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!doc || !article.current) return
    const headings = [...article.current.querySelectorAll('h2[id]')] as HTMLElement[]
    if (!headings.length) return
    setActive(headings[0].id)
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 },
    )
    headings.forEach((h) => io.observe(h))
    return () => io.disconnect()
  }, [doc])

  // reading progress, drawn as a thin line across the top of the page
  useEffect(() => {
    if (!doc) return
    let raf = 0
    const update = () => {
      raf = 0
      const el = article.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const top = scroller()?.getBoundingClientRect().top ?? 0
      const total = r.height - innerHeight * 0.6
      setProgress(Math.min(1, Math.max(0, (top - r.top) / Math.max(1, total))))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    const target: HTMLElement | Window = scroller() ?? window
    target.addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    update()
    return () => {
      target.removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [doc])

  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(EMAIL)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      window.location.href = `mailto:${EMAIL}`
    }
  }

  const goHome = () => {
    if (onClose) return onClose()
    navigate('/')
    requestAnimationFrame(() => document.getElementById('work')?.scrollIntoView({ block: 'start' }))
  }
  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
  }

  if (!doc)
    return (
      <div className="cs cs--empty">
        <p className="cs__empty-title">this one isn’t written up yet.</p>
        <p className="cs__empty-sub">
          the finished ones are back on the{' '}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault()
              goHome()
            }}
          >
            home page
          </a>
          .
        </p>
      </div>
    )

  // the next written case study, in the same order as the cards (wrapping round to the first)
  const here = writtenCases.findIndex((t) => t.slug === slug)
  const next = writtenCases.length > 1 ? writtenCases[(here + 1) % writtenCases.length] : undefined

  const stats = [
    { label: 'Timeline', value: doc.timeline },
    { label: 'Contributors', value: doc.contributors },
    { label: 'My Contribution', value: doc.contribution },
  ].filter((s) => s.value.length > 0)

  return (
    <div className="cs" data-reveal-seen={seen ? '' : undefined}>
      <div className="cs__layout">
        {/* the section index rides in the left rail, sticky */}
        <div className="cs__rail">
          {doc.toc.length > 0 && (
            <nav className="cs__nav" aria-label="Sections">
              <ul>
                {doc.toc.map((t) => (
                  <li key={t.id}>
                    <button type="button" className={t.id === active ? 'is-on' : ''} onClick={() => jump(t.id)}>
                      {t.text}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        <div className="cs__main">
          <header className="cs__head" data-reveal-text>
            <p className="cs__kicker">
              case study · {doc.minutes} min read
            </p>
            <h1>{doc.title}</h1>
            {stats.length > 0 && (
              <div className="cs__stats">
                {stats.map((s) => (
                  <div key={s.label}>
                    <span className="cs__stats-label">{s.label}</span>
                    {s.value.map((line, i) => (
                      <span key={i}>{line}</span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </header>
          {/* doc.html comes from case-studies/*.md, content Sneha writes herself — not visitor input — so
              rendering it as raw HTML (rather than sanitizing/escaping) is safe here. */}
          {/* the write-up arrives as one block of HTML, so its parts are marked by the group (see useReveal) */}
          <article className="cs__article" ref={article} data-reveal-text dangerouslySetInnerHTML={{ __html: doc.html }} />

          {/* the end of the page says what to do next: another case study, or getting in touch */}
          <footer className="cs__end" data-reveal>
            <p className="cs__thanks">thanks for reading ✿</p>
            <div className="cs__end-actions">
              <button type="button" className="cs__end-btn cs__end-btn--primary" onClick={copyEmail}>
                {copied ? 'email copied ✓' : 'say hi → ' + EMAIL}
              </button>
              <a className="cs__end-btn" href="/Sneha%20Jain%20Resume.pdf" download="Sneha Jain Resume.pdf">
                resume ↓
              </a>
            </div>
            {next && (
              <a
                className="cs__next"
                href={`/case-studies/${next.slug}`}
                onClick={(e) => {
                  e.preventDefault()
                  if (onOpen) onOpen(next.slug!)
                  else navigate(`/case-studies/${next.slug}`)
                }}
              >
                <span className="cs__next-label">next case study →</span>
                <span className="cs__next-title">{next.heading}</span>
                {next.media && !next.media.video && <img className="cs__next-thumb" src={next.media.thumb ?? next.media.src} alt="" />}
              </a>
            )}
          </footer>
        </div>
      </div>
      <div className="cs__progress" style={{ width: `${progress * 100}%` }} aria-hidden />
    </div>
  )
}
