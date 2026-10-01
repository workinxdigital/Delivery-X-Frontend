'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { CodePill, Pill } from '@/components/pill'
import { QueryThread } from '@/components/query-thread'
import { getClientQueries, type ClientQuery } from '@/lib/api/client'
import { formatDateOnly, formatMoneyMinor } from '@/lib/format'

/**
 * The client's own queries (owner, 2026-10-01).
 *
 * The counterpart to the admin's Queries tab. Before this the answer rendered
 * on one charge inside one project's record and nowhere else, so a client who
 * raised a query and waited had no way to find out it had been answered short
 * of remembering which project it was on and going back to look.
 *
 * Open and answered on one list, newest first, because "what did I ask and what
 * came back" is a single question. Answered ones stay rather than disappearing
 * on resolution — a decision about money is worth reading again months later,
 * which is why §6.5 keeps a charge beside its credit instead of rewriting it.
 */
export function ClientQueriesScreen() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['client', 'queries'],
    queryFn: getClientQueries,
    retry: false,
  })

  if (isLoading) return <p className="text-ink-muted py-16 text-center text-dense">Loading</p>

  if (isError || !data) {
    return (
      <div className="py-16 text-center">
        <p className="text-ink-muted text-dense">There are no queries to show here.</p>
        <Link
          href="/client"
          className="text-ink-muted hover:text-ink mt-2 inline-block text-micro underline decoration-dotted underline-offset-2"
        >
          Back to your account
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="display text-[1.75rem] leading-tight font-semibold">Your queries</h1>
        <p className="text-ink-muted mt-1 text-dense">
          Charges you have asked about, and what came back.{' '}
          {data.open > 0
            ? `${data.open} still open.`
            : 'Nothing is waiting on us.'}
        </p>
      </header>

      {data.queries.length === 0 ? (
        /* Not an error state: most accounts never query anything, and this
           screen should say so plainly rather than looking broken. */
        <div className="border-rule bg-surface shadow-card rounded-xl border p-8 text-center">
          <p className="text-ink-muted text-dense">You have not queried any charges.</p>
          <p className="text-ink-faint mt-1 text-micro">
            Open a project and use <span className="text-ink-muted">Query this charge</span> on any
            line you want us to explain.
          </p>
        </div>
      ) : (
        <ul className="border-rule bg-surface divide-rule shadow-card divide-y overflow-hidden rounded-xl border">
          {data.queries.map((q) => (
            <QueryRow key={q.id} query={q} />
          ))}
        </ul>
      )}
    </div>
  )
}

function QueryRow({ query: q }: { query: ClientQuery }) {
  const answered = Boolean(q.disputeResponse)

  return (
    <li className="p-5">
      <div className="flex flex-wrap items-center gap-3">
        {/* The charge opens its project, which is where the full working is. */}
        {q.taskId ? (
          <Link
            href={`/client/projects/${q.taskId}`}
            className="min-w-0 font-medium underline decoration-dotted underline-offset-2"
          >
            {q.description}
          </Link>
        ) : (
          <span className="min-w-0 font-medium">{q.description}</span>
        )}
        {q.taskCode && <CodePill>{q.taskCode}</CodePill>}

        {/* The outcome, in the vocabulary the project record uses. */}
        {!answered ? (
          <Pill tone="beyond">under review</Pill>
        ) : q.disputeResolution === 'CREDITED' ? (
          <Pill tone="outline">credited</Pill>
        ) : (
          <Pill tone="outline">charge stands</Pill>
        )}

        <span className="tabular text-ink-muted ml-auto text-dense">
          {formatMoneyMinor(q.amountMinor < 0 ? -q.amountMinor : q.amountMinor)}
        </span>
      </div>

      <p className="text-ink-faint mt-1 text-micro">
        {q.brandName ? `${q.brandName} · ` : ''}
        charged {formatDateOnly(q.occurredOn)}
        {q.askedOn ? ` · you asked ${formatDateOnly(q.askedOn)}` : ''}
        {q.answeredOn ? ` · answered ${formatDateOnly(q.answeredOn)}` : ''}
      </p>

      <QueryThread
        className="mt-3"
        note={q.disputeNote}
        response={q.disputeResponse}
        resolution={q.disputeResolution}
        open={!answered}
      />
    </li>
  )
}
