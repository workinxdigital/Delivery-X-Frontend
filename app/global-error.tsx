'use client'

/**
 * The last resort: an error thrown by the root layout itself.
 *
 * `app/error.tsx` is rendered *inside* the layout, so it cannot catch a failure
 * in the layout that would hold it. This one replaces the whole document, which
 * is why it carries its own <html> and <body> and cannot use anything from the
 * layout — no fonts, no theme, no nav. It is deliberately plain: at this point
 * the only job is to say what happened rather than show a white page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          background: '#f5f3ee',
          color: '#161413',
          display: 'grid',
          placeItems: 'center',
          minHeight: '100vh',
          margin: 0,
        }}
      >
        <div style={{ maxWidth: '32rem', padding: '2rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.5rem', margin: 0 }}>DeliverX could not start</h1>
          <p style={{ color: '#6b655e', lineHeight: 1.6 }}>
            The app failed to load. Nothing already saved is affected. Try again, and if it
            keeps happening quote the reference below.
          </p>
          {error.digest && (
            <p style={{ color: '#8b857c', fontSize: '0.8rem', fontFamily: 'monospace' }}>
              {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.6rem 1.2rem',
              borderRadius: '999px',
              border: 0,
              background: '#161413',
              color: '#f5f3ee',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
