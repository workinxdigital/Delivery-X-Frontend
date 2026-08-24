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
 * The variations of one delivery, each with its own complexity and its own
 * revision count.
 *
 * This replaced a single complexity plus a bare variation count, because
 * variation 1 can be a low-complexity pass that needed two revisions while
 * variation 2 was high complexity and needed six. A count could not carry that.
 *
 * Rows are numbered rather than labelled, and the numbering is positional: the
 * server assigns variation numbers in the order sent, so removing row 1
 * renumbers the rest. That matches how a PM thinks about "variation 2".
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

  // Both readings, computed the same way the server will (§2.6).
  const perVariation =
    allowance === undefined
      ? 0
      : counts.reduce((sum, n) => sum + Math.max(0, n - allowance), 0)
  const perDelivery = allowance === undefined ? 0 : Math.max(0, total - allowance)

  return (
    <div className="space-y-3">
      {/*
        Column labels, once per service section rather than repeated on every
        row. Without them the segmented control and the number box are just
        shapes: you cannot tell what the number counts.
      */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-[2.5rem_1fr_5.5rem_1.75rem]">
        <span />
        <span className="text-ink-muted text-micro font-medium">Complexity</span>
        <span className="text-ink-muted text-micro font-medium">Revisions</span>
        <span />
      </div>

      <div className="space-y-2">
        {variations.map((variation, i) => (
          <div
            key={i}
            className="grid items-start gap-3 sm:grid-cols-[2.5rem_1fr_5.5rem_1.75rem]"
          >
            <span
              className="text-ink-muted pt-2.5 text-dense whitespace-nowrap"
              title={`Variation ${i + 1}`}
            >
              #{i + 1}
            </span>

            <div className="space-y-1">
              <span className="text-ink-muted text-micro font-medium sm:hidden">
                Complexity
              </span>
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
              <span className="text-ink-muted text-micro font-medium sm:hidden">
                Revisions
              </span>
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

            {/* One variation is the minimum, so the last row cannot be removed. */}
            <button
              type="button"
              onClick={() => remove(i)}
              disabled={variations.length === 1}
              aria-label={`Remove variation ${i + 1}`}
              className={cn(
                'text-ink-faint hover:text-ink hover:bg-wash mt-1 flex size-7 items-center justify-center rounded-md transition-colors duration-[120ms]',
                variations.length === 1 && 'invisible',
              )}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={add}
          className="border-control text-ink-muted hover:text-ink hover:bg-wash flex items-center gap-1.5 rounded-md border px-2 py-1 text-micro transition-colors duration-[120ms]"
        >
          <Plus className="size-3" />
          Add variation
        </button>

        {allowance !== undefined && total > 0 && (
          <p className="text-ink-muted text-micro">
            {total} revision{total === 1 ? '' : 's'} across {variations.length} variation
            {variations.length === 1 ? '' : 's'}, allowance {allowance}.{' '}
            {/* Two readings, so both are stated rather than picking one. */}
            <span className={perVariation > 0 ? 'text-beyond font-medium' : undefined}>
              {perVariation} beyond per variation
            </span>
            {', '}
            <span className={perDelivery > 0 ? 'text-beyond font-medium' : undefined}>
              {perDelivery} beyond per delivery
            </span>
            .
          </p>
        )}
      </div>
    </div>
  )
}
