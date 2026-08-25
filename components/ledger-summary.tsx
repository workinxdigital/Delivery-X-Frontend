'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { ComplexityPill } from '@/components/pill'
import { getTaskSummary } from '@/lib/api/client'
import type { TaskFilters } from '@/lib/api/types'
import { cn } from '@/lib/utils'

/**
 * Totals for whatever the ledger is currently showing.
 *
 * Aggregated in the database over the same filters as the table, not summed
 * from the rows on screen — the table pages at 25, and a total that quietly
 * described only the first page would be worse than no total at all.
 *
 * Three questions, which is why there are three groupings: how much shipped and
 * for whom, what shape the work was, and where the allowance was exceeded. That
 * last number is a count, never a charge (§2.6) — it says scope moved, and the
 * commercial consequence is decided outside this system.
 */
export function LedgerSummary({ filters }: { filters: TaskFilters }) {
  const [open, setOpen] = useState(true)

  // Paging and sorting change nothing about a total, so they are dropped from
  // the key — otherwise turning a page would refetch identical numbers.
  const { page: _p, pageSize: _s, sort: _so, dir: _d, ...scope } = filters
  const { data, isLoading } = useQuery({
    queryKey: ['task-summary', scope],
    queryFn: () => getTaskSummary(scope),
  })

  const totals = data?.totals

  return (
    <section className="border-rule bg-surface shadow-card mb-4 rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span aria-hidden className="bg-lime h-3 w-1 shrink-0 rounded-full" />
        <span className="text-micro text-ink-muted font-medium tracking-[0.08em] uppercase">
          Totals
        </span>
        <span className="text-ink-faint text-micro">
          {isLoading ? 'counting' : 'for everything these filters show'}
        </span>
        <ChevronDown
          className={cn(
            'text-ink-muted ml-auto size-4 transition-transform duration-[150ms]',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="border-rule border-t p-4">
          {/* The four headline numbers, in the brand's card colours. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Deliveries" value={totals?.deliveries} tone="bg-tier-2" />
            <Stat label="Variations" value={totals?.variations} tone="bg-tier-3" />
            <Stat label="Revision rounds" value={totals?.revisionRounds} tone="bg-tier-1" />
            {/*
              The only chromatic capsule in the product means rounds past the
              allowance, so this tile borrows it rather than inventing a colour.
            */}
            <Stat
              label="Rounds beyond allowance"
              value={totals?.roundsBeyondAllowance}
              tone="bg-beyond-wash"
              emphasis
            />
          </div>

          <div className="mt-5 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-ink-muted text-micro mb-2 font-medium tracking-[0.06em] uppercase">
                Per agency
              </h3>
              <table className="w-full border-collapse text-dense">
                <thead>
                  <tr className="border-rule border-b">
                    <Th>Agency</Th>
                    <Th>Deliveries</Th>
                    <Th>Variations</Th>
                    <Th>Revisions</Th>
                    <Th>Beyond</Th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byAgency ?? []).map((row) => (
                    <tr key={row.agencyId} className="border-rule border-b last:border-0">
                      <Td className="font-medium">{row.agencyName}</Td>
                      <Td className="tabular">{row.deliveries}</Td>
                      <Td className="tabular">{row.variations}</Td>
                      <Td className="tabular">{row.revisionRounds}</Td>
                      <Td className={cn('tabular', row.roundsBeyondAllowance > 0 && 'text-beyond')}>
                        {row.roundsBeyondAllowance}
                      </Td>
                    </tr>
                  ))}
                  {data?.byAgency.length === 0 && <Empty colSpan={5} />}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="text-ink-muted text-micro mb-2 font-medium tracking-[0.06em] uppercase">
                Per complexity
              </h3>
              <table className="w-full border-collapse text-dense">
                <thead>
                  <tr className="border-rule border-b">
                    <Th>Tier</Th>
                    <Th>Variations</Th>
                    <Th>Revisions</Th>
                    <Th>Beyond</Th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.byComplexity ?? []).map((row) => (
                    <tr key={row.complexity} className="border-rule border-b last:border-0">
                      <Td>
                        <ComplexityPill complexity={row.complexity} />
                      </Td>
                      {/* Variations, not deliveries: the tier lives on the
                          variation, and four variations are four pieces of work. */}
                      <Td className="tabular">{row.variations}</Td>
                      <Td className="tabular">{row.revisionRounds}</Td>
                      <Td className={cn('tabular', row.roundsBeyondAllowance > 0 && 'text-beyond')}>
                        {row.roundsBeyondAllowance}
                      </Td>
                    </tr>
                  ))}
                  {data?.byComplexity.length === 0 && <Empty colSpan={4} />}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-ink-faint mt-4 text-micro">
            Rounds beyond allowance are counted against the allowance in force when each
            delivery was logged. A count of rounds, not a charge.
          </p>
        </div>
      )}
    </section>
  )
}

function Stat({
  label,
  value,
  tone,
  emphasis,
}: {
  label: string
  value: number | undefined
  tone: string
  emphasis?: boolean
}) {
  return (
    <div className={cn('rounded-lg px-4 py-3', tone)}>
      <div
        className={cn(
          'display tabular text-[1.5rem] leading-none font-semibold',
          emphasis && value ? 'text-beyond' : 'text-ink',
        )}
      >
        {value ?? '—'}
      </div>
      <div className="text-ink-muted mt-1.5 text-micro">{label}</div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="text-ink-muted px-2 pb-1.5 text-left text-micro font-medium whitespace-nowrap"
    >
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-2 py-2 text-left align-middle', className)}>{children}</td>
}

function Empty({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="text-ink-faint py-4 text-center text-micro">
        Nothing matches these filters.
      </td>
    </tr>
  )
}
