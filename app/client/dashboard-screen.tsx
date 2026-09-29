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
          Everything delivered for you, as your project manager logs it.{' '}
          {data.account.includedRounds} revision rounds are included on each project.
        </p>
      </header>

      {data.canSeeMoney && (
        <section className="border-rule bg-surface shadow-card rounded-xl border p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <p className="text-ink-muted text-micro uppercase tracking-wide">
                {data.balance.headline.label}
              </p>
              <p
                className={cn(
                  'display mt-1 text-[2rem] leading-none font-semibold tabular',
                  /* Overdrawn is the one figure worth colouring: a deposit
                     account below zero has spent money it has not paid in, and
                     that is a conversation, not a detail. */
                  data.balance.headline.amountMinor < 0 && 'text-beyond',
                )}
              >
                {formatMoneyMinor(data.balance.headline.amountMinor)}
              </p>
            </div>

            <dl className="flex flex-wrap gap-x-8 gap-y-2 text-dense">
              {data.account.billingMode === 'DEPOSIT' && (
                <Figure label="Paid in" value={formatMoneyMinor(data.balance.creditedMinor)} />
              )}
              <Figure label="Projects" value={formatMoneyMinor(data.balance.consumedProjectsMinor)} />
              <Figure label="Extra rounds" value={formatMoneyMinor(data.balance.consumedRoundsMinor)} />
            </dl>
          </div>

          {data.balance.utilisation !== null && (
            <div className="mt-5">
              <div className="bg-wash h-1.5 w-full overflow-hidden rounded-full">
                <div
                  className={cn('h-full rounded-full', data.balance.utilisation >= 1 ? 'bg-beyond' : 'bg-lime')}
                  style={{ width: `${Math.round(data.balance.utilisation * 100)}%` }}
                />
              </div>
              <p className="text-ink-muted mt-1.5 text-micro">
                {Math.round(data.balance.utilisation * 100)}% of your deposit used
              </p>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-4">
        <Tile label="Projects" value={data.counts.projects} />
        <Tile label="Variations" value={data.counts.variations} />
        <Tile label="Revision rounds" value={data.counts.revisionRounds} />
        <Tile
          label="Past included"
          value={data.counts.paidRounds}
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

      {data.canSeeMoney && data.entries.length > 0 && (
        <section>
          <h2 className="display mb-3 text-[1.0625rem] font-semibold">Recent account activity</h2>
          <ul className="border-rule bg-surface divide-rule shadow-card divide-y overflow-hidden rounded-xl border">
            {data.entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                <span className="min-w-0 grow truncate">{e.description}</span>
                {e.disputed && <Pill tone="beyond">flagged</Pill>}
                <span className="text-ink-muted text-micro">{formatDateOnly(e.occurredOn)}</span>
                <span className={cn('tabular w-28 text-right', e.amountMinor > 0 ? 'text-ink' : 'text-ink-muted')}>
                  {formatMoneyMinor(e.amountMinor)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-muted text-micro uppercase tracking-wide">{label}</dt>
      <dd className="tabular mt-0.5 font-medium">{value}</dd>
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: 'beyond' }) {
  return (
    <div className="border-rule bg-surface rounded-xl border px-5 py-4">
      <p className="text-ink-muted text-micro uppercase tracking-wide">{label}</p>
      <p className={cn('display mt-1 text-[1.5rem] leading-none font-semibold tabular', tone === 'beyond' && 'text-beyond')}>
        {value}
      </p>
    </div>
  )
}
