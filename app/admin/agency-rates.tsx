'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ComplexityPill } from '@/components/pill'
import { Input } from '@/components/ui/input'
import { ApiError, getAgencyRates, saveAgencyRate } from '@/lib/api/client'
import type { Complexity } from '@/lib/api/types'
import { COMPLEXITY_LABELS, CURRENCY, formatCategory, formatMoneyMinor } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GhostButton, PrimaryButton, Td, Th } from './panel-parts'

const TIERS: Complexity[] = ['LOW', 'MEDIUM', 'HIGH', 'STANDALONE']

/**
 * What one agency pays.
 *
 * CLAUDE.md §1 listed per-agency rate overrides as out of scope; the owner
 * reversed that on 2026-08-27, asking for pricing to be set while an agency is
 * being added. The reversal is narrow, and the narrowness is the point: this
 * still stores no amount against any delivery, so a rate typed here re-prices
 * that agency's history rather than rewriting it.
 *
 * The one rule worth stating twice: a BLANK box means NOT PRICED. Zero means
 * free. The two must never be confused — one of them is a price. A blank used to
 * fall through to a house rate; that card was removed on 2026-08-27, so a blank
 * now falls through to nothing and the pricing screen names it rather than
 * charging zero for it.
 *
 * Services are collapsed by default. An agency rarely buys the whole catalogue,
 * and fourteen expanded blocks would bury the three that matter.
 */
export function AgencyRates({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<
    Record<string, Record<string, { variation: string; revision: string }>>
  >({})

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'agency-rates', agencyId],
    queryFn: () => getAgencyRates(agencyId),
  })

  const rows = data?.services ?? []

  const save = useMutation({
    mutationFn: (serviceId: string) => {
      const row = rows.find((r) => r.serviceId === serviceId)!
      const draft = drafts[serviceId] ?? {}
      return saveAgencyRate(agencyId, {
        serviceId,
        tiers: row.tiers.map((t) => {
          const d = draft[t.complexity]
          return {
            complexity: t.complexity,
            // Untouched tiers send back whatever they already were: their rate
            // if there is one, and an empty string if there is not, which the
            // server reads as "leave this tier unpriced".
            perVariation:
              d?.variation ??
              (t.perVariationMinor === null ? '' : formatMoneyMinor(t.perVariationMinor, false)),
            perExtraRevision:
              d?.revision ??
              (t.perExtraRevisionMinor === null
                ? ''
                : formatMoneyMinor(t.perExtraRevisionMinor, false)),
          }
        }),
      })
    },
    onSuccess: (_r, serviceId) => {
      toast(`${agencyName} rates saved`)
      setDrafts((x) => {
        const next = { ...x }
        delete next[serviceId]
        return next
      })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agency-rates', agencyId] })
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
        variation:
          tier.perVariationMinor === null ? '' : formatMoneyMinor(tier.perVariationMinor, false),
        revision:
          tier.perExtraRevisionMinor === null
            ? ''
            : formatMoneyMinor(tier.perExtraRevisionMinor, false),
      }
      return {
        ...x,
        [serviceId]: { ...forService, [complexity]: { ...current, [field]: value } },
      }
    })

  if (isLoading) return <p className="text-ink-muted text-micro">Loading rates</p>

  return (
    <div className="space-y-2">
      <p className="text-ink-muted text-micro">
        Price the services {agencyName} actually buys. An empty box is not priced — those
        are named on the Pricing screen rather than counted as nothing. Zero means free,
        which is not the same as empty.
      </p>

      {rows.map((row) => {
        const draft = drafts[row.serviceId]
        const dirty = Boolean(draft)
        const expanded = open === row.serviceId || dirty

        return (
          <div key={row.serviceId} className="border-rule bg-surface rounded-lg border">
            <button
              type="button"
              onClick={() => setOpen(expanded && !dirty ? null : row.serviceId)}
              className="hover:bg-wash/60 flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-colors duration-[120ms]"
            >
              <span className={cn('text-dense font-medium', !row.active && 'text-ink-muted')}>
                {row.serviceName}
              </span>
              <span className="text-ink-faint text-micro">{formatCategory(row.category)}</span>

              {/*
                Says which of the two states this service is in without opening
                it, because that is the only question being asked while scanning
                fourteen of them.
              */}
              <span className="text-ink-faint ml-auto text-micro">
                {row.overriddenTiers > 0 ? `${row.overriddenTiers} of 4 priced` : 'not priced'}
              </span>

              <ChevronDown
                className={cn(
                  'text-ink-muted size-4 shrink-0 transition-transform duration-[150ms]',
                  expanded && 'rotate-180',
                )}
              />
            </button>

            {expanded && (
              <div className="border-rule border-t px-4 py-3">
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
                            {complexity === 'STANDALONE' ? (
                              <span>
                                <span className="text-dense">Standalone</span>
                                <span className="text-ink-faint ml-2 text-micro">no tier chosen</span>
                              </span>
                            ) : (
                              <ComplexityPill complexity={complexity} />
                            )}
                          </Td>

                          <Td control>
                            <Money
                              label={`${agencyName}, ${row.serviceName} ${COMPLEXITY_LABELS[complexity]}: price per variation`}
                              value={
                                d?.variation ??
                                (tier.perVariationMinor === null
                                  ? ''
                                  : formatMoneyMinor(tier.perVariationMinor, false))
                              }
                              onChange={(v) => edit(row.serviceId, complexity, 'variation', v)}
                            />
                          </Td>

                          {/* Standalone charges for rounds like every other
                              tier (owner, 2026-08-27): a plain deliverable
                              still costs something to revise. */}
                          <Td control>
                            <Money
                              label={`${agencyName}, ${row.serviceName} ${COMPLEXITY_LABELS[complexity]}: price per paid revision round`}
                              value={
                                d?.revision ??
                                (tier.perExtraRevisionMinor === null
                                  ? ''
                                  : formatMoneyMinor(tier.perExtraRevisionMinor, false))
                              }
                              onChange={(v) => edit(row.serviceId, complexity, 'revision', v)}
                            />
                          </Td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {dirty && (
                  <div className="mt-3 flex items-center gap-2">
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
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * An amount field that says what an empty box means.
 *
 * The placeholder is doing real work. An empty box charges nothing and is
 * reported as unpriced, which is a very different thing from a rate of zero —
 * and the difference is invisible unless the field says so.
 */
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
        placeholder="not priced"
        className={cn('h-9 w-28 text-right tabular', value === '' && 'text-ink-faint')}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  )
}
