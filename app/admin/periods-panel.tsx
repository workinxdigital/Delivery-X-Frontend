'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Pill } from '@/components/pill'
import {
  getAdminPeriods,
  periodRowsCsvUrl,
  periodSummaryCsvUrl,
  setPeriodLock,
  type AdminPeriod,
} from '@/lib/api/client'
import { GhostButton, PanelHeader, Td, Th } from './panel-parts'

/**
 * Close a month, or reopen one (§5.6).
 *
 * Its own tab rather than a third panel on Billing. Billing answers "what is
 * this worth", which is read every day; closing a month happens once a month and
 * freezes what Billing reports — putting an irreversible-feeling action beside a
 * screen people skim was the wrong trade, and that screen has already been
 * trimmed twice for carrying too much.
 *
 * Every month the ledger has touched appears, newest first, whether or not
 * anything was delivered in it: an empty month is a fact worth seeing before you
 * go looking for the deliveries you expected to find in it.
 */
export function PeriodsPanel() {
  const queryClient = useQueryClient()
  const [confirming, setConfirming] = useState<string | null>(null)

  const { data: periods = [], isLoading } = useQuery({
    queryKey: ['admin', 'periods'],
    queryFn: getAdminPeriods,
  })

  const toggle = useMutation({
    mutationFn: ({ id, lock }: { id: string; lock: boolean }) => setPeriodLock(id, lock),
    onSuccess: (res) => {
      const closed = res.period.status === 'LOCKED'
      toast(closed ? `${monthName(res.period.periodStart)} is closed` : `${monthName(res.period.periodStart)} is open again`, {
        description: closed
          ? 'Nothing in it can be edited, and no delivery can be backdated into it.'
          : 'It can be edited again. The reopening is in the audit log.',
      })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'periods'] })
      /* The ledger and the record both show whether their period is locked. */
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That did not work'),
  })

  const pending = periods.find((p) => p.id === confirming)

  return (
    <div>
      {pending && (
        <ConfirmDialog
          title={
            pending.status === 'OPEN' ? (
              <>Close {monthName(pending.periodStart)}?</>
            ) : (
              <>Reopen {monthName(pending.periodStart)}?</>
            )
          }
          description={
            pending.status === 'OPEN'
              ? 'Nothing in it can be edited or removed afterwards, and no delivery can be backdated into it. A correction is logged in the current open month instead, referencing the original.'
              : 'It becomes editable again, and deliveries can be backdated into it. The reopening is written to the audit log.'
          }
          /*
            The numbers, because "are you sure" means nothing without them. An
            admin closing a month is freezing figures a partner will be billed
            from, and this is the last moment they can check them.
          */
          consequence={
            pending.status === 'OPEN'
              ? `Freezes ${pending.deliveries} deliver${pending.deliveries === 1 ? 'y' : 'ies'} across ${pending.agencies} agenc${pending.agencies === 1 ? 'y' : 'ies'}.`
              : undefined
          }
          confirmLabel={pending.status === 'OPEN' ? 'Close the month' : 'Reopen'}
          pendingLabel={pending.status === 'OPEN' ? 'Closing' : 'Reopening'}
          pending={toggle.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            toggle.mutate({ id: pending.id, lock: pending.status === 'OPEN' })
            setConfirming(null)
          }}
        />
      )}

      <PanelHeader
        title="Months"
        note="A closed month is frozen: nothing in it can be edited or removed, and no delivery can be backdated into it. Close one when its numbers have been agreed — reopening is possible and is written to the audit log."
      />

      <div className="border-rule bg-surface shadow-card overflow-hidden rounded-xl border">
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr className="border-rule-strong bg-wash/70 border-b">
              <Th>Month</Th>
              <Th>Deliveries</Th>
              <Th>Variations</Th>
              <Th>Rounds</Th>
              <Th>Agencies</Th>
              <Th>Status</Th>
              <Th>Export</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-rule divide-y">
            {isLoading && (
              <tr>
                <td className="text-ink-muted px-4 py-3 text-dense" colSpan={8}>
                  Loading…
                </td>
              </tr>
            )}

            {!isLoading && periods.length === 0 && (
              <tr>
                <td className="text-ink-muted px-4 py-3 text-dense" colSpan={8}>
                  No months yet. One appears as soon as a delivery is logged.
                </td>
              </tr>
            )}

            {periods.map((p) => (
              <tr key={p.id}>
                <Td className="font-medium">{monthName(p.periodStart)}</Td>
                <Td className="tabular">{p.deliveries}</Td>
                <Td className="tabular">{p.variations}</Td>
                <Td className="tabular">
                  {p.revisionRounds}
                  {p.roundsBeyondAllowance > 0 && (
                    <span className="text-beyond ml-1.5 text-micro">
                      {p.roundsBeyondAllowance} beyond
                    </span>
                  )}
                </Td>
                <Td className="tabular">{p.agencies}</Td>
                <Td>
                  {p.status === 'LOCKED' ? (
                    <Pill tone="outline" title={p.lockedAt ? `Closed ${formatWhen(p.lockedAt)}` : undefined}>
                      closed
                    </Pill>
                  ) : (
                    <span className="text-ink-muted text-micro">open</span>
                  )}
                </Td>
                {/*
                  Both exports, on every month whether it is closed or not.
                  §5.6 calls the close the handoff point, but a month's numbers
                  are wanted before it is frozen as often as after — that is
                  what closing it is a decision ABOUT. Plain links rather than
                  buttons, so the browser downloads them and a middle click
                  still works.
                */}
                <Td>
                  {p.deliveries === 0 ? (
                    <span className="text-ink-faint text-micro">nothing to export</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <DownloadLink
                        href={periodSummaryCsvUrl(p.id)}
                        title="One row per agency and service: deliveries, variations and revision rounds"
                      >
                        Summary
                      </DownloadLink>
                      <span className="text-ink-faint" aria-hidden>
                        ·
                      </span>
                      <DownloadLink
                        href={periodRowsCsvUrl(p.id)}
                        title="Every delivery in this month, one row each, with every column"
                      >
                        Deliveries
                      </DownloadLink>
                    </span>
                  )}
                </Td>

                <Td align="right" control>
                  <GhostButton
                    onClick={() => setConfirming(p.id)}
                    title={
                      p.status === 'OPEN'
                        ? 'Freeze this month'
                        : 'Make this month editable again'
                    }
                  >
                    {p.status === 'OPEN' ? 'Close' : 'Reopen'}
                  </GhostButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * A download, not a navigation.
 *
 * `download` alone does not name the file — the server's Content-Disposition
 * does, and it carries the month — so this only tells the browser to save
 * rather than to try rendering a CSV in a tab.
 */
function DownloadLink({
  href,
  title,
  children,
}: {
  href: string
  title: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      download
      title={title}
      className="text-ink-muted hover:text-ink text-micro underline decoration-dotted underline-offset-2 transition-colors"
    >
      {children}
    </a>
  )
}

/** "September 2026" — the month is the thing, so the day is noise. */
function monthName(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })
}
