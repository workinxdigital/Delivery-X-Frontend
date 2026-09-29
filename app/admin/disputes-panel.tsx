'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { CodePill, Pill } from '@/components/pill'
import { Input } from '@/components/ui/input'
import { getDisputes, resolveDispute } from '@/lib/api/client'
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

  const { data: disputes = [], isLoading } = useQuery({
    queryKey: ['admin', 'disputes'],
    queryFn: getDisputes,
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
                  {acting.action === 'CREDIT'
                    ? 'Why is this being credited? The client does not see this, but the audit log keeps it.'
                    : 'Why is the charge standing? Recorded for whoever reads this later.'}
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
              <div className="mt-3 flex gap-2">
                <GhostButton onClick={() => { setActing({ id: d.id, action: 'CREDIT' }); setReason('') }}>
                  Credit it back
                </GhostButton>
                <GhostButton onClick={() => { setActing({ id: d.id, action: 'DISMISS' }); setReason('') }}>
                  Charge stands
                </GhostButton>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
