'use client'

import { ChevronDown, Download, Search, X } from 'lucide-react'
import { useState } from 'react'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { Input } from '@/components/ui/input'
import type { Complexity, TaskFilters, TaskStatus } from '@/lib/api/types'
import { COMPLEXITY_LABELS, STATUS_LABELS, formatDateOnly, formatCategory } from '@/lib/format'
import { cn } from '@/lib/utils'

const COMPLEXITY_OPTIONS: ComboboxOption[] = (
  ['LOW', 'MEDIUM', 'HIGH', 'STANDALONE'] as Complexity[]
).map((c) => ({ value: c, label: COMPLEXITY_LABELS[c] }))

const STATUS_OPTIONS: ComboboxOption[] = (
  ['DELIVERED', 'REVISION_IN_PROGRESS', 'CLOSED'] as TaskStatus[]
).map((s) => ({ value: s, label: STATUS_LABELS[s] }))

const EDITED_OPTIONS: ComboboxOption[] = [
  { value: 'yes', label: 'Edited' },
  { value: 'no', label: 'Never edited' },
]

/**
 * Ledger filters.
 *
 * Only the three most-used controls are always visible; the rest sit behind a
 * disclosure, and whatever is active shows as a removable chip. Eight
 * permanently expanded filter boxes pushed the table itself below the fold,
 * which is backwards for a screen whose whole job is the table.
 */
export function FilterBar({
  filters,
  onChange,
  onClear,
  agencies,
  services,
  users,
  total,
  exportHref,
}: {
  filters: TaskFilters
  onChange: <K extends keyof TaskFilters>(key: K, value: TaskFilters[K]) => void
  onClear: () => void
  agencies: { id: string; name: string }[]
  services: { id: string; name: string; category: string; isBundle: boolean }[]
  users: { id: string; name: string }[]
  total: number | undefined
  exportHref: string
}) {
  const [expanded, setExpanded] = useState(false)

  const chips = [
    filters.q && { key: 'q' as const, label: `“${filters.q}”` },
    filters.agencyId && {
      key: 'agencyId' as const,
      label: agencies.find((a) => a.id === filters.agencyId)?.name ?? 'Agency',
    },
    filters.serviceId && {
      key: 'serviceId' as const,
      label: services.find((s) => s.id === filters.serviceId)?.name ?? 'Service',
    },
    filters.complexity && {
      key: 'complexity' as const,
      label: COMPLEXITY_LABELS[filters.complexity],
    },
    filters.deliveredById && {
      key: 'deliveredById' as const,
      label: users.find((u) => u.id === filters.deliveredById)?.name ?? 'Person',
    },
    filters.status && { key: 'status' as const, label: STATUS_LABELS[filters.status] },
    filters.edited && {
      key: 'edited' as const,
      label: filters.edited === 'yes' ? 'Edited' : 'Never edited',
    },
    filters.from && { key: 'from' as const, label: `from ${formatDateOnly(filters.from)}` },
    filters.to && { key: 'to' as const, label: `to ${formatDateOnly(filters.to)}` },
  ].filter(Boolean) as { key: keyof TaskFilters; label: string }[]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="relative min-w-[15rem] flex-1">
          <Search className="text-ink-faint pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            value={filters.q ?? ''}
            placeholder="Search title, code or brand"
            className="pl-8"
            onChange={(e) => onChange('q', e.target.value)}
          />
        </div>

        <div className="w-[11rem]">
          <Combobox
            options={agencies.map((a) => ({ value: a.id, label: a.name }))}
            value={filters.agencyId ?? ''}
            onChange={(v) => onChange('agencyId', v)}
            placeholder="All agencies"
            searchPlaceholder="Search agencies"
          />
        </div>

        <div className="w-[11rem]">
          <Combobox
            options={services.map((s) => ({
              value: s.id,
              label: s.name,
              group: s.isBundle ? 'Bundles' : formatCategory(s.category),
            }))}
            value={filters.serviceId ?? ''}
            onChange={(v) => onChange('serviceId', v)}
            placeholder="All services"
            searchPlaceholder="Search catalogue"
          />
        </div>

        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="border-control text-dense text-ink-muted hover:text-ink hover:bg-wash flex h-9 items-center gap-1.5 rounded-md border px-2.5 transition-colors duration-[120ms]"
        >
          More
          <ChevronDown
            className={cn(
              'size-3.5 transition-transform duration-150',
              expanded && 'rotate-180',
            )}
            style={{ transitionTimingFunction: 'var(--ease-out-quart)' }}
          />
        </button>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-ink-muted text-dense">
            {total === undefined ? '—' : `${total} ${total === 1 ? 'task' : 'tasks'}`}
          </span>
          {/* A download is navigation, so this is a real anchor. */}
          <a
            href={exportHref}
            className="border-control text-dense text-ink-muted hover:text-ink hover:bg-wash flex h-9 items-center gap-1.5 rounded-md border px-2.5 transition-colors duration-[120ms]"
          >
            <Download className="size-3.5" />
            Export
          </a>
        </div>
      </div>

      {expanded && (
        <div className="border-rule grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <Labelled label="From">
            <Input
              type="date"
              value={filters.from ?? ''}
              onChange={(e) => onChange('from', e.target.value)}
            />
          </Labelled>
          <Labelled label="To">
            <Input
              type="date"
              value={filters.to ?? ''}
              onChange={(e) => onChange('to', e.target.value)}
            />
          </Labelled>
          <Labelled label="Complexity">
            <Combobox
              options={COMPLEXITY_OPTIONS}
              value={filters.complexity ?? ''}
              onChange={(v) => onChange('complexity', v as Complexity)}
              placeholder="All tiers"
            />
          </Labelled>
          <Labelled label="Delivered by">
            <Combobox
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              value={filters.deliveredById ?? ''}
              onChange={(v) => onChange('deliveredById', v)}
              placeholder="Anyone"
            />
          </Labelled>
          <Labelled label="Status">
            <Combobox
              options={STATUS_OPTIONS}
              value={filters.status ?? ''}
              onChange={(v) => onChange('status', v as TaskStatus)}
              placeholder="Any"
            />
          </Labelled>
          <Labelled label="Edited">
            <Combobox
              options={EDITED_OPTIONS}
              value={filters.edited ?? ''}
              onChange={(v) => onChange('edited', v as 'yes' | 'no')}
              placeholder="Any"
            />
          </Labelled>
        </div>
      )}

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={String(chip.key)}
              type="button"
              onClick={() => onChange(chip.key, undefined)}
              className="border-rule text-micro text-ink-muted hover:text-ink hover:border-rule-strong group flex items-center gap-1 rounded-full border py-0.5 pr-1.5 pl-2 transition-colors duration-[120ms]"
            >
              {chip.label}
              <X className="size-3 opacity-50 group-hover:opacity-100" />
            </button>
          ))}
          <button
            type="button"
            onClick={onClear}
            className="text-micro text-ink-faint hover:text-ink ml-1 underline decoration-dotted transition-colors duration-[120ms]"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <span className="text-ink-muted text-micro font-medium">{label}</span>
      {children}
    </div>
  )
}
