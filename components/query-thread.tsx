import { cn } from '@/lib/utils'

/**
 * A query and its answer, as an exchange (owner, 2026-10-01).
 *
 * One component because it renders in two places — on the charge inside a
 * project's record, and on the client's Queries screen — and two copies of a
 * conversation about money would drift.
 *
 * It is a panel rather than a note in the margin. The first version set both
 * lines at `text-micro` on a hairline rule, which is the treatment this app
 * uses for captions and timestamps: the reply to "I don't recall this charge"
 * was typeset as an aside (owner, 2026-10-01). What is said here decides
 * whether somebody pays an amount they queried, so it reads at the same size
 * as the rest of the record, on its own ground, with the two voices
 * distinguished — the question quieter, the answer at full strength.
 */
export function QueryThread({
  note,
  response,
  resolution,
  open,
  className,
}: {
  note: string | null
  response: string | null
  resolution: 'DISMISSED' | 'CREDITED' | null
  /** Still waiting on an answer. */
  open: boolean
  className?: string
}) {
  if (!note && !response && !open) return null

  return (
    <div className={cn('border-rule bg-wash/60 space-y-2 rounded-lg border p-3.5', className)}>
      {note && (
        <div>
          <p className="text-ink-faint text-micro uppercase tracking-wide">You asked</p>
          <p className="text-ink-muted mt-0.5 text-dense">{note}</p>
        </div>
      )}

      {response ? (
        <div className={cn(note && 'border-rule border-t pt-2')}>
          <p className="text-ink-faint text-micro uppercase tracking-wide">
            WorkinX replied
            {resolution === 'CREDITED'
              ? ' · credited'
              : resolution === 'DISMISSED'
                ? ' · the charge stands'
                : ''}
          </p>
          <p className="text-ink mt-0.5 text-dense">{response}</p>
        </div>
      ) : (
        open && (
          <p className={cn('text-ink-faint text-micro', note && 'border-rule border-t pt-2')}>
            Waiting on your project manager.
          </p>
        )
      )}
    </div>
  )
}
