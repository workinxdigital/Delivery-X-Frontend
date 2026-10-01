'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { CodePill, Pill } from '@/components/pill'
import { getClientDashboard } from '@/lib/api/client'
import { formatDateOnly, formatMoneyMinor } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * What a client sees first (§6.4.1).
 *
 * Two shapes, decided by the server. A money-blind account gets the commercial
 * panel REMOVED rather than blanked — the figures were never fetched, so there
 * is nothing here to hide badly. What remains is what the account did: projects
 * delivered, variations shipped, rounds used.
 *
 * Fresh on page load, no polling (§6.2). Every event is timestamped and hits
 * the ledger the instant it happens, so a refresh ten seconds after a PM logs a
 * round shows it. That is real-time in every sense that matters here, without
 * paying for a socket.
 */
export function ClientDashboardScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['client', 'dashboard'],
    queryFn: getClientDashboard,
  })

  if (isLoading) {
    return <p className="text-ink-muted py-16 text-center text-dense">Loading your account</p>
  }
  if (isError || !data) {
    return <p className="text-ink-muted py-16 text-center text-dense">That did not load. Try again.</p>
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="display text-[1.75rem] leading-tight font-semibold">{data.account.name}</h1>
        <p className="text-ink-muted mt-1 text-dense">
          Everything delivered for you, as your project manager logs it.
        </p>

        {/*
          The rules, in one line (owner, 2026-09-30).

          They were a full card with numbered markers, which took more space and
          more attention than three facts deserve — a reader needs them within
          reach, not in the way. One muted line, above the figures they govern,
          with only the operative phrases in full ink.
        */}
        {data.canSeeMoney && (
          <p className="text-ink-muted mt-3 text-micro leading-relaxed">
            <span className="text-ink font-medium">Each product is charged</span> at its own
            complexity{' · '}
            <span className="text-ink font-medium">
              {data.account.includedRounds} revision rounds are included
            </span>{' '}
            on every project{' · '}
            <span className="text-ink font-medium">
              round {data.account.includedRounds + 1} onward is charged
            </span>{' '}
            at that product&rsquo;s rate
          </p>
        )}
      </header>

      {data.canSeeMoney && (
        /*
          One card, not three (owner, 2026-09-30).

          It was a headline card and then two more side by side, and two
          independent cards in a grid cannot agree on height — "paid in" is
          three rows where "where it went" is two tables, so the left column
          ended in a column of empty space as tall as itself. A single card
          with an internal rule has no heights to reconcile.

          The three figures that sat top-right went with it: paid in, projects
          and extra rounds are exactly what the two halves below now say, and
          saying a number twice on one screen invites the reader to check
          whether the two agree.
        */
        <section className="border-rule bg-surface shadow-card overflow-hidden rounded-xl border">
          <div className="border-rule border-b p-6">
            <p className="text-ink-muted text-micro uppercase tracking-wide">
              {data.balance.headline.label}
            </p>
            <p
              className={cn(
                'display mt-1 text-[2.25rem] leading-none font-semibold tabular',
                /* Overdrawn is the one figure worth colouring: a deposit
                   account below zero has spent money it has not paid in, and
                   that is a conversation, not a detail. */
                data.balance.headline.amountMinor < 0 && 'text-beyond',
              )}
            >
              {formatMoneyMinor(data.balance.headline.amountMinor)}
            </p>

            {data.balance.utilisation !== null && (
              <div className="mt-4 max-w-md">
                <div className="bg-wash h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className={cn('h-full rounded-full', data.balance.utilisation >= 1 ? 'bg-beyond' : 'bg-lime')}
                    style={{ width: `${Math.round(data.balance.utilisation * 100)}%` }}
                  />
                </div>
                <p className="text-ink-muted mt-1.5 text-micro">
                  {formatMoneyMinor(data.balance.consumedMinor)} of{' '}
                  {formatMoneyMinor(data.balance.creditedMinor)} used
                </p>
              </div>
            )}

            {/*
              The post-paid counterpart (owner, 2026-10-01).

              A pool bar is a deposit idea and no longer draws here, but a
              partner who has settled invoices has money on the account and the
              card said nothing about it — an "Accrued $0.00" headline above a
              paid-in list of a million dollars, with no statement of how the
              two relate. This is that relationship in one line: what has been
              paid, and whether the account is ahead or behind.
            */}
            {data.account.billingMode === 'POSTPAID' && data.balance.creditedMinor > 0 && (
              <p className="text-ink-muted mt-4 text-micro">
                {formatMoneyMinor(data.balance.creditedMinor)} paid in ·{' '}
                {data.balance.availableMinor >= 0 ? (
                  <>{formatMoneyMinor(data.balance.availableMinor)} in credit</>
                ) : (
                  <span className="text-beyond">
                    {formatMoneyMinor(-data.balance.availableMinor)} outstanding
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Two halves of one card, so they share a top edge and never drift. */}
          <div className="divide-rule grid md:grid-cols-2 md:divide-x">
            <div className="p-6">
              <h2 className="text-ink-muted mb-3 text-micro uppercase tracking-wide">
                What you have paid in
              </h2>
              {data.credits.length === 0 ? (
                <p className="text-ink-muted text-dense">
                  No deposits recorded — this account is billed in arrears.
                </p>
              ) : (
                <dl className="text-dense">
                  {data.credits.map((c) => (
                    <div key={c.id} className="border-rule flex items-baseline gap-3 border-b py-2 last:border-0">
                      <dt className="min-w-0 grow truncate">
                        {c.description}
                        <span className="text-ink-muted ml-2 text-micro">{formatDateOnly(c.occurredOn)}</span>
                      </dt>
                      <dd className="tabular shrink-0">{formatMoneyMinor(c.amountMinor)}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline gap-3 pt-2 font-medium">
                    <dt className="grow">Total</dt>
                    <dd className="tabular">{formatMoneyMinor(data.balance.creditedMinor)}</dd>
                  </div>
                </dl>
              )}
            </div>

            <div className="p-6">
              <h2 className="text-ink-muted mb-3 text-micro uppercase tracking-wide">
                Where it has gone
              </h2>
              {data.breakdown.byBrand.length === 0 ? (
                <p className="text-ink-muted text-dense">Nothing consumed yet.</p>
              ) : (
                <>
                  <dl className="text-dense">
                    {data.breakdown.byBrand.map((b) => (
                      <div key={b.name} className="border-rule flex items-baseline gap-3 border-b py-2">
                        <dt className="min-w-0 grow truncate">
                          {b.name}
                          <span className="text-ink-muted ml-2 text-micro">
                            {b.projects} {b.projects === 1 ? 'project' : 'projects'}
                            {b.roundsMinor > 0 && ` · ${formatMoneyMinor(b.roundsMinor)} in extra rounds`}
                          </span>
                        </dt>
                        <dd className="tabular shrink-0">{formatMoneyMinor(b.totalMinor)}</dd>
                      </div>
                    ))}
                    <div className="flex items-baseline gap-3 pt-2 font-medium">
                      <dt className="grow">Total</dt>
                      <dd className="tabular">{formatMoneyMinor(data.balance.consumedMinor)}</dd>
                    </div>
                  </dl>

                  {data.breakdown.byService.length > 0 && (
                    <p className="text-ink-muted mt-4 text-micro leading-relaxed">
                      {/* By service reads as a sentence rather than a second
                          table: it is a footnote to the figures above, and a
                          table gave it the same weight as the money itself. */}
                      By service —{' '}
                      {data.breakdown.byService
                        .map((sv) => `${sv.name} ${formatMoneyMinor(sv.amountMinor)}`)
                        .join(' · ')}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      )}

      {/*
        Three figures, each with the sentence that makes it mean something
        (owner, 2026-09-30). It was four bare numbers in our vocabulary:
        "Variations 3" and "Past included 2" are terms from the ledger, not
        words a client would use, and a number nobody can name is a number
        nobody reads.
      */}
      <section className="grid gap-4 sm:grid-cols-3">
        <Tile
          label="Projects delivered"
          value={data.counts.projects}
          note="Each one is a service delivered for a listing."
        />
        <Tile
          label="Extra products covered"
          value={data.counts.variations}
          note={
            data.counts.variations === 0
              ? 'Every project so far covered its main product only.'
              : 'Product variations beyond the main listing, each charged at its own complexity.'
          }
        />
        <Tile
          label="Revision rounds used"
          value={data.counts.revisionRounds}
          note={
            data.counts.paidRounds === 0
              ? `All within the ${data.account.includedRounds} included on each project.`
              : `${data.counts.paidRounds} went beyond the ${data.account.includedRounds} included and were charged.`
          }
          tone={data.counts.paidRounds > 0 ? 'beyond' : undefined}
        />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="display text-[1.0625rem] font-semibold">Recent projects</h2>
          <Link href="/client/projects" className="text-ink-muted hover:text-ink text-micro underline decoration-dotted underline-offset-2">
            See all
          </Link>
        </div>

        {data.recent.length === 0 ? (
          <p className="text-ink-muted border-rule bg-surface rounded-xl border p-6 text-dense">
            Nothing has been delivered yet. Projects appear here as soon as they are logged.
          </p>
        ) : (
          <ul className="border-rule bg-surface divide-rule shadow-card divide-y overflow-hidden rounded-xl border">
            {data.recent.map((p) => (
              <li key={p.id}>
                <Link href={`/client/projects/${p.id}`} className="hover:bg-wash flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 transition-colors">
                  <CodePill>{p.taskCode}</CodePill>
                  <span className="font-medium">{p.serviceName}</span>
                  <span className="text-ink-muted text-dense">{p.brandName}</span>
                  <span className="text-ink-muted ml-auto text-micro">{formatDateOnly(p.deliveredOn)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tile({
  label,
  value,
  note,
  tone,
}: {
  label: string
  value: number
  /** The sentence that says what the number means. Never optional in practice. */
  note: string
  tone?: 'beyond'
}) {
  return (
    <div className="border-rule bg-surface rounded-xl border px-5 py-4">
      <p className="text-ink-muted text-micro uppercase tracking-wide">{label}</p>
      <p className={cn('display mt-1 text-[1.5rem] leading-none font-semibold tabular', tone === 'beyond' && 'text-beyond')}>
        {value}
      </p>
      <p className="text-ink-muted mt-2 text-micro leading-snug">{note}</p>
    </div>
  )
}
