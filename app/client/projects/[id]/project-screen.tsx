'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { CodePill, ComplexityPill, Pill } from '@/components/pill'
import { QueryThread } from '@/components/query-thread'
import { flagCharge, getClientProject, type ChargeDetail } from '@/lib/api/client'
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

  /* Flattened across variations and ordered by date, because a client reads the
     job as one story rather than as a set of parallel ones. */
  const allRounds = p.lines
    .flatMap((v) =>
      v.rounds.map((r) => ({
        ...r,
        variationNumber: v.variationNumber,
        product: p.lines.length > 1 ? v.productName : null,
      })),
    )
    .sort((a, b) => a.requestedOn.localeCompare(b.requestedOn))
  const rounds = allRounds.length
  const paid = allRounds.filter((r) => !r.included).length

  /*
   * Every event, in date order.
   *
   * Sorted rather than assembled in a fixed sequence, because a round can be
   * requested on any date (§5.1) and a timeline that printed the job's own date
   * first would show a round dated before it and call that a sequence.
   *
   * "Created on", not "Delivered": that is the name §5.1 gave `deliveredOn`
   * when the cap came off it, and the client panel is the last screen still
   * using the old word for it. The date the PM typed it in (`loggedOn`) was a
   * second row here until 2026-09-30 (owner) — two dates for one job, one of
   * them an internal bookkeeping fact the client has no use for.
   */
  const events = [
    ...allRounds.map((r) => ({
      key: `r-${r.variationNumber}-${r.roundNumber}`,
      date: r.requestedOn,
      label: `Revision round ${r.roundNumber}${r.product ? ` · ${r.product}` : ''}`,
      badge: (r.included ? 'included' : 'charged') as 'included' | 'charged',
      emphasis: false,
    })),
    { key: 'delivered', date: p.deliveredOn, label: 'Created on' as const, badge: undefined, emphasis: true },
    // On a shared date the job's own row leads: it is the thing the rounds are
    // rounds *on*. It used to sort last, when it read "Delivered" and meant the
    // culmination rather than the origin.
  ].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      Number(a.key !== 'delivered') - Number(b.key !== 'delivered'),
  )

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
          {p.productName ? ` · ${p.productName}` : ''}
        </p>
        {p.asinCode && (
          <p className="mt-2">
            <CodePill label="ASIN">{p.asinCode}</CodePill>
          </p>
        )}
      </header>

      {/*
        The facts of the job, on one hairline band rather than in boxes.
        A project with no revisions has nothing else to say about itself, and
        without these the page was a heading and a charge (owner, 2026-09-29).
      */}
      <section className="border-rule divide-rule flex flex-wrap divide-x border-y py-4">
        <Fact label="Created on" value={formatDateOnly(p.deliveredOn)} />
        <Fact label="Service" value={p.serviceName} />
        <Fact
          label="Variations"
          value={p.variations === 0 ? 'Main product only' : String(p.variations)}
        />
        <Fact
          label="Revisions"
          value={
            rounds === 0
              ? `None used of ${p.includedRounds}`
              : `${rounds} of ${p.includedRounds} included${paid > 0 ? ` · ${paid} charged` : ''}`
          }
          tone={paid > 0 ? 'beyond' : undefined}
        />
      </section>

      {/*
        The timeline §4.3 asks for. Logged and delivered always exist, so this
        is never empty — which is the difference between "nothing happened" and
        "nothing was recorded".
      */}
      <section>
        <h2 className="display mb-3 text-[1.0625rem] font-semibold">What happened</h2>
        <ol className="border-rule bg-surface divide-rule shadow-card divide-y overflow-hidden rounded-xl border">
          {events.map((e) => (
            <Event key={e.key} date={e.date} label={e.label} badge={e.badge} emphasis={e.emphasis} />
          ))}
        </ol>
      </section>

      <section>
        {/*
          What, not when. The rounds used to be listed again under each product
          and the timeline above already tells that story in date order — so the
          same five rounds appeared twice on one page. This section answers
          "which products, at what complexity"; the timeline answers "and then
          what happened".
        */}
        <h2 className="display mb-3 text-[1.0625rem] font-semibold">What was delivered</h2>
        <div className="border-rule bg-surface divide-rule shadow-card divide-y overflow-hidden rounded-xl border">
          {p.lines.map((v, i) => {
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

                {/*
                  The arithmetic, frozen when the charge was made (§6.3). A
                  total a client cannot take apart is a total they cannot check,
                  and the rate is shown rather than only the result — an amount
                  that cannot be reconciled is one nobody can defend.
                */}
                <ChargeWorking detail={c.detail} totalMinor={c.amountMinor} />

                {/*
                  The query and its answer, as an exchange (owner, 2026-10-01).

                  The note used to show only while the flag was open, so the
                  moment it was answered the client's own question vanished and
                  nothing took its place — which reads as having been ignored.
                  Both halves stay once there is a reply. Shared with the
                  Queries screen, so one conversation cannot be typeset two
                  ways.
                */}
                <QueryThread
                  className="mt-3"
                  note={c.disputeNote}
                  response={c.disputeResponse}
                  resolution={c.disputeResolution}
                  open={c.disputed}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: 'beyond' }) {
  return (
    <div className="grow px-5 first:pl-0">
      <dt className="text-ink-muted text-micro uppercase tracking-wide">{label}</dt>
      <dd className={cn('mt-0.5 font-medium', tone === 'beyond' && 'text-beyond')}>{value}</dd>
    </div>
  )
}

/**
 * One event on the job's timeline.
 *
 * The date leads, because the question a client opens this to answer is "when
 * did that happen" far more often than "what was it called".
 */
function Event({
  date,
  label,
  badge,
  emphasis,
}: {
  date: string
  label: string
  badge?: 'included' | 'charged'
  /** The delivery itself, which is the event the whole record is about. */
  emphasis?: boolean
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
      <span className="text-ink-muted w-28 shrink-0 text-micro tabular">{formatDateOnly(date)}</span>
      <span className={cn('min-w-0 grow', emphasis && 'font-medium')}>{label}</span>
      {badge && (badge === 'included' ? <Pill tone="outline">included</Pill> : <Pill tone="beyond">charged</Pill>)}
    </li>
  )
}

/**
 * How one charge was arrived at.
 *
 * Renders nothing for entries that have no working — a deposit, an adjustment,
 * a reversal — and for anything charged before this was recorded, which is the
 * honest outcome: an absent breakdown is better than an invented one.
 */
function ChargeWorking({ detail, totalMinor }: { detail: ChargeDetail | null; totalMinor: number }) {
  if (!detail) return null

  if (detail.kind === 'ROUND') {
    return (
      <p className="text-ink-muted mt-2 text-micro">
        Round {detail.roundNumber} of this project — the first {detail.includedRounds} are included,
        so this one is charged at {formatMoneyMinor(detail.rateMinor)}
        {detail.complexity ? ` for a ${detail.complexity.toLowerCase()} product` : ''}.
      </p>
    )
  }

  return (
    <div className="border-rule bg-wash/40 mt-3 overflow-hidden rounded-md border">
      <table className="w-full border-collapse text-micro">
        <thead>
          <tr className="border-rule text-ink-muted border-b text-left">
            <th className="px-3 py-1.5 font-medium">Product</th>
            <th className="px-3 py-1.5 font-medium">Complexity</th>
            <th className="px-3 py-1.5 text-right font-medium">Rate</th>
            <th className="px-3 py-1.5 text-right font-medium">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-rule divide-y">
          {detail.lines.map((l, i) => (
            <tr key={`${l.label}-${i}`}>
              <td className="px-3 py-1.5">{l.label}</td>
              <td className="px-3 py-1.5">
                {l.complexity ? <ComplexityPill complexity={l.complexity as never} /> : <span className="text-ink-faint">—</span>}
              </td>
              <td className="tabular px-3 py-1.5 text-right">
                {l.priced ? formatMoneyMinor(l.rateMinor ?? 0) : <span className="text-ink-faint">not priced</span>}
              </td>
              <td className="tabular px-3 py-1.5 text-right">
                {l.priced ? formatMoneyMinor(l.amountMinor) : <span className="text-ink-faint">—</span>}
              </td>
            </tr>
          ))}
          <tr className="bg-wash/60 font-medium">
            <td className="px-3 py-1.5" colSpan={3}>
              {detail.serviceName} total
            </td>
            <td className="tabular px-3 py-1.5 text-right">{formatMoneyMinor(Math.abs(totalMinor))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
