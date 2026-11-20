import { navigate } from '../lib/router'

/** Any address that isn't the home page or a case study: says so, in the case study's empty state, with the way home. */
export default function NotFound() {
  return (
    <main className="cs cs--empty">
      <p className="cs__empty-title">nothing lives at this address.</p>
      <p className="cs__empty-sub">
        everything’s on the{' '}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault()
            navigate('/')
          }}
        >
          home page
        </a>
        .
      </p>
    </main>
  )
}
