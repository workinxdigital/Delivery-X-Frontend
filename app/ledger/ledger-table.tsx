'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { ComplexityPill, Pill } from '@/components/pill'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { ConfirmRemove } from '@/components/confirm-remove'
import {
  deleteTask,
  exportCsvUrl,
  getAgencies,
  getServices,
  getTasks,
  getUsers,
} from '@/lib/api/client'
import type { Task, TaskFilters } from '@/lib/api/types'
import { formatDateOnly, formatTimestamp, summarizeComplexities } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FilterBar } from './filter-bar'

/** Only these are sortable, because only these are sortable server-side. */
type SortKey = NonNullable<TaskFilters['sort']>

const COLUMNS: {
  key: string
  label: string
  align?: 'right'
  sort?: SortKey
  /** Right padding so a header lands over its column's numbers, not the gutter. */
  headPad?: string
}[] = [
  { key: 'code', label: 'Code', sort: 'taskCode' },
  { key: 'delivered', label: 'Delivered', sort: 'deliveredOn' },
  { key: 'brand', label: 'Brand' },
  { key: 'agency', label: 'Agency' },
  { key: 'service', label: 'Service' },
  { key: 'variations', label: 'Variations', sort: 'variationCount' },
  { key: 'revisions', label: 'Revisions' },
  { key: 'by', label: 'By' },
  // Row actions. No header: the icons explain themselves and a label here would
  // just be a word above two glyphs.
  { key: 'actions', label: '' },
]

export function LedgerTable() {
  const [filters, setFilters] = useState<TaskFilters>({
    page: 1,
    pageSize: 25,
    sort: 'deliveredOn',
    dir: 'desc',
  })

  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: getAgencies })
  // Retired services included, so historical rows stay filterable.
  const { data: services = [] } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => getServices(true),
  })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => getTasks(filters),
    refetchOnWindowFocus: true,
  })

  const set = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value || undefined, page: 1 }))

  /** Clicking the active column flips direction; a new column starts descending. */
  const sortBy = (key: SortKey) =>
    setFilters((f) => ({
      ...f,
      sort: key,
      dir: f.sort === key && f.dir === 'desc' ? 'asc' : 'desc',
      page: 1,
    }))

  const hasFilters = Object.entries(filters).some(
    ([k, v]) => !['page', 'pageSize', 'sort', 'dir'].includes(k) && v,
  )

  const queryClient = useQueryClient()
  const [removing, setRemoving] = useState<{ id: string; taskCode: string } | null>(null)

  const removal = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string | null }) =>
      deleteTask(id, reason),
    onSuccess: (result) => {
      toast(`${result.removed.taskCode} removed`, {
        description: 'It is out of the ledger and the counts. Nothing was erased.',
      })
      setRemoving(null)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not remove it'),
  })

  return (
    <div className="space-y-5">
      <FilterBar
        filters={filters}
        onChange={set}
        onClear={() =>
          setFilters({ page: 1, pageSize: 25, sort: 'deliveredOn', dir: 'desc' })
        }
        agencies={agencies}
        services={services}
        users={users}
        total={data?.total}
        exportHref={exportCsvUrl(filters)}
      />

      {/*
        No card. The ledger sits on the paper and its rows are ruled, which is
        what a register looks like. overflow-x-auto is a safety net for narrow
        screens, not the normal case: the column set is chosen to fit.
      */}
      <div className="-mx-2 overflow-x-auto px-2">
        <table className="w-full border-collapse text-dense">
          <thead>
            {/*
              Deliberately not sticky. The wrapper needs overflow-x for narrow
              screens, which makes it a scroll container, which makes a sticky
              thead position against that container instead of the viewport: the
              header lands 52px down, on top of row one, at scroll position
              zero. Nesting a second scroll region to fix it costs more than it
              buys, so the page scrolls normally and the page size is kept small
              enough that the header stays within reach.
            */}
            <tr className="border-rule-strong border-b">
              {COLUMNS.map((col) => (
                <Th
                  key={col.key}
                  align={col.align}
                  headPad={col.headPad}
                  sortable={Boolean(col.sort)}
                  active={filters.sort === col.sort}
                  dir={filters.dir}
                  onSort={col.sort ? () => sortBy(col.sort!) : undefined}
                >
                  {col.label}
                </Th>
              ))}
            </tr>
          </thead>

          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-rule border-b">
                  <td colSpan={COLUMNS.length} className="py-2.5">
                    <Skeleton className="h-4 w-full" />
                  </td>
                </tr>
              ))}

            {isError && (
              <tr>
                <td
                  colSpan={COLUMNS.length}
                  className="text-danger py-12 text-center"
                >
                  {error instanceof Error ? error.message : 'Could not load the ledger'}
                </td>
              </tr>
            )}

            {data?.tasks.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length} className="py-16 text-center">
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
              <Row key={task.id} task={task} onRemove={setRemoving} />
            ))}
          </tbody>
        </table>
      </div>

      {removing && (
        <ConfirmRemove
          taskCode={removing.taskCode}
          pending={removal.isPending}
          onCancel={() => setRemoving(null)}
          onConfirm={(reason) => removal.mutate({ id: removing.id, reason })}
        />
      )}

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

function Row({
  task,
  onRemove,
}: {
  task: Task
  onRemove: (task: { id: string; taskCode: string }) => void
}) {
  const mix = summarizeComplexities(task.complexities)
  const beyond = Math.max(
    task.roundsBeyondAllowancePerVariation,
    task.roundsBeyondAllowancePerDelivery,
  )
  // The delivery note lives on the row it describes, as a tooltip, rather than
  // in a column that was empty for most deliveries.
  const noteish = task.title ?? task.notes

  return (
    <tr className="border-rule hover:bg-wash group border-b transition-colors duration-[120ms]">
      <Td className="whitespace-nowrap">
        <Link
          href={`/ledger/${task.id}`}
          title={noteish ?? undefined}
          className="code text-ink-muted hover:text-ink underline decoration-dotted underline-offset-2 transition-colors duration-[120ms]"
        >
          {task.taskCode}
        </Link>
      </Td>

      <Td className="text-ink-muted whitespace-nowrap">
        {formatDateOnly(task.deliveredOn)}
      </Td>

      {/* Brand is the primary identity, so it carries the weight. */}
      <Td className="max-w-[16ch] truncate font-medium" title={task.brandName}>
        {task.brandName}
      </Td>

      <Td className="text-ink-muted max-w-[16ch] truncate" title={task.agencyName}>
        {task.agencyName}
        {task.agencyType === 'DIRECT' && (
          <Pill tone="outline" className="ml-1.5">
            direct
          </Pill>
        )}
      </Td>

      <Td className="max-w-[18ch] truncate whitespace-nowrap" title={task.serviceName}>
        {task.serviceName}
        {task.isBundle && (
          <Pill tone="outline" className="ml-1.5">
            bundle
          </Pill>
        )}
      </Td>

      {/*
        Count, then one capsule per distinct tier. Seven variations all at High
        show a single "High" capsule rather than the word seven times; the full
        breakdown is on hover.
      */}
      <Td className="whitespace-nowrap" title={mix.detail || undefined}>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-ink tabular">{task.variationCount}</span>
          {mix.tiers.map((tier) => (
            <ComplexityPill key={tier} complexity={tier} />
          ))}
        </span>
      </Td>

      {/*
        Left aligned, with two fixed tracks.
        The count sits flush with the column header, and the badge track after it
        is reserved whether or not there is a badge. That keeps every count and
        every badge on its own single x position: right-aligning the cell instead
        made a lone "0" hug the cell edge while a "7" was pushed left by the badge
        beside it, so the counts zigzagged down the column.

        Figures are tabular globally, so a 1-digit and a 2-digit count still start
        at the same x.
      */}
      <Td className="whitespace-nowrap">
        <span className="inline-grid grid-cols-[2.5ch_3rem] items-center gap-1.5">
          <span
            className={cn('text-left', task.revisionRoundCount === 0 && 'text-ink-faint')}
          >
            {task.revisionRoundCount}
          </span>

          {/*
            The only colour in the product, and it means one thing: rounds past
            the allowance (§2.6). Two readings exist, so the larger is shown and
            the tooltip spells both out. A count, never a charge.
          */}
          <span className="text-left">
            {beyond > 0 && (
              <Pill
                tone="beyond"
                title={
                  `Allowance ${task.freeRevisionAllowanceSnapshot} when logged. ` +
                  `${task.roundsBeyondAllowancePerVariation} beyond counting each variation separately, ` +
                  `${task.roundsBeyondAllowancePerDelivery} beyond counting the delivery as one.`
                }
              >
                +{beyond}
              </Pill>
            )}
          </span>
        </span>
      </Td>

      <Td className="text-ink-muted max-w-[14ch] truncate whitespace-nowrap">
        {task.deliveredByName}
        {task.editCount > 0 && (
          <Pill
            tone="outline"
            className="ml-1.5"
            title={
              task.lastEditedAt
                ? `Last edited ${formatTimestamp(task.lastEditedAt)}${task.lastEditedByName ? ` by ${task.lastEditedByName}` : ''}`
                : undefined
            }
          >
            edited {task.editCount}×
          </Pill>
        )}
      </Td>

      {/*
        Revealed on hover to keep the table quiet, but always reachable by
        keyboard: focus-within brings them back, and each has a real label.
      */}
      <Td className="whitespace-nowrap">
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 focus-within:opacity-100">
          <Link
            href={`/ledger/${task.id}?edit=1`}
            aria-label={`Edit ${task.taskCode}`}
            title={`Edit ${task.taskCode}`}
            className="text-ink-faint hover:text-ink hover:bg-wash flex size-6 items-center justify-center rounded-md transition-colors duration-[120ms]"
          >
            <Pencil className="size-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => onRemove({ id: task.id, taskCode: task.taskCode })}
            aria-label={`Remove ${task.taskCode}`}
            title={`Remove ${task.taskCode}`}
            className="text-ink-faint hover:text-danger hover:bg-wash flex size-6 items-center justify-center rounded-md transition-colors duration-[120ms]"
          >
            <Trash2 className="size-3.5" />
          </button>
        </span>
      </Td>
    </tr>
  )
}

function Th({
  children,
  align,
  headPad,
  sortable,
  active,
  dir,
  onSort,
}: {
  children: React.ReactNode
  align?: 'right'
  headPad?: string
  sortable?: boolean
  active?: boolean
  dir?: 'asc' | 'desc'
  onSort?: () => void
}) {
  const content = (
    <span
      className={cn(
        'inline-flex items-center gap-1',
        align === 'right' && 'flex-row-reverse',
      )}
    >
      {children}
      {sortable && (
        // Reserve the arrow's space always, so the header does not shift on sort.
        <span className="inline-flex w-3 justify-center">
          {active &&
            (dir === 'asc' ? (
              <ChevronUp className="size-3" />
            ) : (
              <ChevronDown className="size-3" />
            ))}
        </span>
      )}
    </span>
  )

  return (
    <th
      scope="col"
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
      style={headPad ? { paddingRight: `calc(0.5rem + ${headPad})` } : undefined}
      className={cn(
        'px-2 pt-1 pb-2 text-micro font-medium whitespace-nowrap',
        active ? 'text-ink' : 'text-ink-muted',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className="hover:text-ink rounded-sm transition-colors duration-[120ms]"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </th>
  )
}

function Td({
  children,
  className,
  align,
  title,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'right'
  title?: string
}) {
  return (
    <td
      title={title}
      className={cn(
        'px-2 py-2.5 align-middle',
        align === 'right' && 'text-right',
        className,
      )}
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
