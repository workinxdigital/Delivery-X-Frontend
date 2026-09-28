import type { Complexity } from '@/lib/api/types'
import { summarizeComplexities } from '@/lib/format'

const BAR: Record<Complexity, string> = {
  LOW: 'bg-tier-1-bar',
  MEDIUM: 'bg-tier-2-bar',
  HIGH: 'bg-tier-3-bar',
  STANDALONE: 'bg-tier-standalone-bar',
}

/**
 * The tier mix of one delivery, as a strip rather than capsules.
 *
 * The ledger showed a capsule per distinct tier, which is right on a screen of
 * five deliveries and wrong on a screen of fifty: fifty rows carried ninety
 * filled capsules, and the Variations column grew to 215px — wider than Brand,
 * Agency or Service — to hold them. The noisiest column was also the one taking
 * the width that made every other column truncate mid-word.
 *
 * A strip says the same thing quietly. Segments are proportional, so three Low
 * and one High reads as mostly-Low at a glance, and the exact breakdown is on
 * the row's tooltip where it always was. Colour still means tier; it just stops
 * being the loudest thing on the page.
 *
 * The full capsules stay where there is room for them and where the tier is the
 * subject rather than a detail: the task record, the rate card, the statement.
 *
 * It describes the CHILDREN, not every row: the first row of a service is the
 * parent delivered plain and is not a variation (§2.4, owner 2026-08-31), so
 * counting it here would put a segment on the strip that the figure beside it
 * does not count.
 */
export function TierStrip({
  complexities,
  count,
}: {
  complexities: Complexity[]
  /** Variations delivered. Shown as the figure; the strip is the mix. */
  count: number
}) {
  // Drop the parent's own row: it is always the first, and it is not a child.
  const mix = summarizeComplexities(complexities.slice(1))

  return (
    <span className="inline-flex items-center gap-2">
      <span className="text-ink tabular">{count}</span>

      {mix.counts.length > 0 && (
        <span
          aria-hidden
          /*
            Fixed width, so the strips line up down the column and the eye can
            compare mixes row to row. A strip that sized itself to its content
            would make every row a different shape and undo the point.
          */
          className="bg-wash flex h-[3px] w-11 overflow-hidden rounded-full"
        >
          {mix.counts.map(({ tier, count: n }) => (
            <span key={tier} className={BAR[tier]} style={{ flexGrow: n }} />
          ))}
        </span>
      )}

      {/* The strip is decorative to a screen reader; this is the real content. */}
      <span className="sr-only">{mix.detail}</span>
    </span>
  )
}
