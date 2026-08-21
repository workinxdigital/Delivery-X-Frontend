'use client'

import { useQuery } from '@tanstack/react-query'
import { Download, X } from 'lucide-react'
import { useState } from 'react'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { exportCsvUrl, getAgencies, getServices, getTasks, getUsers } from '@/lib/api/client'
import type { Complexity, TaskFilters, TaskStatus } from '@/lib/api/types'
import { COMPLEXITY_LABELS, STATUS_LABELS, formatDateOnly, formatTimestamp } from '@/lib/format'

const COMPLEXITY_OPTIONS: ComboboxOption[] = (
  ['LOW', 'MEDIUM', 'HIGH', 'STANDALONE'] as Complexity[]
).map((c) => ({ value: c, label: COMPLEXITY_LABELS[c] }))

const STATUS_OPTIONS: ComboboxOption[] = (
  ['DELIVERED', 'REVISION_IN_PROGRESS', 'CLOSED'] as TaskStatus[]
).map((s) => ({ value: s, label: STATUS_LABELS[s] }))

const EDITED_OPTIONS: ComboboxOption[] = [
  { value: 'yes', label: 'Edited only' },
  { value: 'no', label: 'Never edited' },
]

export function LedgerTable() {
  const [filters, setFilters] = useState<TaskFilters>({ page: 1, pageSize: 50 })

  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: getAgencies })
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: getServices })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => getTasks(filters),
    // The ledger is a live view of what has shipped, so refresh on return.
    refetchOnWindowFocus: true,
  })

  const set = <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value || undefined, page: 1 }))

  const activeCount = Object.entries(filters).filter(
    ([k, v]) => !['page', 'pageSize', 'sort', 'dir'].includes(k) && v,
  ).length

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-lg border p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Filter label="Search">
            <Input
              placeholder="Title, code or brand"
              value={filters.q ?? ''}
              onChange={(e) => set('q', e.target.value)}
            />
          </Filter>

          <Filter label="Agency">
            <Combobox
              options={agencies.map((a) => ({ value: a.id, label: a.name }))}
              value={filters.agencyId ?? ''}
              onChange={(v) => set('agencyId', v)}
              placeholder="All agencies"
            />
          </Filter>

          <Filter label="Service">
            <Combobox
              options={services.map((s) => ({
                value: s.id,
                label: s.name,
                group: s.isBundle ? 'Bundles' : s.category,
              }))}
              value={filters.serviceId ?? ''}
              onChange={(v) => set('serviceId', v)}
              placeholder="All services"
            />
          </Filter>

          <Filter label="Complexity">
            <Combobox
              options={COMPLEXITY_OPTIONS}
              value={filters.complexity ?? ''}
              onChange={(v) => set('complexity', v as Complexity)}
              placeholder="All tiers"
            />
          </Filter>

          <Filter label="From">
            <Input
              type="date"
              className="tabular"
              value={filters.from ?? ''}
              onChange={(e) => set('from', e.target.value)}
            />
          </Filter>

          <Filter label="To">
            <Input
              type="date"
              className="tabular"
              value={filters.to ?? ''}
              onChange={(e) => set('to', e.target.value)}
            />
          </Filter>

          <Filter label="Delivered by">
            <Combobox
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              value={filters.deliveredById ?? ''}
              onChange={(v) => set('deliveredById', v)}
              placeholder="Anyone"
            />
          </Filter>

          <Filter label="Edited">
            <Combobox
              options={EDITED_OPTIONS}
              value={filters.edited ?? ''}
              onChange={(v) => set('edited', v as 'yes' | 'no')}
              placeholder="Any"
            />
          </Filter>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Combobox
            options={STATUS_OPTIONS}
            value={filters.status ?? ''}
            onChange={(v) => set('status', v as TaskStatus)}
            placeholder="All statuses"
          />
          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilters({ page: 1, pageSize: 50 })}
            >
              <X className="size-3.5" />
              Clear {activeCount} filter{activeCount === 1 ? '' : 's'}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-muted-foreground text-sm tabular">
              {isLoading ? '—' : `${data?.total ?? 0} task${data?.total === 1 ? '' : 's'}`}
            </span>
            {/* A download is navigation, so this is a real anchor styled as a
                button, rather than a button component pretending to be a link. */}
            <a
              href={exportCsvUrl(filters)}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Download className="size-3.5" />
              Export CSV
            </a>
          </div>
        </div>
      </div>

      <div className="bg-card overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Delivered</TableHead>
              <TableHead>Agency</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Complexity</TableHead>
              <TableHead className="text-right">Var.</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="text-right">Revisions</TableHead>
              <TableHead>By</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={11}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {isError && (
              <TableRow>
                <TableCell colSpan={11} className="text-destructive py-8 text-center">
                  {error instanceof Error ? error.message : 'Could not load the ledger'}
                </TableCell>
              </TableRow>
            )}

            {data?.tasks.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-muted-foreground py-10 text-center">
                  {activeCount > 0
                    ? 'Nothing matches these filters.'
                    : 'Nothing logged yet.'}
                </TableCell>
              </TableRow>
            )}

            {data?.tasks.map((task) => (
              <TableRow key={task.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">
                  {task.taskCode}
                </TableCell>
                <TableCell className="tabular whitespace-nowrap">
                  {formatDateOnly(task.deliveredOn)}
                </TableCell>
                <TableCell className="whitespace-nowrap">
                  {task.agencyName}
                  {task.agencyType === 'DIRECT' && (
                    <span className="text-muted-foreground ml-1 text-xs">direct</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{task.brandName}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {task.serviceName}
                  {task.isBundle && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      bundle
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{COMPLEXITY_LABELS[task.complexity]}</TableCell>
                <TableCell className="tabular text-right">{task.variationCount}</TableCell>
                <TableCell className="max-w-[22ch] truncate" title={task.title}>
                  {task.title}
                </TableCell>
                <TableCell className="tabular text-right whitespace-nowrap">
                  {task.revisionRoundCount === 0 ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <span>
                      {task.revisionRoundCount}
                      {task.roundsBeyondAllowance > 0 && (
                        <Tooltip>
                          {/* Default trigger element, i.e. a real button: it is
                              focusable, so the explanation is reachable by
                              keyboard rather than hover-only. */}
                          <TooltipTrigger className="text-beyond ml-1 font-medium underline decoration-dotted">
                            +{task.roundsBeyondAllowance}
                          </TooltipTrigger>
                          <TooltipContent>
                            {task.roundsBeyondAllowance} beyond the allowance of{' '}
                            {task.freeRevisionAllowanceSnapshot} in force when this was logged
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{task.deliveredByName}</TableCell>
                <TableCell>
                  {/* The badge appears only once there is something to report (§5.3). */}
                  {task.editCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger className="border-border text-muted-foreground rounded-full border px-2 py-0.5 text-[10px] whitespace-nowrap">
                        Edited {task.editCount}×
                      </TooltipTrigger>
                      <TooltipContent>
                        {task.lastEditedAt
                          ? `Last ${formatTimestamp(task.lastEditedAt)}${task.lastEditedByName ? ` by ${task.lastEditedByName}` : ''}`
                          : 'Edited'}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && data.pageCount > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            Page {data.page} of {data.pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={data.page <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.page >= data.pageCount}
              onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  )
}
