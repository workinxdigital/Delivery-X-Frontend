import type { Complexity } from '@/lib/api/types'
import { COMPLEXITY_LABELS } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * A capsule for a categorical value.
 *
 * One component so every pill in the product is the same shape and size. Kept
 * tight — micro text, half-step vertical padding — so a table row gains almost
 * no height from carrying several.
 */
export function Pill({
  children,
  tone = 'neutral',
  className,
  title,
}: {
  children: React.ReactNode
  tone?: 'neutral' | 'outline' | 'tier1' | 'tier2' | 'tier3' | 'beyond'
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-micro whitespace-nowrap',
        tone === 'neutral' && 'bg-wash text-ink-muted',
        tone === 'outline' && 'border-rule-strong text-ink-muted border',
        tone === 'tier1' && 'bg-tier-1 text-ink-muted',
        tone === 'tier2' && 'bg-tier-2 text-ink',
        tone === 'tier3' && 'bg-tier-3 text-ink font-medium',
        // The one chromatic capsule. It means rounds past the allowance and
        // nothing else (§2.6). A count, never a charge.
        tone === 'beyond' && 'bg-beyond-wash text-beyond font-medium',
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Complexity tiers ramp by lightness rather than hue, so the ordering reads
 * without spending the accent colour on something that is not an exception.
 * Standalone is outlined instead: it is a different kind of work, not a higher
 * tier, so putting it at the top of the ramp would be a lie.
 */
const TIER_TONE: Record<Complexity, 'tier1' | 'tier2' | 'tier3' | 'outline'> = {
  LOW: 'tier1',
  MEDIUM: 'tier2',
  HIGH: 'tier3',
  STANDALONE: 'outline',
}

export function ComplexityPill({
  complexity,
  className,
}: {
  complexity: Complexity
  className?: string
}) {
  return (
    <Pill tone={TIER_TONE[complexity]} className={className}>
      {COMPLEXITY_LABELS[complexity]}
    </Pill>
  )
}
