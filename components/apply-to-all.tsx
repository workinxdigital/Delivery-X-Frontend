'use client'

import { useState } from 'react'
import { MultiSelect, type MultiOption } from '@/components/multi-select'
import { Input } from '@/components/ui/input'
import type { Complexity } from '@/lib/api/types'
import { cn } from '@/lib/utils'

const TIERS: { value: Complexity; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'STANDALONE', label: 'Standalone' },
]

/**
 * Set the same services on every ASIN at once.
 *
 * Pasting a hundred codes creates a hundred sections with nothing in them, and
 * choosing services in each one is the manual work the paste was meant to avoid.
 * In practice a job has a common case — most listings got the same treatment —
 * with a handful of exceptions, so this fills all of them and the exceptions are
 * then corrected in their own sections.
 *
 * Two ways to apply, because both are real:
 *   every ASIN        — start from scratch, overwriting anything already set.
 *   only empty ones   — after correcting a few by hand, or after a CSV that
 *                       covered some but not all of them.
 */
export function ApplyToAll({
  count,
  emptyCount,
  serviceOptions,
  allowance,
  onApply,
}: {
  count: number
  /** How many sections still have no services. */
  emptyCount: number
  serviceOptions: MultiOption[]
  allowance?: number
  onApply: (params: {
    serviceIds: string[]
    complexity: Complexity
    revisionCount: string
    onlyEmpty: boolean
  }) => void
}) {
  const [serviceIds, setServiceIds] = useState<string[]>([])
  const [complexity, setComplexity] = useState<Complexity>('MEDIUM')
  const [revisionCount, setRevisionCount] = useState('0')

  const ready = serviceIds.length > 0
  const beyond = allowance !== undefined && Number(revisionCount) > allowance

  return (
    <div className="border-rule bg-wash/40 rounded-lg border p-3">
      <p className="text-ink-muted text-micro">
        Fill every ASIN at once, then correct the ones that differ.
      </p>

      <div className="mt-2.5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <MultiSelect
          id="apply-services"
          options={serviceOptions}
          values={serviceIds}
          placeholder="Services for every ASIN"
          searchPlaceholder="Search the catalogue"
          onChange={setServiceIds}
        />

        {/* Segmented, not a dropdown: four options, and the tier is the field
            most often glanced at rather than changed. */}
        <div className="border-control flex items-stretch overflow-hidden rounded-md border">
          {TIERS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setComplexity(t.value)}
              aria-pressed={complexity === t.value}
              className={cn(
                'text-micro px-2.5 transition-colors duration-[120ms]',
                complexity === t.value
                  ? 'bg-ink text-paper font-medium'
                  : 'text-ink-muted hover:bg-wash',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="apply-revisions" className="text-ink-muted text-micro">
            Revisions
          </label>
          <Input
            id="apply-revisions"
            type="number"
            min={0}
            className="h-9 w-16 tabular"
            value={revisionCount}
            onChange={(e) => setRevisionCount(e.target.value)}
          />
        </div>
      </div>

      {beyond && (
        <p className="text-beyond mt-2 text-micro">
          Above the {allowance} within this contract, so every ASIN gets{' '}
          {Number(revisionCount) - allowance!} round
          {Number(revisionCount) - allowance! === 1 ? '' : 's'} flagged beyond allowance.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!ready}
          onClick={() => onApply({ serviceIds, complexity, revisionCount, onlyEmpty: false })}
          className="bg-ink text-paper text-micro rounded-md px-3 py-1.5 font-medium disabled:bg-wash disabled:text-ink-muted"
        >
          Apply to all {count}
        </button>

        {emptyCount > 0 && emptyCount < count && (
          <button
            type="button"
            disabled={!ready}
            onClick={() => onApply({ serviceIds, complexity, revisionCount, onlyEmpty: true })}
            className="border-control text-ink-muted hover:text-ink text-micro rounded-md border px-3 py-1.5 disabled:opacity-40"
          >
            Only the {emptyCount} still empty
          </button>
        )}

        {!ready && (
          <span className="text-ink-faint text-micro">Pick the services first.</span>
        )}
      </div>
    </div>
  )
}
