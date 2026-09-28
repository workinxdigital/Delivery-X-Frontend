'use client'

import { cn } from '@/lib/utils'

/**
 * Segmented control for an ordered scale.
 *
 * Complexity runs Low → High, so it reads left to right in a single row. The
 * 2×2 grid this replaces destroyed that ordering, and made the choice look like
 * unrelated buttons.
 *
 * `clearable` makes the selected segment a toggle: clicking it again returns
 * the control to nothing selected. Complexity needs that, because choosing no
 * tier is a real answer — it means the plain version of the service — and
 * without it a tier picked by mistake could never be taken back.
 *
 * Arrow keys move between segments, so the whole form stays keyboard-driveable.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  invalid,
  name,
  clearable,
  disabled,
  title,
  compact,
}: {
  options: { value: T; label: string }[]
  value: T | ''
  onChange: (value: T | '') => void
  invalid?: boolean
  name: string
  /** Clicking the selected segment clears it rather than doing nothing. */
  clearable?: boolean
  /**
   * Present but not yet answerable.
   *
   * A control that cannot be used yet is still better than a sentence
   * explaining its absence: it holds its column width, so the row does not
   * reflow the moment a condition is met, and its shape says what will appear
   * there. `title` carries the reason.
   */
  disabled?: boolean
  title?: string
  /**
   * Tighter segments, for a control sharing a table row with five others.
   * The scale it shows is the same; only the air around the labels goes.
   */
  compact?: boolean
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      aria-disabled={disabled || undefined}
      title={title}
      className={cn(
        'border-control bg-surface grid overflow-hidden rounded-md border',
        `grid-cols-${options.length}`,
        invalid && 'border-danger',
        disabled && 'opacity-45',
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
            disabled={disabled}
            tabIndex={disabled ? -1 : selected || (!value && i === 0) ? 0 : -1}
            title={clearable && selected ? 'Click again to clear' : undefined}
            onClick={() => onChange(clearable && selected ? '' : option.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              e.preventDefault()
              const step = e.key === 'ArrowRight' ? 1 : -1
              const next = options[(i + step + options.length) % options.length]
              if (next) onChange(next.value)
            }}
            className={cn(
              'py-1.5 text-micro whitespace-nowrap transition-colors duration-[120ms]',
              compact ? 'px-1.5' : 'px-2 sm:text-dense',
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
              disabled && 'cursor-not-allowed hover:bg-transparent hover:text-ink-muted',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
