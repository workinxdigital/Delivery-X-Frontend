'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { getClientActivity, markActivitySeen } from '@/lib/api/client'
import { formatDateOnly, formatMoneyMinor } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Account activity, as a bell rather than a dashboard panel (owner, 2026-09-30).
 *
 * It was eight rows under the dashboard, which is the wrong shape for a feed:
 * too many to skim, too few to reconcile against, and it grows forever where a
 * dashboard should not. Same split the admin notification centre uses (§5.8).
 *
 * The count is fetched with the panel closed; the entries only when it opens,
 * so a background tab never pulls the whole ledger for nobody. Marked seen on
 * OPEN, not on close, so rows keep their marks while you read them even as the
 * badge clears.
 */
export function ClientActivityBell() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery({
    queryKey: ['client', 'activity'],
    queryFn: () => getClientActivity({ take: 12 }),
    /* A client's ledger changes when their PM logs something, which is not
       often — but the badge should not need a reload to notice. */
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    /* A money-blind account is refused this endpoint by design, so a 403 is an
       answer rather than a failure to retry. */
    retry: false,
  })

  const seen = useMutation({
    mutationFn: markActivitySeen,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['client', 'activity'] }),
  })

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /* Absent, not empty, when there is nothing this account can be shown. */
  if (!data) return null

  const unread = data.unread

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Account activity, ${unread} new` : 'Account activity'}
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next && unread > 0) seen.mutate()
        }}
        className="border-control text-ink-muted hover:text-ink hover:bg-wash relative flex h-8 w-8 items-center justify-center rounded-full border transition-colors duration-[120ms]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unread > 0 && (
          <span className="bg-lime text-noir border-paper absolute -top-1 -right-1 flex min-w-[1.125rem] items-center justify-center rounded-full border-2 px-1 text-[0.625rem] leading-[1.125rem] font-medium tabular">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="glass border-rule bg-surface shadow-pop absolute right-0 top-10 z-50 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-xl border">
          <div className="border-rule flex items-baseline justify-between border-b px-4 py-3">
            <p className="text-dense font-medium">Account activity</p>
            <p className="text-ink-muted tabular text-micro">
              {formatMoneyMinor(data.balance.availableMinor)} available
            </p>
          </div>

          {data.entries.length === 0 ? (
            <p className="text-ink-muted px-4 py-6 text-dense">Nothing yet.</p>
          ) : (
            <ul className="divide-rule max-h-[22rem] divide-y overflow-y-auto">
              {data.entries.map((e) => {
                const body = (
                  <>
                    <span className="min-w-0 grow">
                      <span className="block truncate text-dense">{e.description}</span>
                      <span className="text-ink-muted text-micro">{formatDateOnly(e.occurredOn)}</span>
                    </span>
                    <span
                      className={cn(
                        'tabular shrink-0 text-dense',
                        e.amountMinor > 0 ? 'text-ink font-medium' : 'text-ink-muted',
                      )}
                    >
                      {formatMoneyMinor(e.amountMinor)}
                    </span>
                  </>
                )
                /*
                  A row links out only where there is somewhere to go — a charge
                  belongs to a project, a deposit belongs to nothing. The same
                  rule the admin feed follows (§5.8): a link that lands nowhere
                  is worse than no link.
                */
                return (
                  <li key={e.id} className={cn(e.isNew && 'bg-wash/50')}>
                    {e.taskId ? (
                      <Link
                        href={`/client/projects/${e.taskId}`}
                        onClick={() => setOpen(false)}
                        className="hover:bg-wash flex items-start gap-3 px-4 py-2.5 transition-colors"
                      >
                        {body}
                      </Link>
                    ) : (
                      <span className="flex items-start gap-3 px-4 py-2.5">{body}</span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}

          <Link
            href="/client/activity"
            onClick={() => setOpen(false)}
            className="border-rule hover:bg-wash block border-t px-4 py-2.5 text-center text-micro transition-colors"
          >
            See everything
          </Link>
        </div>
      )}
    </div>
  )
}
