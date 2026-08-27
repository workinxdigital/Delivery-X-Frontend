'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { ApiError, getPricing, getServiceRates, saveServiceRate } from '@/lib/api/client'
import {
  CURRENCY,
  currentYearMonth,
  formatCategory,
  formatMoneyMinor,
  monthRange,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { GhostButton, PanelHeader, PrimaryButton, Td, Th } from './panel-parts'

/**
 * The pricing calculator. Admin only, like the rest of this screen.
 *
 * CLAUDE.md §1 said this system holds no pricing; the owner reversed that on
 * 2026-08-25 for this screen. It is worth being precise about what that does and
 * does not mean: the rate card below is the only place money is stored, and no
 * delivery carries an amount. So a rate typed today re-prices last month rather
 * than rewriting what was recorded — the ledger keeps saying what shipped, and
 * this says what that was worth.
 *
 * Two halves, in the order you need them: what the month came to, and the rates
 * that produced it.
 */
export function PricingPanel() {
  const [month, setMonth] = useState(currentYearMonth)
  const range = monthRange(month)

  const { data: pricing, isLoading: loadingTotals } = useQuery({
    queryKey: ['admin', 'pricing', range.from, range.to],
    queryFn: () => getPricing(range.from, range.to),
  })

  return (
    <div className="space-y-8">
      <section>
        <PanelHeader
          title="What shipped this month"
          note="Priced from the ledger: each delivery, its variations, and the rounds past the agency's free allowance. Change a rate and this recalculates — no delivery stores an amount."
          action={
            <label className="flex items-center gap-2 text-micro text-ink-muted">
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

        {/* The one number the screen exists for, before its breakdown. */}
        <div className="border-rule bg-wash/50 mb-4 flex flex-wrap items-end justify-between gap-4 rounded-xl border px-5 py-4">
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
              <div>
                <dt className="inline">Deliveries </dt>
                <dd className="tabular text-ink inline font-medium">
                  {pricing.totals.deliveries}
                </dd>
              </div>
              <div>
                <dt className="inline">Variations </dt>
                <dd className="tabular text-ink inline font-medium">
                  {pricing.totals.variations}
                </dd>
              </div>
              <div>
                <dt className="inline">Paid rounds </dt>
                <dd className="tabular text-ink inline font-medium">
                  {pricing.totals.extraRounds}
                </dd>
              </div>
            </dl>
          )}
        </div>

        {/*
          Services delivered with no rate set are named, not priced at zero.
          A total that looks complete while silently omitting half the month's
          work is the worst thing this screen could do.
        */}
        {pricing && pricing.unpriced.length > 0 && (
          <p className="text-beyond mb-4 text-micro">
            No rate set for{' '}
            {pricing.unpriced.map((u) => `${u.serviceName} (${u.deliveries})`).join(', ')} — those
            deliveries are counted but not priced.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-dense">
            <thead>
              <tr className="border-rule bg-wash/60 border-b">
                <Th>Service</Th>
                <Th>Deliveries</Th>
                <Th>Variations</Th>
                <Th>Paid rounds</Th>
                <Th>Base</Th>
                <Th>Variations</Th>
                <Th>Rounds</Th>
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {loadingTotals && (
                <tr>
                  <td colSpan={8} className="text-ink-muted py-8 text-center text-micro">
                    Counting
                  </td>
                </tr>
              )}

              {pricing?.lines.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-ink-muted py-8 text-center text-micro">
                    Nothing delivered in this month.
                  </td>
                </tr>
              )}

              {pricing?.lines.map((l) => (
                <tr key={l.serviceId} className="border-rule hover:bg-wash border-b last:border-0">
                  <Td className="font-medium">
                    {l.serviceName}
                    {!l.hasRate && (
                      <span className="text-beyond ml-2 text-micro font-normal">no rate</span>
                    )}
                  </Td>
                  <Td className="tabular">{l.deliveries}</Td>
                  <Td className="tabular">{l.variations}</Td>
                  <Td className={cn('tabular', l.extraRounds > 0 && 'text-beyond')}>
                    {l.extraRounds}
                  </Td>
                  <Td className="tabular text-ink-muted">{formatMoneyMinor(l.baseMinor, false)}</Td>
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

/**
 * The rate card.
 *
 * One row per service, three amounts: the service delivered once, each variation
 * after the first, and each round past the free allowance. Saved per row rather
 * than as one big form — a rate is a decision about one service, and a single
 * Save for twenty of them makes every change feel risky.
 */
function RateCard() {
  const queryClient = useQueryClient()
  const [drafts, setDrafts] = useState<Record<string, { base: string; per: string; rev: string }>>(
    {},
  )

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['admin', 'service-rates'],
    queryFn: getServiceRates,
  })

  const save = useMutation({
    mutationFn: (serviceId: string) => {
      const d = drafts[serviceId]!
      return saveServiceRate({
        serviceId,
        base: d.base,
        perVariation: d.per,
        perExtraRevision: d.rev,
      })
    },
    onSuccess: (_r, serviceId) => {
      toast('Rate saved')
      setDrafts((x) => {
        const next = { ...x }
        delete next[serviceId]
        return next
      })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'service-rates'] })
      // The month's totals are built from these, so they are now stale.
      void queryClient.invalidateQueries({ queryKey: ['admin', 'pricing'] })
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Could not save that rate'),
  })

  const draftFor = (row: (typeof rows)[number]) =>
    drafts[row.serviceId] ?? {
      base: formatMoneyMinor(row.baseMinor, false),
      per: formatMoneyMinor(row.perVariationMinor, false),
      rev: formatMoneyMinor(row.perExtraRevisionMinor, false),
    }

  const edit = (serviceId: string, patch: Partial<{ base: string; per: string; rev: string }>) =>
    setDrafts((x) => {
      const row = rows.find((r) => r.serviceId === serviceId)!
      const current = x[serviceId] ?? {
        base: formatMoneyMinor(row.baseMinor, false),
        per: formatMoneyMinor(row.perVariationMinor, false),
        rev: formatMoneyMinor(row.perExtraRevisionMinor, false),
      }
      return { ...x, [serviceId]: { ...current, ...patch } }
    })

  return (
    <section>
      <PanelHeader
        title="Rate card"
        note={`Filled in by hand, in ${CURRENCY}. A delivery is the base plus one charge per variation beyond the first, plus one per revision round past the agency's free allowance. Zero means free; a blank is refused rather than saved as zero.`}
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-dense">
          <thead>
            <tr className="border-rule bg-wash/60 border-b">
              <Th>Service</Th>
              <Th>Base</Th>
              <Th>Per extra variation</Th>
              <Th>Per paid round</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="text-ink-muted py-8 text-center text-micro">
                  Loading
                </td>
              </tr>
            )}

            {rows.map((row) => {
              const d = draftFor(row)
              const dirty = Boolean(drafts[row.serviceId])

              return (
                <tr
                  key={row.serviceId}
                  className="border-rule hover:bg-wash/60 border-b last:border-0"
                >
                  <Td>
                    <div className={cn('font-medium', !row.active && 'text-ink-muted')}>
                      {row.serviceName}
                      {!row.active && (
                        <span className="text-ink-faint ml-2 text-micro font-normal">off</span>
                      )}
                    </div>
                    <div className="text-ink-faint text-micro">
                      {formatCategory(row.category)}
                      {!row.hasRate && ' · no rate yet'}
                    </div>
                  </Td>

                  <Td control>
                    <Money
                      label={`Base price for ${row.serviceName}`}
                      value={d.base}
                      onChange={(v) => edit(row.serviceId, { base: v })}
                    />
                  </Td>
                  <Td control>
                    <Money
                      label={`Per extra variation for ${row.serviceName}`}
                      value={d.per}
                      onChange={(v) => edit(row.serviceId, { per: v })}
                    />
                  </Td>
                  <Td control>
                    <Money
                      label={`Per paid revision round for ${row.serviceName}`}
                      value={d.rev}
                      onChange={(v) => edit(row.serviceId, { rev: v })}
                    />
                  </Td>

                  <Td align="right" control>
                    {/* Only offered once something has changed. */}
                    {dirty ? (
                      <span className="inline-flex items-center gap-1.5">
                        <PrimaryButton
                          type="button"
                          pending={save.isPending && save.variables === row.serviceId}
                          pendingLabel="Saving"
                          onClick={() => save.mutate(row.serviceId)}
                        >
                          Save
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
                    ) : (
                      <span className="text-ink-faint text-micro">
                        {row.updatedAt ? 'saved' : ''}
                      </span>
                    )}
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** An amount field: right-aligned tabular figures, with the symbol stated once. */
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
