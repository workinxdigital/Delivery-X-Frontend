'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CodePill, Pill } from '@/components/pill'
import { Input } from '@/components/ui/input'
import { getDisputes, hideDispute, resolveDispute } from '@/lib/api/client'
import { formatDateOnly, formatMoneyMinor, formatTimestamp } from '@/lib/format'
import { GhostButton, PanelHeader, PrimaryButton } from './panel-parts'

/**
 * Lines a client has queried, and what to do about them (§6.5).
 *
 * Its own tab because it is a queue you work through, not a property of an
 * agency — the question "is anything waiting on me" should be answerable
 * without opening a client first.
 *
 * Two outcomes, both final and both audited. Dismiss clears the flag and leaves
 * the charge standing; credit posts a reversal beside it. The original entry
 * survives either way, because a client who queried a line needs to see what
 * happened to it — a charge that silently vanished is indistinguishable from a
 * charge that was never right.
 */
export function DisputesPanel() {
  const queryClient = useQueryClient()
  const [acting, setActing] = useState<{ id: string; action: 'DISMISS' | 'CREDIT' } | null>(null)
  const [reason, setReason] = useState('')
  /** Which row is being cleared off this list without an answer. */
  const [clearing, setClearing] = useState<string | null>(null)

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['admin', 'disputes'],
    queryFn: getDisputes,
  })

  const clear = useMutation({
    mutationFn: (id: string) => hideDispute(id),
    onSuccess: () => {
      toast('Cleared from this list', {
        description: 'The query stays open on the client\u2019s side — nothing was answered.',
      })
      setClearing(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'disputes'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not clear it'),
  })

  const resolve = useMutation({
    mutationFn: () => resolveDispute(acting!.id, acting!.action, reason.trim()),
    onSuccess: (r) => {
      toast(r.action === 'CREDIT' ? 'Credited back' : 'Flag cleared', {
        description:
          r.action === 'CREDIT'
            ? 'A credit is on their statement beside the original charge.'
            : 'The charge stands. The client can see it is no longer under review.',
      })
      setActing(null)
      setReason('')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'disputes'] })
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ledger'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That did not work'),
  })

  return (
    <div>
      <PanelHeader
        title="Queries"
        note="Charges a client has flagged. Flagging never moves money — the amount stands until you decide. Dismiss leaves the charge; credit posts a reversal beside it, and the original stays on their statement either way."
      />

      {isLoading && <p className="text-ink-muted text-dense">Loading</p>}

      {!isLoading && disputes.length === 0 && (
        <p className="text-ink-muted border-rule bg-surface rounded-xl border p-6 text-dense">
          Nothing is waiting on you.
        </p>
      )}

      <ul className="space-y-3">
        {disputes.map((d) => (
          <li key={d.id} className="border-rule bg-surface shadow-card rounded-xl border p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-medium">{d.agency.name}</span>
              {d.brand && <span className="text-ink-muted text-dense">{d.brand.name}</span>}
              {d.task && (
                <Link href={`/ledger/${d.task.id}`}>
                  <CodePill>{d.task.taskCode}</CodePill>
                </Link>
              )}
              <span className="tabular ml-auto font-medium">{formatMoneyMinor(d.amountMinor)}</span>
            </div>

            <p className="mt-1.5 text-dense">{d.description}</p>
            <p className="text-ink-muted mt-0.5 text-micro">
              Charged {formatDateOnly(d.occurredOn)} · queried {formatTimestamp(d.disputedAt)}
              {d.disputedBy ? ` by ${d.disputedBy.name}` : ''}
            </p>

            {d.disputeNote && (
              <p className="border-rule bg-wash/60 mt-3 rounded-md border p-3 text-dense">
                &ldquo;{d.disputeNote}&rdquo;
              </p>
            )}

            {acting?.id === d.id ? (
              <form
                className="mt-3"
                onSubmit={(e) => { e.preventDefault(); resolve.mutate() }}
              >
                <label className="text-ink-muted block text-micro" htmlFor={`reason-${d.id}`}>
                  {/* The client reads this (owner, 2026-10-01). It used to say the
                      opposite — written when the reason reached the audit log and
                      nowhere else — and an admin typing a note they believe is
                      private into a box the client will read is the worst version
                      of this screen. */}
                  {acting.action === 'CREDIT'
                    ? 'Why is this being credited? The client sees this on their query.'
                    : 'Why is the charge standing? The client sees this on their query.'}
                </label>
                <Input
                  id={`reason-${d.id}`}
                  className="mt-1"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  autoFocus
                />
                <div className="mt-2 flex items-center gap-2">
                  <PrimaryButton type="submit" disabled={resolve.isPending || !reason.trim()}>
                    {resolve.isPending
                      ? 'Saving'
                      : acting.action === 'CREDIT' ? 'Credit it back' : 'Dismiss the query'}
                  </PrimaryButton>
                  <GhostButton type="button" onClick={() => { setActing(null); setReason('') }}>
                    Cancel
                  </GhostButton>
                </div>
              </form>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <GhostButton onClick={() => { setActing({ id: d.id, action: 'CREDIT' }); setReason('') }}>
                  Credit it back
                </GhostButton>
                <GhostButton onClick={() => { setActing({ id: d.id, action: 'DISMISS' }); setReason('') }}>
                  Charge stands
                </GhostButton>
                {/*
                  Clearing the queue is not answering (owner, 2026-10-01). It
                  takes the row off this list and leaves the query open on the
                  client's, so it sits apart from the two that decide something
                  and says what it does rather than reading as a third verdict.
                */}
                <button
                  type="button"
                  onClick={() => setClearing(d.id)}
                  className="text-ink-faint hover:text-ink ml-auto text-micro underline decoration-dotted underline-offset-2"
                >
                  Clear from this list
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {/*
        The same dialog every other removal uses (§5.5), and for the same
        reason: it names what actually happens. "Clear" reads like "delete",
        and this one deletes nothing.
      */}
      {clearing && (
        <ConfirmDialog
          title="Clear this query from the list?"
          description="It comes off this queue without being answered."
          consequence="The client keeps seeing their query, and nothing about the charge changes."
          confirmLabel="Clear it"
          pendingLabel="Clearing"
          pending={clear.isPending}
          onConfirm={() => clear.mutate(clearing)}
          onCancel={() => setClearing(null)}
        />
      )}
    </div>
  )
}
