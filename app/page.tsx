'use client'

import { useQuery } from '@tanstack/react-query'
import { getHealth } from '@/lib/api/client'

/**
 * Step 0.1 status page. Its only job is to prove this app can reach the API
 * across origins with credentials. Replaced by real screens from Phase 1 on.
 */
export default function Page() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
  })

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <p className="text-xs font-medium uppercase tracking-widest text-[var(--color-muted)]">
        WorkinX Digital
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">DeliverX</h1>
      <p className="mt-2 text-sm text-[var(--color-muted)]">
        Delivery log. Phase 0, step 0.1 — skeleton.
      </p>

      <dl className="mt-10 divide-y divide-gray-200 border-y border-gray-200 text-sm">
        <Row label="Web app">
          <Ok>running</Ok>
        </Row>

        <Row label="API connection">
          {isLoading && <span className="text-[var(--color-muted)]">checking…</span>}
          {error && <Bad>unreachable — {(error as Error).message}</Bad>}
          {data && <Ok>{data.service} · responded {data.time}</Ok>}
        </Row>

        <Row label="API domain layer">
          {data ? (
            <Ok>
              resolved — sample <strong>{data.domain.sample}</strong>
            </Ok>
          ) : (
            <span className="text-[var(--color-muted)]">—</span>
          )}
        </Row>

        <Row label="Database">
          <span className="text-[var(--color-muted)]">not wired yet — step 0.2</span>
        </Row>
      </dl>

      <p className="mt-10 text-xs text-[var(--color-muted)]">
        This system contains no pricing of any kind. Commercial terms are handled outside it.
      </p>
    </main>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3">
      <dt className="shrink-0 font-medium">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  )
}

const Ok = ({ children }: { children: React.ReactNode }) => (
  <span className="text-emerald-700">{children}</span>
)

const Bad = ({ children }: { children: React.ReactNode }) => (
  <span className="text-red-700">{children}</span>
)
