'use client'

import { useQuery } from '@tanstack/react-query'
import { getHealth } from '@/lib/api/client'

/**
 * Build status. A holding screen, not a dashboard: the real owner dashboard is
 * Phase 4. It exists so anyone opening the app can see what is wired up.
 */
export default function Page() {
  const { data, error, isLoading } = useQuery({
    queryKey: ['health'],
    queryFn: getHealth,
    refetchInterval: 30_000,
  })

  const db = data?.database

  return (
    <div className="max-w-[40rem]">
      <div className="border-rule mb-6 border-b pb-5">
        <h1 className="text-[1.375rem] font-semibold tracking-tight">Status</h1>
        <p className="text-ink-muted mt-1 text-dense">
          Phase 2 of 5. The owner dashboard arrives in Phase 4.
        </p>
      </div>

      <dl className="divide-rule divide-y">
        <Row label="Web app" state="ok">
          running
        </Row>

        <Row
          label="API"
          state={isLoading ? 'idle' : error ? 'bad' : 'ok'}
        >
          {isLoading && 'checking'}
          {error && `unreachable. ${(error as Error).message}`}
          {data && `${data.service}, last replied ${data.time.slice(11, 19)} UTC`}
        </Row>

        <Row
          label="Database"
          state={!db ? 'idle' : db.status === 'connected' ? 'ok' : 'bad'}
        >
          {!db && '—'}
          {db?.status === 'unreachable' && `unreachable. ${db.error}`}
          {db?.status === 'connected' &&
            `${db.tables} tables, ${db.services} services, ${db.agencies} agencies, ${db.tasks} logged`}
        </Row>

        <Row label="Sign-in" state="ok">
          email and password, session cookie, role-based access
        </Row>
      </dl>

      <p className="text-ink-faint mt-8 text-micro">
        This system holds no pricing of any kind. Commercial terms are handled outside it.
      </p>
    </div>
  )
}

function Row({
  label,
  state,
  children,
}: {
  label: string
  state: 'ok' | 'bad' | 'idle'
  children: React.ReactNode
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-3">
      <dt className="text-dense shrink-0 font-medium">{label}</dt>
      <dd
        className={
          // Failure is the only state that earns the accent. "Working" is the
          // normal case and gets no colour (DESIGN.md).
          state === 'bad' ? 'text-beyond text-dense text-right' : 'text-ink-muted text-dense text-right'
        }
      >
        {children}
      </dd>
    </div>
  )
}
