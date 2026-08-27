'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { ComplexityPill } from '@/components/pill'
import { Input } from '@/components/ui/input'
import { ApiError, getPricing, getServiceRates, saveServiceRate } from '@/lib/api/client'
import type { Complexity } from '@/lib/api/types'
import {
  COMPLEXITY_LABELS,
  CURRENCY,
  currentYearMonth,
  formatCategory,
  formatMoneyMinor,
  monthRange,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { GhostButton, PanelHeader, PrimaryButton, Td, Th } from './panel-parts'

const TIERS: Complexity[] = ['LOW', 'MEDIUM', 'HIGH', 'STANDALONE']

/**
 * The pricing calculator. Admin only, inside the already-gated admin screen.
 *
 * CLAUDE.md §1 said this system holds no pricing; the owner reversed that on
 * 2026-08-25 for this screen, in USD, priced per complexity tier. What that does
 * and does not mean is worth being precise about: the rate card is the only
 * place money is stored, and no delivery carries an amount — so a rate typed
 * today re-prices last month rather than rewriting it. The ledger keeps saying
 * what shipped; this says what it was worth.
 *
 * Two halves in the order you need them: what the month came to, then the rates
 * that produced it.
 */
export function PricingPanel() {
  const [month, setMonth] = useState(currentYearMonth)
  const range = monthRange(month)

  const { data: pricing, isLoading } = useQuery({
    queryKey: ['admin', 'pricing', range.from, range.to],
    queryFn: () => getPricing(range.from, range.to),
  })

  return (
    <div className="space-y-10">
      <section>
        <PanelHeader
          title="What shipped this month"
          note="Priced from the ledger: every variation at its own tier, plus the rounds past the agency's free allowance. Change a rate and this recalculates — no delivery stores an amount."
          action={
            <label className="text-ink-muted flex items-center gap-2 text-micro">
              Month
              <Input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value || currentYearMonth())}
                className="h-9 w-[10rem]"
              />
            </label>
          }
        />

        {/* The one number the screen exists for, with the counts that explain it. */}
        <div className="border-rule bg-wash/50 mb-4 flex flex-wrap items-end justify-between gap-6 rounded-xl border px-5 py-4">
          <div>
            <div className="text-ink-muted text-micro font-medium tracking-[0.06em] uppercase">
              Month total
            </div>
            <div className="display tabular mt-1 text-[1.875rem] leading-none font-semibold">
              {pricing ? formatMoneyMinor(pricing.totals.totalMinor) : '—'}
            </div>
          </div>

          {pricing && (
            <dl className="text-ink-muted flex flex-wrap gap-x-6 gap-y-1 text-micro">
              <Stat label="Deliveries" value={pricing.totals.deliveries} />
              <Stat label="Variations" value={pricing.totals.variations} />
              <Stat label="Paid rounds" value={pricing.totals.extraRounds} />
              <Stat
                label="Deliverables"
                value={formatMoneyMinor(pricing.totals.variationsMinor)}
              />
              <Stat label="Paid revisions" value={formatMoneyMinor(pricing.totals.revisionsMinor)} />
            </dl>
          )}
        </div>

        {/*
          A tier delivered with no rate is named, not priced at zero. A total
          that looks complete while omitting work is the worst thing here.
        */}
        {pricing && pricing.gaps.length > 0 && (
          <p className="text-beyond mb-4 text-micro">
            No rate set for{' '}
            {pricing.gaps
              .map(
                (g) =>
                  `${g.serviceName} at ${g.tiers
                    .map((t) => COMPLEXITY_LABELS[t as Complexity] ?? t)
                    .join('/')} (${g.variations} variation${g.variations === 1 ? '' : 's'})`,
              )
              .join('; ')}{' '}
            — counted below, but not priced.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-dense">
            <thead>
              <tr className="border-rule bg-wash/60 border-b">
                <Th>Service</Th>
                <Th>Deliveries</Th>
                <Th>Variations</Th>
                <Th>Paid rounds</Th>
                <Th>Deliverables</Th>
                <Th>Revisions</Th>
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-ink-muted py-8 text-center text-micro">
                    Counting
                  </td>
                </tr>
              )}

              {pricing?.lines.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-ink-muted py-8 text-center text-micro">
                    Nothing delivered in this month.
                  </td>
                </tr>
              )}

              {pricing?.lines.map((l) => (
                <tr key={l.serviceId} className="border-rule hover:bg-wash border-b last:border-0">
                  <Td className="font-medium">
                    {l.serviceName}
                    {l.unpricedVariations > 0 && (
                      <span className="text-beyond ml-2 text-micro font-normal">
                        {l.unpricedVariations} unpriced
                      </span>
                    )}
                  </Td>
                  <Td className="tabular">{l.deliveries}</Td>
                  <Td className="tabular">{l.variations}</Td>
                  <Td className={cn('tabular', l.extraRounds > 0 && 'text-beyond')}>
                    {l.extraRounds}
                  </Td>
                  <Td className="tabular text-ink-muted">
                    {formatMoneyMinor(l.variationsMinor, false)}
                  </Td>
                  <Td className="tabular text-ink-muted">
                    {formatMoneyMinor(l.revisionsMinor, false)}
                  </Td>
                  <Td className="tabular font-medium">{formatMoneyMinor(l.totalMinor)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <RateCard />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <dt className="inline">{label} </dt>
      <dd className="tabular text-ink inline font-medium">{value}</dd>
    </div>
  )
}

type Draft = Record<string, { variation: string; revision: string }>

/**
 * The rate card: one block per service, four tiers each.
 *
 * Saved per service rather than per cell. Deciding what Listing Images is worth
 * means deciding it at Low, Medium, High and Standalone in one sitting — four
 * separate saves would be four chances to leave that half done. Cells only offer
 * Save once something in that service has changed.
 */
function RateCard() {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin', 'service-rates'],
    queryFn: getServiceRates,
  })

  const save = useMutation({
    mutationFn: (serviceId: string) => {
      const row = rows.find((r) => r.serviceId === serviceId)!
      const draft = drafts[serviceId] ?? {}
      return saveServiceRate({
        serviceId,
        tiers: row.tiers.map((t) => ({
          complexity: t.complexity,
          perVariation:
            draft[t.complexity]?.variation ?? formatMoneyMinor(t.perVariationMinor, false),
          perExtraRevision:
            draft[t.complexity]?.revision ?? formatMoneyMinor(t.perExtraRevisionMinor, false),
        })),
      })
    },
    onSuccess: (_r, serviceId) => {
      toast('Rates saved')
      setDrafts((x) => {
        const next = { ...x }
        delete next[serviceId]
        return next
      })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'service-rates'] })
      // The month's totals were computed from what just changed.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] })
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save those rates'),
  })

  const edit = (
    serviceId: string,
    complexity: Complexity,
    field: 'variation' | 'revision',
    value: string,
  ) =>
    setDrafts((x) => {
      const row = rows.find((r) => r.serviceId === serviceId)!
      const tier = row.tiers.find((t) => t.complexity === complexity)!
      const forService = x[serviceId] ?? {}
      const current = forService[complexity] ?? {
        variation: formatMoneyMinor(tier.perVariationMinor, false),
        revision: formatMoneyMinor(tier.perExtraRevisionMinor, false),
      }
      return {
        ...x,
        [serviceId]: { ...forService, [complexity]: { ...current, [field]: value } },
      }
    })

  return (
    <section>
      <PanelHeader
        title="Rate card"
        note={`Filled in by hand, in ${CURRENCY} USD. Each variation is charged at its own tier, and each revision round past the agency's free allowance is charged too. Zero means free; a blank is refused rather than saved as zero.`}
      />

      <div className="space-y-4">
        {isLoading && <p className="text-ink-muted text-micro">Loading</p>}

        {rows.map((row) => {
          const draft = drafts[row.serviceId]
          const dirty = Boolean(draft)

          return (
            <div
              key={row.serviceId}
              className="border-rule bg-surface shadow-card rounded-xl border"
            >
              <div className="border-rule bg-wash/50 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border-b px-4 py-3">
                <div>
                  <div className={cn('text-dense font-medium', !row.active && 'text-ink-muted')}>
                    {row.serviceName}
                    {!row.active && (
                      <span className="text-ink-faint ml-2 text-micro font-normal">off</span>
                    )}
                  </div>
                  <div className="text-ink-faint text-micro">
                    {formatCategory(row.category)}
                    {row.updatedAt ? '' : ' · no rates yet'}
                  </div>
                </div>

                {dirty && (
                  <span className="flex items-center gap-1.5">
                    <PrimaryButton
                      type="button"
                      pending={save.isPending && save.variables === row.serviceId}
                      pendingLabel="Saving"
                      onClick={() => save.mutate(row.serviceId)}
                    >
                      Save {row.serviceName}
                    </PrimaryButton>
                    <GhostButton
                      onClick={() =>
                        setDrafts((x) => {
                          const next = { ...x }
                          delete next[row.serviceId]
                          return next
                        })
                      }
                    >
                      Cancel
                    </GhostButton>
                  </span>
                )}
              </div>

              <div className="overflow-x-auto px-4 py-3">
                <table className="w-full min-w-[30rem] border-collapse text-dense">
                  <thead>
                    <tr className="border-rule border-b">
                      <Th>Tier</Th>
                      <Th>Per variation</Th>
                      <Th>Per paid round</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {TIERS.map((complexity) => {
                      const tier = row.tiers.find((t) => t.complexity === complexity)!
                      const d = draft?.[complexity]
                      return (
                        <tr key={complexity} className="border-rule border-b last:border-0">
                          <Td>
                            <ComplexityPill complexity={complexity} />
                          </Td>
                          <Td control>
                            <Money
                              label={`${row.serviceName} ${COMPLEXITY_LABELS[complexity]}: price per variation`}
                              value={
                                d?.variation ?? formatMoneyMinor(tier.perVariationMinor, false)
                              }
                              onChange={(v) => edit(row.serviceId, complexity, 'variation', v)}
                            />
                          </Td>
                          <Td control>
                            <Money
                              label={`${row.serviceName} ${COMPLEXITY_LABELS[complexity]}: price per paid revision round`}
                              value={
                                d?.revision ?? formatMoneyMinor(tier.perExtraRevisionMinor, false)
                              }
                              onChange={(v) => edit(row.serviceId, complexity, 'revision', v)}
                            />
                          </Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** An amount field: right-aligned tabular figures, symbol stated once beside. */
function Money({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-ink-faint text-micro">{CURRENCY}</span>
      <Input
        aria-label={label}
        value={value}
        inputMode="decimal"
        className="h-9 w-28 text-right tabular"
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  )
}
