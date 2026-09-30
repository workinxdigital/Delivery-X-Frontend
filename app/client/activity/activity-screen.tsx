'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { CodePill, Pill } from '@/components/pill'
import { getClientActivity, type ClientLedgerEntry } from '@/lib/api/client'
import { formatDateOnly, formatMoneyMinor } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * The statement (§4.4): every entry on the account, with a running balance.
 *
 * The running balance is the reason this is a page rather than a longer panel.
 * A client reconciling against their own records reads down the column asking
 * "and what was left then" — a list of movements without it answers a different,
 * smaller question.
 *
 * Computed newest-first from the closing balance downward, so the top row shows
 * today's figure and each row below shows what the balance was before the entry
 * above it happened.
 */
export function ClientActivityScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['client', 'activity', 'all'],
    queryFn: () => getClientActivity(),
    retry: false,
  })

  if (isLoading) return <p className="text-ink-muted py-16 text-center text-dense">Loading</p>
  if (isError || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink-muted text-dense">There is no account activity to show here.</p>
        <Link href="/client" className="text-ink-muted hover:text-ink mt-2 inline-block text-micro underline decoration-dotted underline-offset-2">
          Back to your account
        </Link>
      </div>
    )
  }

  let running = data.balance.availableMinor
  const rows = data.entries.map((e) => {
    const after = running
    running -= e.amountMinor
    return { entry: e, after }
  })

  return (
    <div data-measure="wide" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[1.75rem] leading-tight font-semibold">Account activity</h1>
          <p className="text-ink-muted mt-1 text-dense">
            Everything paid in and everything charged, newest first.
          </p>
        </div>
        <div className="text-right">
          <p className="text-ink-muted text-micro uppercase tracking-wide">Available</p>
          <p className={cn('display tabular text-[1.5rem] leading-none font-semibold', data.balance.availableMinor < 0 && 'text-beyond')}>
            {formatMoneyMinor(data.balance.availableMinor)}
          </p>
        </div>
      </header>

      <div className="border-rule bg-surface shadow-card overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr className="border-rule-strong bg-wash/70 text-ink-muted border-b text-left text-micro uppercase tracking-wide">
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">What</th>
              <th className="px-3 py-2.5 font-medium">Brand</th>
              <th className="px-3 py-2.5 text-right font-medium">In</th>
              <th className="px-3 py-2.5 text-right font-medium">Out</th>
              <th className="px-5 py-2.5 text-right font-medium">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-rule divide-y">
            {rows.length === 0 && (
              <tr><td colSpan={6} className="text-ink-muted px-5 py-8 text-center">Nothing yet.</td></tr>
            )}
            {rows.map(({ entry: e, after }) => (
              <tr key={e.id} className="hover:bg-wash transition-colors">
                <td className="text-ink-muted px-5 py-3 whitespace-nowrap">{formatDateOnly(e.occurredOn)}</td>
                <td className="px-3 py-3">
                  <Description entry={e} />
                </td>
                <td className="text-ink-muted px-3 py-3">{e.brandName ?? '—'}</td>
                <td className="tabular px-3 py-3 text-right">
                  {e.amountMinor > 0 ? formatMoneyMinor(e.amountMinor) : <span className="text-ink-faint">—</span>}
                </td>
                <td className="tabular px-3 py-3 text-right">
                  {e.amountMinor < 0 ? formatMoneyMinor(-e.amountMinor) : <span className="text-ink-faint">—</span>}
                </td>
                {/* What the account held immediately after this entry. */}
                <td className="tabular px-5 py-3 text-right font-medium">{formatMoneyMinor(after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-ink-muted text-micro">
        Balance shown is what the account held straight after each entry.
      </p>
    </div>
  )
}

function Description({ entry: e }: { entry: ClientLedgerEntry }) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span>{e.description}</span>
      {e.taskCode && <CodePill>{e.taskCode}</CodePill>}
      {e.disputed && <Pill tone="beyond">flagged</Pill>}
      {e.kind === 'REVERSAL' && <Pill tone="outline">credit</Pill>}
    </span>
  )
}
