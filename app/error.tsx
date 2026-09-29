'use client'

import { useEffect } from 'react'
import { PrimaryButton } from '@/components/primary-button'
import { logger } from '@/lib/logger'

/**
 * What a screen shows when its render throws.
 *
 * There was nothing here until 2026-09-29, so an unhandled error anywhere in a
 * page — a field missing from an API response, a shape that changed — unmounted
 * the whole tree and left a white page with no message and no way back. The
 * notification bell did exactly that in testing: one query returning an
 * unexpected shape took the entire form down with it.
 *
 * Next renders this in place of the route that failed, so the nav survives and
 * `reset()` re-renders the route without a full reload — which matters on the
 * logging form, where a reload would lose whatever was typed.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('route render failed', error)
  }, [error])

  return (
    <div className="mx-auto max-w-[32rem] px-6 py-20 text-center">
      <h1 className="display text-[1.5rem] font-semibold">This screen did not load</h1>
      <p className="text-ink-muted mt-2 text-dense">
        Something went wrong rendering this page. Nothing you had already saved is affected —
        the ledger only changes when a save succeeds.
      </p>

      {/* The digest is what ties this to the server log; without it a report is
          "it broke", which is not something anyone can look up. */}
      {error.digest && (
        <p className="text-ink-faint mt-4 text-micro">
          Reference <span className="code">{error.digest}</span>
        </p>
      )}

      <div className="mt-6 flex justify-center gap-3">
        <PrimaryButton type="button" onClick={reset}>
          Try again
        </PrimaryButton>
      </div>
    </div>
  )
}
