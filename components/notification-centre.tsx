'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, PackageCheck, Receipt, RotateCcw, SlidersHorizontal } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import {
  clearNotifications,
  getNotifications,
  getUnreadCount,
  markNotificationsSeen,
} from '@/lib/api/client'
import type { Notification } from '@/lib/api/types'
import { cn } from '@/lib/utils'

/**
 * The notification centre.
 *
 * A window onto `audit_log`, which §4.2 already requires on every mutation — so
 * nothing can happen in this system without appearing here, and there is no
 * second write path to keep in step.
 *
 * Shaped after the reference the owner gave: rows grouped under a date, each
 * with a filled circular badge, a bold line and a quieter one, and the time on
 * the right. Groups sit in one rounded card with hairlines between rows rather
 * than as separate floating cards — which is what makes a long feed read as a
 * list instead of a pile.
 */
export function NotificationCentre() {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  /*
   * The count polls; the feed does not.
   *
   * A count is one cheap query and is the only thing visible while the panel is
   * shut. The entries are fetched when it opens, which keeps a background tab
   * from pulling forty rows every half minute for nobody to read.
   */
  const { data: unread = 0 } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'feed'],
    queryFn: () => getNotifications(40),
    enabled: open,
  })

  const seen = useMutation({
    mutationFn: markNotificationsSeen,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', 'unread'] }),
  })

  const clear = useMutation({
    mutationFn: clearNotifications,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  /*
   * Marked as seen on open, not on close.
   *
   * The rows keep their unread mark for as long as the panel is open, so you
   * can still see what was new while you are reading it — the badge clears, the
   * marks do not, and both are correct.
   */
  useEffect(() => {
    if (open && unread > 0) seen.mutate()
    // seen.mutate is stable; re-running on every render would be a write loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    function onClickAway(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', onClickAway)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  const groups = groupByDay(data?.entries ?? [])

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        className={cn(
          'border-rule-strong text-ink-muted hover:text-ink hover:border-control hover:bg-wash relative flex size-[2.125rem] shrink-0 items-center justify-center rounded-full border transition-colors duration-[120ms]',
          open && 'border-control text-ink bg-wash',
        )}
      >
        <Bell className="size-4" />

        {/*
          The count sits on the bell as a lime disc — lime is identity and
          "there is something here" is exactly that, where the red would claim
          something had gone wrong.
        */}
        {unread > 0 && (
          <span className="bg-lime text-noir border-paper absolute -top-1 -right-1 flex min-w-[1.125rem] items-center justify-center rounded-full border-2 px-1 text-[0.625rem] leading-[1.125rem] font-medium tabular">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="glass border-rule bg-surface shadow-pop absolute right-0 z-50 mt-2 w-[23rem] max-w-[calc(100vw-2rem)] rounded-2xl border p-3"
        >
          <div className="flex items-baseline justify-between gap-3 px-1.5 pt-0.5 pb-2.5">
            <h2 className="display text-[0.9375rem] font-semibold">Notifications</h2>

            {/*
              Clear is offered only when there is something to clear, and says
              "clear" rather than "delete" because that is what it does: it
              hides these from this person's panel. audit_log keeps every row.
            */}
            {(data?.entries.length ?? 0) > 0 ? (
              <button
                type="button"
                onClick={() => clear.mutate()}
                disabled={clear.isPending}
                title="Hide these from your panel. Nothing is deleted — the audit log keeps every entry."
                className="text-ink-muted hover:text-ink text-micro underline decoration-dotted underline-offset-2 transition-colors duration-[120ms] disabled:opacity-50"
              >
                {clear.isPending ? 'Clearing' : 'Clear all'}
              </button>
            ) : (
              <span className="text-ink-faint text-micro">
                {unread > 0 ? `${unread} new` : 'all caught up'}
              </span>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {isLoading && (
              <p className="text-ink-muted px-1.5 py-8 text-center text-micro">Loading</p>
            )}

            {data && data.entries.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-ink-muted text-micro">
                  {data.clearedAt ? 'Nothing new since you cleared this.' : 'Nothing has happened yet.'}
                </p>
                {/* Said plainly, because "clear" reads like "delete" and this
                    system never deletes a record of what happened. */}
                {data.clearedAt && (
                  <p className="text-ink-faint mt-1 text-micro">
                    Cleared entries are hidden from your panel only — every one is still in
                    the audit log.
                  </p>
                )}
              </div>
            )}

            {groups.map((group) => (
              <section key={group.label} className="mb-3 last:mb-0">
                {/* The date label sits between the cards, as in the reference. */}
                <div className="text-ink-faint px-1.5 pb-1.5 text-micro font-medium tracking-[0.06em] uppercase">
                  {group.label}
                </div>

                {/* One rounded block per day, hairlines between rows inside it. */}
                <div className="border-rule bg-paper/60 divide-rule divide-y overflow-hidden rounded-xl border">
                  {group.entries.map((entry) => (
                    <Row key={entry.id} entry={entry} onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * One entry.
 *
 * A link when there is somewhere to go and a plain block when there is not — a
 * rate change has no page of its own, and making it look clickable would be a
 * lie the cursor tells before the click does.
 */
function Row({ entry, onNavigate }: { entry: Notification; onNavigate: () => void }) {
  const body = (
    <>
      <Badge kind={entry.kind} />

      <span className="min-w-0 grow">
        <span className="text-dense text-ink block leading-snug font-medium">{entry.title}</span>
        <span className="text-ink-muted mt-0.5 block truncate text-micro">
          {[entry.detail, timeAgo(entry.createdAt)].filter(Boolean).join(' · ')}
        </span>
      </span>

      {/*
        Unread is a lime dot rather than a filled row: forty tinted rows would
        be a wall, and the dot survives being scrolled past.
      */}
      {entry.unread && (
        <span aria-label="Unread" className="bg-lime mt-1.5 size-1.5 shrink-0 rounded-full" />
      )}
    </>
  )

  const shell = 'flex items-start gap-3 px-3 py-2.5 text-left'

  return entry.href ? (
    <Link href={entry.href} onClick={onNavigate} className={cn(shell, 'hover:bg-wash block')}>
      <span className="flex items-start gap-3">{body}</span>
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  )
}

/**
 * The badge, carrying the only colour on the row.
 *
 * Lime for a delivery, because that is what this product exists to record. The
 * warning red only for revision rounds, which is where scope leaks (§5.4).
 * Everything else is neutral — housekeeping is not news.
 */
function Badge({ kind }: { kind: Notification['kind'] }) {
  const map = {
    delivery: { icon: PackageCheck, className: 'bg-lime text-noir' },
    revision: { icon: RotateCcw, className: 'bg-beyond-wash text-beyond' },
    pricing: { icon: Receipt, className: 'bg-wash text-ink-muted' },
    admin: { icon: SlidersHorizontal, className: 'bg-wash text-ink-muted' },
  } as const

  const { icon: Icon, className } = map[kind]

  return (
    <span
      aria-hidden
      className={cn('flex size-8 shrink-0 items-center justify-center rounded-full', className)}
    >
      <Icon className="size-3.5" />
    </span>
  )
}

/** Grouped under a day, newest first, matching how the feed is already ordered. */
function groupByDay(entries: Notification[]) {
  const groups: { label: string; entries: Notification[] }[] = []

  for (const entry of entries) {
    const label = dayLabel(entry.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.entries.push(entry)
    else groups.push({ label, entries: [entry] })
  }

  return groups
}

/** Rendered in IST like every other date in the product (§4.3). */
function dayLabel(iso: string): string {
  const date = new Date(iso)
  const day = (d: Date) =>
    d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'short', day: 'numeric' })

  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  if (day(date) === day(now)) return 'Today'
  if (day(date) === day(yesterday)) return 'Yesterday'
  return day(date)
}

/** "3h ago". Short, because the row is already carrying a sentence. */
function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-GB', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
  })
}
