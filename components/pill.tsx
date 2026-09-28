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
  tone?: 'neutral' | 'outline' | 'tier1' | 'tier2' | 'tier3' | 'standalone' | 'beyond'
  className?: string
  title?: string
}) {
  return (
    <span
      title={title}
      className={cn(
        // `pill` carries the material: a lit top edge on filled tones in the
        // dark, where a flat fill reads as a sticker rather than an object.
        'pill inline-flex items-center rounded-full px-2 py-0.5 text-micro whitespace-nowrap',
        tone === 'neutral' && 'bg-wash text-ink-muted',
        tone === 'outline' && 'border-rule-strong text-ink-muted border',
        /*
          Each tier brings its own text colour. On paper that resolves to ink on
          a pale fill; in the dark it is a bright version of the fill's own hue,
          which is what keeps the capsules vivid instead of muddy.
        */
        tone === 'tier1' && 'bg-tier-1 text-tier-1-ink',
        tone === 'tier2' && 'bg-tier-2 text-tier-2-ink',
        tone === 'tier3' && 'bg-tier-3 text-tier-3-ink font-medium',
        // Off the tier ramp, so it carries a hue the ramp does not (§2.4).
        tone === 'standalone' && 'bg-tier-standalone text-tier-standalone-ink',
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
  /*
   * STANDALONE says "standalone", the same word the rate card and the logging
   * form use.
   *
   * It briefly read "no tier" here, on the reasoning that a rate card names a
   * price while a work record describes an absence. That was too fine a
   * distinction to spend a second name on: one value with three labels across
   * three screens is just confusing, and the owner said so (2026-08-27).
   */
  if (complexity === 'STANDALONE') {
    return (
      <Pill
        tone="standalone"
        className={className}
        title="No tier chosen — the service delivered plain, at its flat base price"
      >
        standalone
      </Pill>
    )
  }

  return (
    <Pill tone={TIER_TONE[complexity]} className={className}>
      {COMPLEXITY_LABELS[complexity]}
    </Pill>
  )
}

/**
 * Which kind of client this is (§2.1).
 *
 * The two are a binary and were nearly invisible: AGENCY was a wash fill on
 * rows that turn wash on hover, so it disappeared under the cursor, and both
 * used muted text on a pale ground.
 *
 * Both now carry a border, which is what makes a capsule survive any row
 * background, and full-strength ink. The distinction is fill against no fill —
 * a partner who brings us other people's work reads as solid, a client who IS
 * the brand reads as outlined. That is a difference of kind, which is exactly
 * what this field records, and it needs no colour to say it: colour in this
 * product means rounds past the allowance, and an agency type is not an
 * exception to anything.
 */
export function AgencyTypePill({
  type,
  className,
}: {
  type: 'AGENCY' | 'DIRECT'
  className?: string
}) {
  return (
    <span
      title={
        type === 'DIRECT'
          ? 'A brand that engages us directly'
          : 'A white-label partner who brings us their clients'
      }
      className={cn(
        'pill border-rule-strong text-ink inline-flex items-center rounded-full border px-2 py-0.5 text-micro whitespace-nowrap',
        type === 'AGENCY' ? 'bg-wash' : 'bg-surface',
        className,
      )}
    >
      {type === 'DIRECT' ? 'Direct' : 'Agency'}
    </span>
  )
}

/**
 * A code, as a capsule.
 *
 * Task codes, variation codes, ASINs and ClickUp ids are the things somebody
 * quotes back at you — "what is WX-2026-0045-1", "which ASIN did that go on" —
 * and set as loose grey mono among prose they read as stray characters rather
 * than as identifiers. It is the same fault the statement's task code had
 * before it became a capsule (§5.7), and the same fix.
 *
 * Neutral, deliberately: the tier capsules carry this product's only meaningful
 * colour, and a coloured code would compete with them for a distinction it is
 * not making.
 */
export function CodePill({
  children,
  label,
  title,
  className,
}: {
  children: React.ReactNode
  /**
   * What kind of code this is, set inside the capsule.
   *
   * Where several codes sit on one line — a variation's own code, the child
   * ASIN it shipped for, its ClickUp task — they are the same shape and the
   * same grey, so without this the only way to tell which is which is to hover
   * each one. Omit it wherever a `<dt>` or a column heading already says.
   */
  label?: string
  title?: string
  className?: string
}) {
  return (
    <Pill
      tone="neutral"
      title={title}
      className={cn(
        // The hairline and why it is a shadow: see `.pill-code` in globals.css.
        'pill-code code text-ink',
        className,
      )}
    >
      {label && (
        <span className="text-ink-faint mr-1.5 font-sans text-micro tracking-[0.04em] uppercase">
          {label}
        </span>
      )}
      {children}
    </Pill>
  )
}
