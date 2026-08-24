/**
 * Display formatting.
 *
 * Everything renders in Asia/Kolkata (CLAUDE.md §4.3). Delivery dates arrive
 * from the API as plain 'YYYY-MM-DD' strings and are formatted without ever
 * being turned into a Date, because constructing a Date from a date-only
 * string and then formatting it in a timezone is exactly how a delivery ends
 * up displayed on the wrong day.
 */
export const IST = 'Asia/Kolkata'

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/** '2026-08-21' → '21 Aug 2026'. No Date object involved, so no zone shift. */
export function formatDateOnly(date: string): string {
  const [y, m, d] = date.split('-')
  if (!y || !m || !d) return date
  return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`
}

/** A real timestamp, rendered in IST: '21 Aug 2026, 4:12 PM'. */
export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: IST,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))
    .replace(',', ',')
}

/** Today in IST as 'YYYY-MM-DD' — the default for the delivery date field. */
export function todayInIST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date())
}

export const COMPLEXITY_LABELS = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  STANDALONE: 'Standalone',
} as const

export const STATUS_LABELS = {
  DELIVERED: 'Delivered',
  REVISION_IN_PROGRESS: 'In revision',
  CLOSED: 'Closed',
} as const

/**
 * Collapse a delivery's variation complexities into something scannable.
 *
 * Seven variations all at High rendered as "High + High + High + High + High +
 * High + High", which wrecked the ledger's column widths and said nothing the
 * variation count did not already say. This returns unique tiers instead, in
 * severity order rather than variation order so the column reads consistently
 * down the page, plus a full breakdown for the tooltip.
 */
export function summarizeComplexities(list: (keyof typeof COMPLEXITY_LABELS)[]): {
  label: string
  detail: string
} {
  if (list.length === 0) return { label: '', detail: '' }

  const counts = new Map<keyof typeof COMPLEXITY_LABELS, number>()
  for (const c of list) counts.set(c, (counts.get(c) ?? 0) + 1)

  const order = ['LOW', 'MEDIUM', 'HIGH', 'STANDALONE'] as const
  const present = order.filter((c) => counts.has(c))

  return {
    label: present.map((c) => COMPLEXITY_LABELS[c]).join(' + '),
    detail: present.map((c) => `${counts.get(c)} × ${COMPLEXITY_LABELS[c]}`).join(', '),
  }
}

/**
 * Turn a service category into something readable.
 *
 * Categories are free text in the catalogue so admins can add one without a
 * deploy (CLAUDE.md §4.4), which means they arrive as raw values like A_PLUS.
 * The transform is generic — underscores to spaces, title case — so a category
 * invented next quarter reads correctly with no code change. The override map
 * only covers the handful the generic rule would mangle.
 */
const CATEGORY_OVERRIDES: Record<string, string> = {
  A_PLUS: 'A+ content',
}

export function formatCategory(raw: string): string {
  const override = CATEGORY_OVERRIDES[raw]
  if (override) return override

  return raw
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((word, i) => (i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ')
}
