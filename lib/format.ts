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
