'use client'

import { cn } from '@/lib/utils'

/**
 * Segmented control for an ordered scale.
 *
 * Complexity runs Low → Standalone, so it reads left to right in a single row.
 * The 2×2 grid this replaces destroyed that ordering, and made a four-way
 * choice look like four unrelated buttons.
 *
 * Arrow keys move between segments, so the whole form stays keyboard-driveable.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  invalid,
  name,
}: {
  options: { value: T; label: string }[]
  value: T | ''
  onChange: (value: T) => void
  invalid?: boolean
  name: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={cn(
        'border-control bg-surface grid overflow-hidden rounded-md border',
        `grid-cols-${options.length}`,
        invalid && 'border-danger',
      )}
      /*
       * minmax(max-content, 1fr), not minmax(0, 1fr).
       *
       * Equal columns that may shrink to zero clipped the longest label —
       * "Standalone" lost its last characters whenever the row got tight. Now
       * the segments share space when there is space and refuse to go below
       * their text when there is not.
       */
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(max-content, 1fr))` }}
    >
      {options.map((option, i) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected || (!value && i === 0) ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              e.preventDefault()
              const step = e.key === 'ArrowRight' ? 1 : -1
              const next = options[(i + step + options.length) % options.length]
              if (next) onChange(next.value)
            }}
            className={cn(
              'px-2 py-1.5 text-micro whitespace-nowrap transition-colors duration-[120ms] sm:text-dense',
              // Hairline dividers between segments, not gaps: it is one control.
              i > 0 && 'border-control border-l',
              /*
               * No weight change on selection. Bold text is wider, so the
               * segments — and with them the whole row — resized whenever the
               * choice changed, and "Standalone" being the longest label made
               * that jump visible. The ink fill is emphasis enough.
               */
              selected
                ? 'bg-ink text-primary-foreground'
                : 'text-ink-muted hover:bg-wash hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
