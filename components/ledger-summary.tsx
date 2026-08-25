'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { ComplexityPill } from '@/components/pill'
import { getTaskSummary } from '@/lib/api/client'
import type { Complexity, TaskFilters } from '@/lib/api/types'
import { cn } from '@/lib/utils'

/**
 * Totals for whatever the ledger is currently showing.
 *
 * Aggregated in the database over the same filters as the table, not summed
 * from the rows on screen — the table pages at 25, and a total that quietly
 * described only the first page would be worse than no total at all.
 *
 * The design goal is one glance, not four readings. Bare columns of digits make
 * you compare numbers in your head, so every row carries a bar showing its
 * share: which agency dominates and which tier the work sits in are then shape,
 * not arithmetic. The digits stay for when the exact figure matters.
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

  const t = data?.totals
  const byAgency = data?.byAgency ?? []
  const byComplexity = sortTiers(data?.byComplexity ?? [])

  const topAgency = Math.max(1, ...byAgency.map((a) => a.deliveries))
  const topTier = Math.max(1, ...byComplexity.map((c) => c.variations))

  return (
    <section className="border-rule bg-surface shadow-card mb-4 overflow-hidden rounded-xl border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="hover:bg-wash/50 flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-[120ms]"
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
        <div className="border-rule border-t">
          {/*
            The headline row. Numbers set large and tabular so they read as
            figures rather than text, each with the one comparison that gives it
            meaning underneath — a count with nothing to measure it against is
            just a digit.
          */}
          <div className="divide-rule grid divide-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 sm:[&>*:not(:first-child)]:border-l">
            <Stat
              label="Deliveries"
              value={t?.deliveries}
              note={byAgency.length > 0 ? `${byAgency.length} agenc${byAgency.length === 1 ? 'y' : 'ies'}` : undefined}
            />
            <Stat
              label="Variations"
              value={t?.variations}
              note={
                t && t.deliveries > 0
                  ? `${(t.variations / t.deliveries).toFixed(1)} per delivery`
                  : undefined
              }
            />
            <Stat
              label="Revision rounds"
              value={t?.revisionRounds}
              note={
                t && t.variations > 0
                  ? `${(t.revisionRounds / t.variations).toFixed(1)} per variation`
                  : undefined
              }
            />
            {/*
              The one chromatic accent in the product means rounds past the
              allowance, so this borrows it rather than inventing a colour — and
              only when there are any. Zero beyond allowance is good news and
              should not be painted as a warning.
            */}
            <Stat
              label="Beyond allowance"
              value={t?.roundsBeyondAllowance}
              alarm={Boolean(t?.roundsBeyondAllowance)}
              note={
                t && t.revisionRounds > 0
                  ? `${Math.round((t.roundsBeyondAllowance / t.revisionRounds) * 100)}% of all rounds`
                  : undefined
              }
            />
          </div>

          <div className="border-rule divide-rule grid border-t lg:grid-cols-2 lg:divide-x">
            <Block title="Per agency" empty={byAgency.length === 0}>
              {byAgency.map((row) => (
                <Row
                  key={row.agencyId}
                  label={<span className="font-medium">{row.agencyName}</span>}
                  primary={row.deliveries}
                  share={row.deliveries / topAgency}
                  barClass="bg-tier-2"
                  secondary={[
                    { label: 'variations', value: row.variations },
                    { label: 'revisions', value: row.revisionRounds },
                    { label: 'beyond', value: row.roundsBeyondAllowance, alarm: true },
                  ]}
                />
              ))}
            </Block>

            <Block title="Per complexity" empty={byComplexity.length === 0}>
              {byComplexity.map((row) => (
                <Row
                  key={row.complexity}
                  label={<ComplexityPill complexity={row.complexity} />}
                  primary={row.variations}
                  share={row.variations / topTier}
                  barClass={TIER_BAR[row.complexity]}
                  secondary={[
                    { label: 'revisions', value: row.revisionRounds },
                    { label: 'beyond', value: row.roundsBeyondAllowance, alarm: true },
                  ]}
                />
              ))}
            </Block>
          </div>

          <p className="border-rule text-ink-faint border-t px-4 py-2.5 text-micro">
            Beyond allowance counts rounds past the allowance in force when each delivery
            was logged. A count of rounds, not a charge.
          </p>
        </div>
      )}
    </section>
  )
}

/** Low to Standalone, always. The database returns groups in whatever order it likes. */
const TIER_ORDER: Complexity[] = ['LOW', 'MEDIUM', 'HIGH', 'STANDALONE']

const TIER_BAR: Record<Complexity, string> = {
  LOW: 'bg-tier-1',
  MEDIUM: 'bg-tier-2',
  HIGH: 'bg-tier-3',
  STANDALONE: 'bg-wash',
}

function sortTiers<T extends { complexity: Complexity }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => TIER_ORDER.indexOf(a.complexity) - TIER_ORDER.indexOf(b.complexity),
  )
}

function Stat({
  label,
  value,
  note,
  alarm,
}: {
  label: string
  value: number | undefined
  note?: string
  alarm?: boolean
}) {
  return (
    <div className="px-4 py-4">
      <div className="text-ink-muted text-micro font-medium tracking-[0.06em] uppercase">
        {label}
      </div>
      <div
        className={cn(
          'display tabular mt-1.5 text-[1.75rem] leading-none font-semibold',
          alarm ? 'text-beyond' : 'text-ink',
        )}
      >
        {value ?? '—'}
      </div>
      {note && <div className="text-ink-faint mt-1.5 text-micro">{note}</div>}
    </div>
  )
}

function Block({
  title,
  empty,
  children,
}: {
  title: string
  empty: boolean
  children: React.ReactNode
}) {
  return (
    <div className="px-4 py-4">
      <h3 className="text-ink-muted text-micro mb-3 font-medium tracking-[0.06em] uppercase">
        {title}
      </h3>
      {empty ? (
        <p className="text-ink-faint text-micro">Nothing matches these filters.</p>
      ) : (
        <ul className="space-y-3">{children}</ul>
      )}
    </div>
  )
}

/**
 * One line of the breakdown.
 *
 * A row rather than a table cell: the headline number sits beside its label, the
 * bar gives it scale against the largest row, and the supporting counts sit
 * underneath in words. Reading "12 revisions · 2 beyond" takes no column
 * headers to interpret, which is what a four-column table of digits demanded.
 */
function Row({
  label,
  primary,
  share,
  barClass,
  secondary,
}: {
  label: React.ReactNode
  primary: number
  share: number
  barClass: string
  secondary: { label: string; value: number; alarm?: boolean }[]
}) {
  return (
    <li>
      <div className="flex items-baseline gap-3">
        <span className="min-w-0 grow truncate">{label}</span>
        <span className="tabular text-dense font-medium">{primary}</span>
      </div>

      <div className="bg-wash mt-1.5 h-1.5 overflow-hidden rounded-full">
        <div
          className={cn('h-full rounded-full', barClass)}
          // Rounded to whole percents: a bar is read as a proportion, and
          // sub-pixel precision buys nothing.
          style={{ width: `${Math.max(2, Math.round(share * 100))}%` }}
        />
      </div>

      <div className="text-ink-muted mt-1.5 flex flex-wrap gap-x-3 text-micro">
        {secondary.map((s) => (
          <span key={s.label} className={cn(s.alarm && s.value > 0 && 'text-beyond')}>
            <span className="tabular">{s.value}</span> {s.label}
          </span>
        ))}
      </div>
    </li>
  )
}
