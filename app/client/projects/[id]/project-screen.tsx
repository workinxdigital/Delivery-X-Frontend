'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { CodePill, ComplexityPill, Pill } from '@/components/pill'
import { flagCharge, getClientProject } from '@/lib/api/client'
import { formatDateOnly, formatMoneyMinor } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * One project, and what happened to it (§6.4.3).
 *
 * Read-only but for one control: flagging a charge. Everything internal is
 * absent rather than hidden — who delivered it, the notes, the edit history and
 * the rate card logic never reach this response, so there is nothing here that
 * a careful reader could recover.
 */
export function ClientProjectScreen({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const [flagging, setFlagging] = useState<string | null>(null)
  const [note, setNote] = useState('')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['client', 'project', id],
    queryFn: () => getClientProject(id),
    retry: false,
  })

  const flag = useMutation({
    mutationFn: ({ entryId, text }: { entryId: string; text: string }) =>
      flagCharge(entryId, text || null),
    onSuccess: () => {
      toast('Flagged for review', {
        description: 'Your project manager has been notified. The amount is unchanged while it is looked at.',
      })
      setFlagging(null)
      setNote('')
      void queryClient.invalidateQueries({ queryKey: ['client', 'project', id] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That did not work'),
  })

  if (isLoading) return <p className="text-ink-muted py-16 text-center text-dense">Loading</p>
  /* A project on another account is a 404 here, not a 403 — for this reader it
     does not exist, which is also all the error needs to say. */
  if (isError || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink-muted text-dense">That project could not be found.</p>
        <Link href="/client/projects" className="text-ink-muted hover:text-ink mt-2 inline-block text-micro underline decoration-dotted underline-offset-2">
          Back to projects
        </Link>
      </div>
    )
  }

  const p = data.project

  return (
    <div className="space-y-8">
      <header>
        <Link href="/client/projects" className="text-ink-muted hover:text-ink text-micro underline decoration-dotted underline-offset-2">
          Projects
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="display text-[1.75rem] leading-tight font-semibold">{p.serviceName}</h1>
          <CodePill>{p.taskCode}</CodePill>
        </div>
        <p className="text-ink-muted mt-1 text-dense">
          {p.brandName}
          {p.productName ? ` · ${p.productName}` : ''} · delivered {formatDateOnly(p.deliveredOn)}
        </p>
        {p.asinCode && (
          <p className="mt-2">
            <CodePill label="ASIN">{p.asinCode}</CodePill>
          </p>
        )}
      </header>

      <section>
        <h2 className="display mb-3 text-[1.0625rem] font-semibold">What was delivered</h2>
        <div className="border-rule bg-surface divide-rule shadow-card divide-y overflow-hidden rounded-xl border">
          {p.variations.map((v, i) => {
            const label = p.hasParentLine && i === 0 ? 'Main product' : `Variation ${p.hasParentLine ? i : i + 1}`
            return (
              <div key={v.variationNumber} className="p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium">{v.productName || label}</span>
                  {v.complexity && <ComplexityPill complexity={v.complexity as never} />}
                  <span className="text-ink-muted ml-auto text-micro">
                    {v.rounds.length} revision {v.rounds.length === 1 ? 'round' : 'rounds'}
                  </span>
                </div>

                {v.rounds.length > 0 && (
                  <ol className="mt-3 space-y-1.5">
                    {v.rounds.map((r) => (
                      <li key={r.roundNumber} className="flex flex-wrap items-center gap-2 text-dense">
                        <span className="text-ink-muted w-16 text-micro">Round {r.roundNumber}</span>
                        <span className="text-ink-muted">{formatDateOnly(r.requestedOn)}</span>
                        {/* The client's contract vocabulary, not ours. */}
                        {r.included
                          ? <Pill tone="outline">included</Pill>
                          : <Pill tone="beyond">charged</Pill>}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-ink-muted mt-2 text-micro">
          {p.includedRounds} revision rounds are included on this project. Anything beyond that is charged.
        </p>
      </section>

      {data.canSeeMoney && p.charges && p.charges.length > 0 && (
        <section>
          <h2 className="display mb-3 text-[1.0625rem] font-semibold">Charges</h2>
          <ul className="border-rule bg-surface divide-rule shadow-card divide-y overflow-hidden rounded-xl border">
            {p.charges.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="min-w-0 grow">{c.description}</span>
                  {c.disputed && <Pill tone="beyond">flagged for review</Pill>}
                  <span className="text-ink-muted text-micro">{formatDateOnly(c.occurredOn)}</span>
                  <span className={cn('tabular w-28 text-right', c.amountMinor > 0 && 'text-ink')}>
                    {formatMoneyMinor(c.amountMinor)}
                  </span>
                </div>

                {/*
                  Flagging does not change the amount, and the copy says so
                  outright (§6.5). A client who thinks a flag reverses a charge
                  will not chase it, and will be surprised by the invoice.
                */}
                {!c.disputed && c.kind !== 'REVERSAL' && (
                  flagging === c.id ? (
                    <div className="border-rule bg-wash/50 mt-3 rounded-md border p-3">
                      <label className="text-ink-muted block text-micro" htmlFor={`note-${c.id}`}>
                        What looks wrong? (optional)
                      </label>
                      <textarea
                        id={`note-${c.id}`}
                        data-slot="input"
                        rows={2}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="border-control bg-surface mt-1 w-full rounded-md border px-2 py-1.5 text-dense"
                        placeholder="We only approved two variations"
                      />
                      <p className="text-ink-muted mt-2 text-micro">
                        The amount does not change while this is reviewed.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          disabled={flag.isPending}
                          onClick={() => flag.mutate({ entryId: c.id, text: note })}
                          className="border-control hover:bg-wash rounded-md border px-2.5 py-1 text-micro"
                        >
                          {flag.isPending ? 'Sending' : 'Send to my project manager'}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setFlagging(null); setNote('') }}
                          className="text-ink-muted hover:text-ink px-2 py-1 text-micro"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setFlagging(c.id); setNote('') }}
                      className="text-ink-muted hover:text-ink mt-2 text-micro underline decoration-dotted underline-offset-2"
                    >
                      Query this charge
                    </button>
                  )
                )}

                {c.disputed && c.disputeNote && (
                  <p className="text-ink-muted mt-2 text-micro">You said: {c.disputeNote}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
