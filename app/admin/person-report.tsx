'use client'

import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { getDelivererReport } from '@/lib/api/client'
import type { DelivererReport } from '@/lib/api/types'
import { currentYearMonth, formatDateOnly, formatTimestamp, monthRange } from '@/lib/format'
import { GhostButton, Td, Th } from './panel-parts'

/**
 * One person's delivery record (§5.5).
 *
 * The counterpart to the privacy rule. A PM sees only their own deliveries
 * (§5.10), which is exactly why this exists: somebody has to see everyone's.
 *
 * **Rebuilt on 2026-08-29 because the first version said everything at once.**
 * It stacked five bordered stat tiles, a bordered account strip, two bordered
 * breakdown tables and a bordered list — four chromes deep before a single
 * useful number, and for a colleague with no deliveries yet, a screenful of
 * empty tables saying "Nothing yet" three times.
 *
 * It answers three questions now, in the order an admin asks them, with one
 * piece of furniture each:
 *
 *   who is this      the name, their account, and whether they can sign in —
 *                    all in the header, because it is all identity
 *   how much         one band of figures, no boxes
 *   doing what       who they work for and what they ship, as two lines of
 *                    text rather than two tables, then the recent list
 *
 * Everything here is a count. What someone's work was worth is a Pricing
 * question and Pricing already filters by person; an amount here would be the
 * ledger carrying a price, which §1 forbids.
 */
export function PersonReport({ id, onBack }: { id: string; onBack: () => void }) {
  /**
   * All time by default. "How much has Kavitha delivered" is usually a career
   * question on this screen; the monthly cut is what the dashboard is for.
   */
  const [month, setMonth] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'deliverer-report', id, month ?? 'all'],
    queryFn: () => getDelivererReport(id, month ? monthRange(month) : undefined),
  })

  const account = data?.person.account
  const lockedUntil =
    account?.lockedUntil && new Date(account.lockedUntil) > new Date()
      ? account.lockedUntil
      : null

  return (
    <div>
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="text-ink-muted hover:text-ink -ml-1 mb-1.5 inline-flex items-center gap-1 text-micro transition-colors duration-[120ms]"
          >
            <ArrowLeft className="size-3.5" />
            All people
          </button>

          <h2 className="display truncate text-[1.375rem] font-semibold">
            {data?.person.name ?? '…'}
          </h2>

          {/*
            The account, inline. It was a bordered three-column strip of its own
            below the figures; it is four short facts about who this is, which
            is what a subtitle is for.
          */}
          {data && (
            <p className="text-ink-muted mt-1 text-dense">
              {account ? (
                <>
                  {account.email} · {account.role} ·{' '}
                  {account.lastSeenAt
                    ? `last seen ${formatTimestamp(account.lastSeenAt)}`
                    : 'never signed in'}
                  {!account.active && <span className="text-ink-faint"> · disabled</span>}
                  {/* Where an admin looks when a colleague says they cannot get
                      in, so it is on the screen that answers "who" (§5.10). */}
                  {lockedUntil && (
                    <span className="text-danger">
                      {' '}
                      · locked until {formatTimestamp(lockedUntil)}
                    </span>
                  )}
                </>
              ) : (
                'On the Team list; no login account.'
              )}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <GhostButton onClick={() => setMonth(null)}>
            {month ? 'All time' : '● All time'}
          </GhostButton>
          <GhostButton onClick={() => setMonth(currentYearMonth())}>
            {month ? '● This month' : 'This month'}
          </GhostButton>
        </div>
      </div>

      {isLoading && <p className="text-ink-muted py-12 text-center text-micro">Loading</p>}

      {data && data.totals.deliveries === 0 ? (
        /*
          One sentence, not three empty tables.

          The first version rendered the figures, both breakdowns and the list
          whatever the data was, so a colleague who had delivered nothing got a
          page of borders saying "Nothing yet" in three places.
        */
        <p className="text-ink-muted border-rule rounded-xl border border-dashed py-12 text-center text-dense">
          {month
            ? `${data.person.name} delivered nothing this month.`
            : `${data.person.name} has not delivered anything yet.`}
        </p>
      ) : (
        data && (
          <>
            {/*
              One band of figures. Five bordered cards became five columns of a
              single hairline-topped row: the same numbers, one edge instead of
              ten, and they still line up for comparison down the page.
            */}
            <dl className="border-rule grid grid-cols-2 gap-x-8 gap-y-5 border-y py-5 sm:grid-cols-5">
              <Figure label="Deliveries" value={data.totals.deliveries} />
              <Figure label="Variations" value={data.totals.variations} />
              <Figure label="Revision rounds" value={data.totals.revisionRounds} />
              <Figure
                label="Beyond allowance"
                value={data.totals.roundsBeyondAllowance}
                warn={data.totals.roundsBeyondAllowance > 0}
              />
              <Figure label="Edits" value={data.totals.edits} />
            </dl>

            {/*
              Who they work for and what they ship — two lines, not two tables.

              As tables these were two more bordered blocks repeating what the
              list below already shows per row. As sentences they answer the
              question at a glance and cost four lines of the page.
            */}
            <div className="mt-6 space-y-2 text-dense">
              <Mix label="Agencies" rows={data.byAgency} />
              <Mix label="Services" rows={data.byService} />
            </div>

            <h3 className="text-ink-muted mt-8 mb-2 text-micro font-medium tracking-[0.06em] uppercase">
              Recent deliveries
            </h3>
            <div className="border-rule overflow-x-auto rounded-xl border">
              <table className="w-full border-collapse text-dense">
                <thead>
                  <tr className="border-rule bg-wash/60 border-b">
                    <Th>Code</Th>
                    <Th>Delivered</Th>
                    <Th>Agency</Th>
                    <Th>Brand</Th>
                    <Th>Service</Th>
                    <Th>Variations</Th>
                    <Th>Rounds</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((t) => (
                    <tr key={t.id} className="border-rule hover:bg-wash border-b last:border-0">
                      <Td>
                        <Link href={`/ledger/${t.id}`} className="code hover:underline">
                          {t.taskCode}
                        </Link>
                      </Td>
                      <Td className="tabular whitespace-nowrap">
                        {formatDateOnly(t.deliveredOn)}
                      </Td>
                      <Td className="text-ink-muted max-w-[18ch] truncate" title={t.agencyName}>
                        {t.agencyName}
                      </Td>
                      <Td className="max-w-[18ch] truncate" title={t.brandName}>
                        {t.brandName}
                      </Td>
                      <Td className="max-w-[20ch] truncate" title={t.serviceName}>
                        {t.serviceName}
                      </Td>
                      <Td className="tabular">{t.variationCount}</Td>
                      <Td className="tabular whitespace-nowrap">
                        {t.revisionRoundCount}
                        {t.roundsBeyondAllowance > 0 && (
                          <span className="text-danger ml-1">+{t.roundsBeyondAllowance}</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </div>
  )
}

function Figure({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div>
      <dt className="text-ink-muted text-micro tracking-[0.06em] uppercase">{label}</dt>
      <dd className={`mt-1 text-[1.5rem] tabular ${warn ? 'text-danger' : ''}`}>{value}</dd>
    </div>
  )
}

/**
 * A breakdown as one line, busiest first.
 *
 * Capped, with the remainder counted rather than dropped: a list that quietly
 * stops is worse than one that says how much it is not showing. Six is about
 * where a line stops being scannable.
 */
function Mix({
  label,
  rows,
}: {
  label: string
  rows: DelivererReport['byAgency']
}) {
  if (rows.length === 0) return null
  const shown = rows.slice(0, 6)
  const rest = rows.length - shown.length

  return (
    <p className="flex gap-3">
      <span className="text-ink-muted w-[5.5rem] shrink-0 text-micro tracking-[0.06em] uppercase">
        {label}
      </span>
      <span className="text-ink-muted min-w-0">
        {shown.map((r, i) => (
          <span key={r.id}>
            {i > 0 && <span className="text-ink-faint"> · </span>}
            <span className="text-ink">{r.name}</span> {r.deliveries}
          </span>
        ))}
        {rest > 0 && <span className="text-ink-faint"> · +{rest} more</span>}
      </span>
    </p>
  )
}
