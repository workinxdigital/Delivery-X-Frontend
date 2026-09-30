'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/field'
import { Input } from '@/components/ui/input'
import { getAdminBrands, getAgencyLedger, postLedgerEntry } from '@/lib/api/client'
import { formatMoneyMinor, todayInIST } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GhostButton, PrimaryButton } from './panel-parts'

/**
 * Record what a client has paid, where their rates are set (owner, 2026-09-30).
 *
 * Setting up an account is one sitting: the details, what they pay per service,
 * and what they have paid in. Sending the last of those to a different panel
 * meant the person who had just agreed a deposit had to go and find somewhere
 * else to put it.
 *
 * ONE POOL PER ACCOUNT (§6.2). A payment may name the brand it came from,
 * because a client with three brands often pays per brand and wants to see
 * that on their statement — but it credits the ACCOUNT. Per-brand pools would
 * split the balance into wallets that each run out separately, which is a
 * different product from the one specified.
 */
export function AgencyPayment({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [occurredOn, setOccurredOn] = useState(todayInIST())
  const [description, setDescription] = useState('')
  const [brandId, setBrandId] = useState('')

  const { data: ledger } = useQuery({
    queryKey: ['admin', 'ledger', agencyId],
    queryFn: () => getAgencyLedger(agencyId),
  })
  const { data: brands = [] } = useQuery({
    queryKey: ['admin', 'brands', agencyId],
    queryFn: () => getAdminBrands(agencyId),
  })

  const post = useMutation({
    mutationFn: () => {
      /* Typed in whole currency, sent in cents: money in floating point drifts,
         and the API takes an integer minor unit for that reason (§1). */
      const minor = Math.round(Number(amount.replace(/[^0-9.-]/g, '')) * 100)
      return postLedgerEntry(agencyId, {
        kind: 'DEPOSIT_CREDIT',
        amountMinor: Math.abs(minor),
        occurredOn,
        description: description.trim() || 'Payment received',
        ...(brandId ? { brandId } : {}),
      })
    },
    onSuccess: () => {
      toast('Payment recorded', {
        description: `${agencyName} can see it on their statement straight away.`,
      })
      setAmount(''); setDescription(''); setBrandId(''); setOpen(false)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'ledger', agencyId] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That did not work'),
  })

  const typed = (() => {
    const n = Number(amount.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(n) && amount.trim() !== '' ? Math.abs(Math.round(n * 100)) : null
  })()
  const after = ledger && typed !== null ? ledger.balance.availableMinor + typed : null

  return (
    <div className="border-rule bg-wash/40 rounded-lg border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h4 className="text-dense font-medium">What {agencyName} has paid in</h4>
          <p className="text-ink-muted mt-0.5 text-micro">
            {ledger
              ? `${formatMoneyMinor(ledger.balance.creditedMinor)} received · ${formatMoneyMinor(ledger.balance.availableMinor)} left`
              : 'Loading'}
          </p>
        </div>
        {!open && <GhostButton onClick={() => setOpen(true)}>Record a payment</GhostButton>}
      </div>

      {open && (
        <form
          className="mt-4 grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); post.mutate() }}
        >
          <Field label="Amount received">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="10000.00" autoFocus inputMode="decimal" />
          </Field>
          <Field label="Dated">
            <Input type="date" value={occurredOn} onChange={(e) => setOccurredOn(e.target.value)} />
          </Field>
          <Field label="What the client will read">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="October deposit" />
          </Field>
          {brands.length > 0 && (
            <Field
              label="Paid for"
              hint="Optional. The money goes to the account either way — this only labels where it came from."
            >
              <select
                data-slot="control"
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="border-control bg-surface h-9 w-full rounded-md border px-2.5 text-dense"
              >
                <option value="">The account as a whole</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </Field>
          )}

          {after !== null && typed !== null && typed > 0 && ledger && (
            <p className="text-ink-muted text-micro sm:col-span-2">
              Available now <span className="tabular text-ink">{formatMoneyMinor(ledger.balance.availableMinor)}</span>
              {' → after this '}
              <span className={cn('tabular text-ink font-medium')}>{formatMoneyMinor(after)}</span>
              {ledger.balance.availableMinor > 0 && (
                <> · their remaining {formatMoneyMinor(ledger.balance.availableMinor)} is carried, not replaced</>
              )}
            </p>
          )}

          <div className="flex items-center gap-2 sm:col-span-2">
            <PrimaryButton type="submit" disabled={post.isPending || !typed}>
              {post.isPending ? 'Recording' : 'Record payment'}
            </PrimaryButton>
            <GhostButton type="button" onClick={() => { setOpen(false); setAmount(''); setDescription(''); setBrandId('') }}>
              Cancel
            </GhostButton>
          </div>
        </form>
      )}
    </div>
  )
}
