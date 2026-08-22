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
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
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
              'text-dense px-2 py-2 transition-colors duration-[120ms]',
              // Hairline dividers between segments, not gaps: it is one control.
              i > 0 && 'border-control border-l',
              selected
                ? 'bg-ink text-primary-foreground font-medium'
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
