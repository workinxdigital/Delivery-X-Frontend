'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { exportCsvUrl, getAgencies, getServices, getTasks, getUsers } from '@/lib/api/client'
import type { TaskFilters } from '@/lib/api/types'
import { COMPLEXITY_LABELS, formatDateOnly, formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FilterBar } from './filter-bar'

const COLUMNS = 10

export function LedgerTable() {
  const [filters, setFilters] = useState<TaskFilters>({ page: 1, pageSize: 50 })

  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: getAgencies })
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: getServices })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => getTasks(filters),
    refetchOnWindowFocus: true,
  })

  const set = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value || undefined, page: 1 }))

  const hasFilters = Object.entries(filters).some(
    ([k, v]) => !['page', 'pageSize', 'sort', 'dir'].includes(k) && v,
  )

  return (
    <div className="space-y-5">
      <FilterBar
        filters={filters}
        onChange={set}
        onClear={() => setFilters({ page: 1, pageSize: 50 })}
        agencies={agencies}
        services={services}
        users={users}
        total={data?.total}
        exportHref={exportCsvUrl(filters)}
      />

      {/*
        No card wrapper. The ledger sits on the paper and its rows are ruled,
        which is what a register looks like (DESIGN.md).
      */}
      <div className="-mx-2 overflow-x-auto px-2">
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr className="border-rule-strong border-b">
              <Th>Code</Th>
              <Th>Delivered</Th>
              <Th>Agency</Th>
              <Th>Brand</Th>
              <Th>Service</Th>
              <Th>Complexity</Th>
              <Th align="right">Var.</Th>
              <Th>Note</Th>
              <Th align="right">Revisions</Th>
              <Th>By</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="border-rule border-b">
                  <td colSpan={COLUMNS} className="py-2.5">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}

            {isError && (
              <tr>
                <td colSpan={COLUMNS} className="text-danger py-12 text-center">
                  {error instanceof Error ? error.message : 'Could not load the ledger'}
                </td>
              </tr>
            )}

            {data?.tasks.length === 0 && (
              <tr>
                <td colSpan={COLUMNS} className="py-16 text-center">
                  {/* Empty states teach rather than saying "no data". */}
                  <p className="text-ink font-medium">
                    {hasFilters ? 'Nothing matches these filters' : 'Nothing logged yet'}
                  </p>
                  <p className="text-ink-muted mt-1 text-dense">
                    {hasFilters
                      ? 'Clear a filter to widen the search.'
                      : 'Deliveries appear here the moment a PM logs one.'}
                  </p>
                </td>
              </tr>
            )}

            {data?.tasks.map((task) => (
              <tr
                key={task.id}
                className="border-rule hover:bg-wash border-b transition-colors duration-[120ms]"
              >
                <Td className="whitespace-nowrap">
                  {/* The code is the identifier, so it is also the way in. */}
                  <Link
                    href={`/ledger/${task.id}`}
                    className="code text-ink-muted hover:text-ink underline decoration-dotted underline-offset-2 transition-colors duration-[120ms]"
                  >
                    {task.taskCode}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap">{formatDateOnly(task.deliveredOn)}</Td>
                <Td className="whitespace-nowrap">
                  {task.agencyName}
                  {task.agencyType === 'DIRECT' && (
                    <span className="text-ink-faint ml-1.5 text-micro">direct</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap font-medium">{task.brandName}</Td>
                <Td className="whitespace-nowrap">
                  {task.serviceName}
                  {task.isBundle && (
                    <span className="border-rule text-ink-muted ml-1.5 rounded-sm border px-1 text-micro">
                      bundle
                    </span>
                  )}
                </Td>
                {/*
                  Complexity lives on variations now, so this shows the mix.
                  A delivery can be Low + High.
                */}
                <Td className="text-ink-muted whitespace-nowrap">
                  {task.complexities.length > 0
                    ? task.complexities.map((c) => COMPLEXITY_LABELS[c]).join(' + ')
                    : task.complexity
                      ? COMPLEXITY_LABELS[task.complexity]
                      : '—'}
                </Td>
                <Td align="right">{task.variationCount}</Td>
                {/*
                  Titles are optional since the form swapped that field for a
                  revisions count, so this falls back to the note rather than
                  leaving a column of blanks.
                */}
                <Td
                  className="text-ink-muted max-w-[22ch] truncate"
                  title={task.title ?? task.notes ?? undefined}
                >
                  {task.title ?? task.notes ?? <span className="text-ink-faint">—</span>}
                </Td>
                <Td align="right" className="whitespace-nowrap">
                  {task.revisionRoundCount === 0 ? (
                    <span className="text-ink-faint">—</span>
                  ) : (
                    <span>
                      {task.revisionRoundCount}
                      {/*
                        The only place colour appears in the product, and it
                        means one thing: rounds past the allowance (§2.6). Two
                        readings exist, so the larger one is shown and the title
                        spells both out. A count, never a charge.
                      */}
                      {(task.roundsBeyondAllowancePerVariation > 0 ||
                        task.roundsBeyondAllowancePerDelivery > 0) && (
                        <span
                          className="text-beyond ml-1.5 font-medium"
                          title={
                            `Allowance ${task.freeRevisionAllowanceSnapshot} when logged. ` +
                            `${task.roundsBeyondAllowancePerVariation} beyond counting each variation separately, ` +
                            `${task.roundsBeyondAllowancePerDelivery} beyond counting the delivery as one.`
                          }
                        >
                          +
                          {Math.max(
                            task.roundsBeyondAllowancePerVariation,
                            task.roundsBeyondAllowancePerDelivery,
                          )}
                        </span>
                      )}
                    </span>
                  )}
                </Td>
                <Td className="text-ink-muted whitespace-nowrap">
                  {task.deliveredByName}
                  {/* The badge only appears once there is something to report (§5.3). */}
                  {task.editCount > 0 && (
                    <span
                      className="border-rule text-ink-muted ml-1.5 rounded-sm border px-1 text-micro"
                      title={
                        task.lastEditedAt
                          ? `Last edited ${formatTimestamp(task.lastEditedAt)}${task.lastEditedByName ? ` by ${task.lastEditedByName}` : ''}`
                          : undefined
                      }
                    >
                      edited {task.editCount}×
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data && data.pageCount > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-ink-muted text-dense">
            Page {data.page} of {data.pageCount}
          </span>
          <div className="flex gap-2">
            <PageButton
              disabled={data.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Previous
            </PageButton>
            <PageButton
              disabled={data.page >= data.pageCount}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Next
            </PageButton>
          </div>
        </div>
      )}
    </div>
  )
}

function Th({
  children,
  align = 'left',
}: {
  children?: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      scope="col"
      className={cn(
        'text-ink-muted px-2 pb-2 text-micro font-medium whitespace-nowrap',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  className,
  align = 'left',
  title,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'left' | 'right'
  title?: string
}) {
  return (
    <td
      title={title}
      className={cn('px-2 py-2.5', align === 'right' && 'text-right', className)}
    >
      {children}
    </td>
  )
}

function PageButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="border-control text-dense text-ink-muted hover:text-ink hover:bg-wash rounded-md border px-3 py-1.5 transition-colors duration-[120ms] disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
