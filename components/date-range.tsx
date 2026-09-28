'use client'

import { Input } from '@/components/ui/input'
import { todayInIST } from '@/lib/format'

/**
 * A from/to date range, with a real calendar on each end.
 *
 * This replaced a bare `<input type="month">` on 2026-08-29, at the owner's
 * request, and it settles an open question in CLAUDE.md §9: reporting is over
 * **any range**, not calendar months only. That was always the more honest
 * shape — an agency asks "what did you ship between the 12th and the 3rd"
 * whenever a contract does not start on the 1st, and a month picker could only
 * answer a question nobody had asked yet.
 *
 * Two native date inputs rather than a drawn calendar component. `type="date"`
 * opens the platform's own picker, which is keyboard-navigable, localised and
 * accessible for free, and a hand-built popover would be several hundred lines
 * to arrive back where this starts.
 *
 * It briefly carried "this month" and "last month" shortcuts beside the two
 * fields; the owner removed them on 2026-08-29. The screen already opens on the
 * current month, so the common case costs nothing, and a pair of buttons that
 * only ever set the same two fields was furniture in a filter row that also
 * holds an agency and a person.
 */
export function DateRange({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}) {
  /**
   * Moving one end never lets it cross the other.
   *
   * Rather than refusing an invalid range with a message, the far end follows —
   * so dragging `from` past `to` reads as "one day", which is a coherent thing
   * to have asked for, and no state exists in which the screen shows a total
   * for a range that runs backwards.
   */
  function setFrom(value: string) {
    if (!value) return
    onChange({ from: value, to: value > to ? value : to })
  }

  function setTo(value: string) {
    if (!value) return
    onChange({ from: value < from ? value : from, to: value })
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-ink-muted flex items-center gap-2 text-micro">
        From
        <Input
          type="date"
          value={from}
          /* Nothing is delivered in the future (§5.1), so nothing is priced there. */
          max={todayInIST()}
          onChange={(e) => setFrom(e.target.value)}
          className="h-9 w-[9.5rem]"
        />
      </label>

      <label className="text-ink-muted flex items-center gap-2 text-micro">
        To
        <Input
          type="date"
          value={to}
          max={todayInIST()}
          onChange={(e) => setTo(e.target.value)}
          className="h-9 w-[9.5rem]"
        />
      </label>
    </div>
  )
}
