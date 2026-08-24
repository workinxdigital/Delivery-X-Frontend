'use client'

import { Plus, X } from 'lucide-react'
import { Segmented } from '@/components/segmented'
import { Input } from '@/components/ui/input'
import type { Complexity } from '@/lib/api/types'
import { cn } from '@/lib/utils'

export type VariationDraft = {
  complexity: Complexity | ''
  revisionCount: string
}

const COMPLEXITIES: { value: Complexity; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'STANDALONE', label: 'Standalone' },
]

export const emptyVariation = (): VariationDraft => ({ complexity: '', revisionCount: '0' })

/**
 * One shared column template for the heading row and every variation row, so
 * the labels sit exactly over what they label. Previously the heading started
 * at the segmented control while the row started at the number marker, which
 * left a ragged edge.
 *
 * The number track is always present, even with a single variation, so adding a
 * second one does not shift the whole row sideways.
 */
const GRID = 'grid grid-cols-[1.25rem_1fr] gap-x-3 sm:grid-cols-[1.25rem_minmax(0,21rem)_6rem_1.5rem]'

/**
 * The variations of one delivered service, each with its own complexity and its
 * own revision count.
 *
 * Kept deliberately quiet. The common case is a single variation, and that
 * should read as one line rather than a panel: no row number, no border on the
 * add control, and the labels stated once for the whole section.
 */
export function VariationRows({
  variations,
  onChange,
  allowance,
  errors,
}: {
  variations: VariationDraft[]
  onChange: (next: VariationDraft[]) => void
  /** The selected agency's allowance, used for the live within/beyond readout. */
  allowance: number | undefined
  errors: Record<string, string>
}) {
  const update = (i: number, patch: Partial<VariationDraft>) =>
    onChange(variations.map((v, j) => (j === i ? { ...v, ...patch } : v)))

  const add = () => onChange([...variations, emptyVariation()])
  const remove = (i: number) => onChange(variations.filter((_, j) => j !== i))

  const counts = variations.map((v) => {
    const n = Number(v.revisionCount)
    return Number.isFinite(n) && n > 0 ? n : 0
  })
  const total = counts.reduce((a, b) => a + b, 0)

  // Both readings, computed the way the server will (§2.6).
  const perVariation =
    allowance === undefined
      ? 0
      : counts.reduce((sum, n) => sum + Math.max(0, n - allowance), 0)
  const perDelivery = allowance === undefined ? 0 : Math.max(0, total - allowance)

  const numbered = variations.length > 1

  return (
    <div className="space-y-1.5">
      {/* Labels once for the section, aligned to the row grid. */}
      <div className={cn(GRID, 'hidden sm:grid')}>
        <span />
        <span className="text-ink-muted text-micro">Complexity</span>
        <span className="text-ink-muted text-micro">Revisions</span>
        <span />
      </div>

      {variations.map((variation, i) => (
        <div key={i} className={cn(GRID, 'items-start')}>
          {/* Only numbered once there is more than one to tell apart. */}
          <span className="text-ink-faint pt-2 text-micro tabular">
            {numbered ? i + 1 : ''}
          </span>

          <div className="space-y-1">
            <span className="text-ink-muted text-micro sm:hidden">Complexity</span>
            <Segmented
              name={`Complexity for variation ${i + 1}`}
              options={COMPLEXITIES}
              value={variation.complexity}
              invalid={Boolean(errors[`variations.${i}.complexity`])}
              onChange={(v) => update(i, { complexity: v })}
            />
            {errors[`variations.${i}.complexity`] && (
              <p className="text-danger text-micro">
                {errors[`variations.${i}.complexity`]}
              </p>
            )}
          </div>

          <div className="space-y-1">
            <span className="text-ink-muted text-micro sm:hidden">Revisions</span>
            <Input
              type="number"
              min={0}
              step={1}
              aria-label={`Revisions for variation ${i + 1}`}
              value={variation.revisionCount}
              aria-invalid={Boolean(errors[`variations.${i}.revisionCount`])}
              onChange={(e) => update(i, { revisionCount: e.target.value })}
            />
            {errors[`variations.${i}.revisionCount`] && (
              <p className="text-danger text-micro">
                {errors[`variations.${i}.revisionCount`]}
              </p>
            )}
          </div>

          {/* One variation is the minimum, so nothing to remove in that case. */}
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label={`Remove variation ${i + 1}`}
            className={cn(
              'text-ink-faint hover:text-ink mt-1 flex size-7 items-center justify-center rounded-md transition-colors duration-[120ms]',
              !numbered && 'invisible',
            )}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}

      <div className={cn(GRID, 'items-baseline')}>
        <span />
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 sm:col-span-3">
          {/* A quiet text control, not another bordered block. */}
          <button
            type="button"
            onClick={add}
            className="text-ink-muted hover:text-ink flex items-center gap-1 text-micro transition-colors duration-[120ms]"
          >
            <Plus className="size-3" />
            Add variation
          </button>

          {allowance !== undefined && total > 0 && (
            <p className="text-ink-faint text-micro">
              {total} revision{total === 1 ? '' : 's'}, allowance {allowance}.{' '}
              {/* Two readings, so both are stated rather than picking one. */}
              <span className={perVariation > 0 ? 'text-beyond font-medium' : undefined}>
                {perVariation} beyond per variation
              </span>
              {', '}
              <span className={perDelivery > 0 ? 'text-beyond font-medium' : undefined}>
                {perDelivery} per delivery
              </span>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
