'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/field'
import { Pill } from '@/components/pill'
import { Input } from '@/components/ui/input'
import { getAgencyLedger, postLedgerEntry } from '@/lib/api/client'
import { formatDateOnly, formatMoneyMinor, todayInIST } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GhostButton, PrimaryButton, Td, Th } from './panel-parts'

/**
 * An account's money: what came in, what it paid for, what is left (§6.5).
 *
 * Only two things can be posted from here — a deposit and an adjustment.
 * Charges are never typed: they are written by the act of logging a delivery or
 * a revision round, which is what makes the balance describe the work rather
 * than somebody's memory of it. A charge that was wrong is corrected by an
 * adjustment, visibly, rather than by editing the original.
 */
export function AgencyLedger({ agencyId, agencyName, billingMode }: {
  agencyId: string
  agencyName: string
  billingMode: 'DEPOSIT' | 'POSTPAID'
}) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState<'DEPOSIT_CREDIT' | 'ADJUSTMENT' | null>(null)
  const [amount, setAmount] = useState('')
  const [occurredOn, setOccurredOn] = useState(todayInIST())
  const [description, setDescription] = useState('')
  const [reason, setReason] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ledger', agencyId],
    queryFn: () => getAgencyLedger(agencyId),
  })

  const reset = () => { setAdding(null); setAmount(''); setDescription(''); setReason('') }

  const post = useMutation({
    mutationFn: () => {
      /*
       * Typed in whole currency, stored in cents. Parsed here rather than
       * trusting a float across the wire: money in floating point drifts, and
       * the API takes an integer minor unit for exactly that reason (§1).
       */
      const major = Number(amount.replace(/[^0-9.-]/g, ''))
      const minor = Math.round(major * 100)
      return postLedgerEntry(agencyId, {
        kind: adding!,
        /* A deposit is always money IN; an adjustment goes whichever way the
           admin typed it, which is what makes it an adjustment. */
        amountMinor: adding === 'DEPOSIT_CREDIT' ? Math.abs(minor) : minor,
        occurredOn,
        description: description.trim(),
        ...(adding === 'ADJUSTMENT' ? { reason: reason.trim() } : {}),
      })
    },
    onSuccess: () => {
      toast(adding === 'DEPOSIT_CREDIT' ? 'Deposit posted' : 'Adjustment posted', {
        description: 'It is on their statement immediately.',
      })
      reset()
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ledger', agencyId] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That did not work'),
  })

  const b = data?.balance

  return (
    <div>
      {b && (
        <div className="border-rule bg-surface mb-4 flex flex-wrap items-baseline justify-between gap-4 rounded-lg border p-4">
          <div>
            <p className="text-ink-muted text-micro uppercase tracking-wide">
              {billingMode === 'DEPOSIT' ? 'Available' : 'Accrued'}
            </p>
            <p className={cn('display mt-0.5 text-[1.5rem] leading-none font-semibold tabular',
              billingMode === 'DEPOSIT' && b.availableMinor < 0 && 'text-beyond')}>
              {formatMoneyMinor(billingMode === 'DEPOSIT' ? b.availableMinor : b.consumedMinor)}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-6 gap-y-2 text-dense">
            <Fig label="Paid in" value={formatMoneyMinor(b.creditedMinor)} />
            <Fig label="Projects" value={formatMoneyMinor(b.consumedProjectsMinor)} />
            <Fig label="Extra rounds" value={formatMoneyMinor(b.consumedRoundsMinor)} />
          </dl>
        </div>
      )}

      {adding ? (
        <form
          className="border-rule bg-wash/40 mb-4 grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); post.mutate() }}
        >
          <Field
            label={adding === 'DEPOSIT_CREDIT' ? 'Amount received' : 'Amount'}
            hint={adding === 'ADJUSTMENT' ? 'Negative takes money off their balance.' : undefined}
          >
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000.00" autoFocus inputMode="decimal" />
          </Field>
          <Field label="Dated">
            <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
          </Field>
          <Field label="What the client will read">
            <Input value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={adding === 'DEPOSIT_CREDIT' ? 'October deposit' : 'Goodwill credit'} />
          </Field>
          {adding === 'ADJUSTMENT' && (
            <Field label="Why" hint="Required. An unexplained correction on a bill costs an afternoon on the phone.">
              <Input value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
          <div className="flex items-center gap-2 sm:col-span-2">
            <PrimaryButton
              type="submit"
              disabled={
                post.isPending || !amount.trim() || !description.trim() ||
                (adding === 'ADJUSTMENT' && !reason.trim())
              }
            >
              {post.isPending ? 'Posting' : 'Post'}
            </PrimaryButton>
            <GhostButton type="button" onClick={reset}>Cancel</GhostButton>
          </div>
        </form>
      ) : (
        <div className="mb-3 flex gap-2">
          <GhostButton onClick={() => setAdding('DEPOSIT_CREDIT')}>Record a deposit</GhostButton>
          <GhostButton onClick={() => setAdding('ADJUSTMENT')}>Post an adjustment</GhostButton>
        </div>
      )}

      {isLoading ? (
        <p className="text-ink-muted text-micro">Loading</p>
      ) : (data?.entries.length ?? 0) === 0 ? (
        <p className="text-ink-muted text-micro">
          Nothing on {agencyName}&rsquo;s ledger yet. Charges appear the moment a delivery is logged.
        </p>
      ) : (
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr className="border-rule-strong border-b">
              <Th>Date</Th>
              <Th>What</Th>
              <Th>Project</Th>
              <Th align="right">Amount</Th>
            </tr>
          </thead>
          <tbody className="divide-rule divide-y">
            {data!.entries.map((e) => (
              <tr key={e.id}>
                <Td className="text-ink-muted whitespace-nowrap">{formatDateOnly(e.occurredOn)}</Td>
                <Td>
                  {e.description}
                  {e.disputed && <Pill tone="beyond" className="ml-1.5">flagged</Pill>}
                  {e.kind === 'REVERSAL' && <Pill tone="outline" className="ml-1.5">reversal</Pill>}
                </Td>
                <Td className="text-ink-muted">{e.taskCode ?? '—'}</Td>
                <Td align="right" className={cn('tabular whitespace-nowrap', e.amountMinor > 0 && 'text-ink')}>
                  {formatMoneyMinor(e.amountMinor)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-muted text-micro uppercase tracking-wide">{label}</dt>
      <dd className="tabular mt-0.5 font-medium">{value}</dd>
    </div>
  )
}
