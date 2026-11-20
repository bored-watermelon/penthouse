import { Suspense, lazy, useRef, useState } from 'react'
import Chat from './components/Chat'
import About from './components/About'
import CaseStudy from './components/CaseStudy'
import NotFound from './components/NotFound'
import Divider from './components/Divider'
import Work from './components/Work'
import Timeline from './components/Timeline'
import AboutMe from './components/AboutMe'
import Slides from './components/Slides'
import Footer from './components/Footer'
import PageCurl from './components/PageCurl'
import Dock from './components/Dock'
import { IpodHost } from './components/Ipod'
import Loader from './components/Loader'
import { introWanted } from './lib/intro'
import { useRoute } from './lib/router'
import { useReveal } from './lib/reveal'

// The landing photo is whichever file in media/backgrounds starts with "landing". Turned 180° and resized at build time.
const landing = import.meta.glob('../media/backgrounds/landing*.{jpg,JPG,jpeg,png,webp}', {
  query: { w: 2400, rotate: 180, format: 'webp', quality: 80 },
  import: 'default',
  eager: true,
}) as Record<string, string>
const bg = Object.values(landing)[0]

// Agentation's feedback toolbar, while developing only: click anything on the page to leave a note on it, and the
// notes go to the Agentation MCP server (`npx agentation-mcp server`, see .mcp.json) for a coding agent to read.
// Loaded on its own, so the live site never downloads it.
const Agentation = import.meta.env.DEV ? lazy(() => import('agentation').then((m) => ({ default: m.Agentation }))) : null

/** On a wide screen at the top of the page, it's the hero's hand-over to work (Slides.tsx); otherwise a jump there. */
function skipToWork(e: React.MouseEvent) {
  e.preventDefault()
  if (!window.dispatchEvent(new Event('skip:work', { cancelable: true }))) return
  const work = document.getElementById('work')
  work?.scrollIntoView({ block: 'start' })
  work?.querySelector<HTMLElement>('.wall__tile, button')?.focus({ preventScroll: true })
}

export default function App() {
  const stage = useRef<HTMLDivElement>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const [chatWidth, setChatWidth] = useState<number | null>(null) // null = default proportions
  const path = useRoute()
  const caseStudySlug = path.match(/^\/case-studies\/([^/]+)\/?$/)?.[1]
  const home = path === '/' || path === '/index.html'
  useReveal([path])

  const style = {
    ...(bg && { backgroundImage: `url(${bg})` }),
    ...(chatWidth !== null && { '--chat-w': `${chatWidth}px` }),
  } as React.CSSProperties

  // The iPod sits beside whichever page is showing, in the same place in the tree for both, so a song playing in its
  // corner carries on from page to page.
  return (
    <>
      {caseStudySlug ? (
        <CaseStudy slug={caseStudySlug} />
      ) : !home ? (
        <NotFound />
      ) : (
        <>
          {/* the first thing Tab finds: past the chat and the hero, straight to the work */}
          <a className="skip-link" href="#work" onClick={skipToWork}>
            skip to my work
          </a>
          {/* the page and its peeled corner, which scroll up off the footer together */}
          <div className="page">
            <div className="sheet" ref={sheet}>
              <Slides>
                <div className="stage" ref={stage} style={style}>
                  <Chat />
                  <Divider stage={stage} onChange={setChatWidth} />
                  <About />
                  {/* the white that grows out of the card over the photo on the way to work (lib/slideMotion.ts) */}
                  <div className="stage__veil" aria-hidden />
                </div>
                <Work />
                <Timeline />
                <AboutMe />
              </Slides>
            </div>
            <PageCurl sheet={sheet} />
          </div>
          <Footer />
          <Dock />
          {introWanted && <Loader bg={bg} />}
        </>
      )}
      <IpodHost />
      {/* rendered here, under the router, so it follows the page as the path changes */}
      {Agentation && (
        <Suspense>
          <Agentation endpoint="http://localhost:4747" appName="snehaha.fyi" />
        </Suspense>
      )}
    </>
  )
}
