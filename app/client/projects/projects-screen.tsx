'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { CodePill, ComplexityPill } from '@/components/pill'
import { getClientProjects, type ClientProjectFilters } from '@/lib/api/client'
import { formatDateOnly, formatMoneyMinor } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * Everything delivered, as a table (§6.4.2).
 *
 * The money column is absent, not blank, for a money-blind account — the server
 * did not send it, so the header is not drawn either. A column of dashes would
 * advertise the existence of figures somebody has decided this reader may not
 * have, which is a worse answer than not showing the column.
 */
export function ClientProjectsScreen() {
  const [filters, setFilters] = useState<ClientProjectFilters>({})

  const { data, isLoading } = useQuery({
    queryKey: ['client', 'projects', filters],
    queryFn: () => getClientProjects(filters),
    /* Keeps the last result on screen while a new filter loads, so the table
       does not blink to "Loading" on every dropdown change. */
    placeholderData: (prev) => prev,
  })

  const projects = data?.projects ?? []
  const money = data?.canSeeMoney ?? false
  const options = data?.filters
  const active = Object.values(filters).filter(Boolean).length

  const set = (patch: Partial<ClientProjectFilters>) =>
    setFilters((f) => {
      const next = { ...f, ...patch }
      /* An empty string is "no filter", not a filter for the empty value. */
      for (const k of Object.keys(next) as (keyof ClientProjectFilters)[]) {
        if (!next[k]) delete next[k]
      }
      return next
    })

  return (
    <div data-measure="wide" className="space-y-6">
      <header>
        <h1 className="display text-[1.75rem] leading-tight font-semibold">Projects</h1>
        <p className="text-ink-muted mt-1 text-dense">
          Everything delivered for you, newest first.
        </p>
      </header>

      {/*
        The filters carry their own counts (owner, 2026-09-30).
        
        "How many Basic A+ projects have we had" is answerable from the picker
        before anything is chosen, which is the question that prompted these —
        a dropdown of bare names would have made the reader select each one in
        turn to find out.

        Counted across the whole account rather than the filtered set, so
        choosing a service does not empty the list of every other service.
      */}
      <section className="border-rule bg-surface flex flex-wrap items-end gap-3 rounded-xl border p-4">
        <Picker
          label="Service"
          value={filters.serviceId ?? ''}
          onChange={(v) => set({ serviceId: v || undefined })}
          all="All services"
          options={(options?.services ?? []).map((o) => ({ value: o.id, label: `${o.name} (${o.count})` }))}
        />
        {(options?.brands.length ?? 0) > 1 && (
          <Picker
            label="Brand"
            value={filters.brandId ?? ''}
            onChange={(v) => set({ brandId: v || undefined })}
            all="All brands"
            options={(options?.brands ?? []).map((o) => ({ value: o.id, label: `${o.name} (${o.count})` }))}
          />
        )}
        <Picker
          label="Complexity"
          value={filters.complexity ?? ''}
          onChange={(v) => set({ complexity: (v || undefined) as ClientProjectFilters['complexity'] })}
          all="Any complexity"
          options={(options?.complexities ?? []).map((o) => ({
            value: o.value,
            label: `${o.value.charAt(0) + o.value.slice(1).toLowerCase()} (${o.count} products)`,
          }))}
        />
        <Picker
          label="Revisions"
          value={filters.paidRounds ?? ''}
          onChange={(v) => set({ paidRounds: (v || undefined) as ClientProjectFilters['paidRounds'] })}
          all="Any"
          options={[
            { value: 'with', label: 'Went past the included rounds' },
            { value: 'without', label: 'Stayed within them' },
          ]}
        />

        <label className="text-dense">
          <span className="text-ink-muted mb-1 block text-micro">Delivered between</span>
          <span className="flex items-center gap-1.5">
            <input
              type="date"
              data-slot="input"
              value={filters.from ?? ''}
              onChange={(e) => set({ from: e.target.value || undefined })}
              className="border-control bg-surface rounded-md border px-2 py-1 text-dense"
            />
            <span className="text-ink-muted text-micro">and</span>
            <input
              type="date"
              data-slot="input"
              value={filters.to ?? ''}
              onChange={(e) => set({ to: e.target.value || undefined })}
              className="border-control bg-surface rounded-md border px-2 py-1 text-dense"
            />
          </span>
        </label>

        {active > 0 && (
          <button
            type="button"
            onClick={() => setFilters({})}
            className="text-ink-muted hover:text-ink ml-auto text-micro underline decoration-dotted underline-offset-2"
          >
            Clear {active} {active === 1 ? 'filter' : 'filters'}
          </button>
        )}
      </section>

      <div className="border-rule bg-surface shadow-card overflow-x-auto rounded-xl border">
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr className="border-rule-strong bg-wash/70 border-b text-left">
              {/*
                The client's words, not the ledger's. "Variations" is what we
                call a child product internally; "Products" is what they are.
              */}
              <Th>Project</Th>
              <Th>Brand</Th>
              <Th>What was delivered</Th>
              <Th>Complexity</Th>
              <Th>Extra products</Th>
              <Th>Revision rounds</Th>
              <Th>Delivered</Th>
              {money && <Th align="right">Amount</Th>}
            </tr>
          </thead>
          <tbody className="divide-rule divide-y">
            {isLoading && (
              <tr><td colSpan={money ? 8 : 7} className="text-ink-muted px-4 py-8 text-center">Loading</td></tr>
            )}

            {!isLoading && projects.length === 0 && (
              <tr>
                <td colSpan={money ? 8 : 7} className="text-ink-muted px-4 py-8 text-center">
                  Nothing delivered yet.
                </td>
              </tr>
            )}

            {projects.map((p) => (
              <tr key={p.id} className="hover:bg-wash transition-colors">
                <Td>
                  <Link href={`/client/projects/${p.id}`} className="hover:text-ink">
                    <CodePill>{p.taskCode}</CodePill>
                  </Link>
                </Td>
                <Td className="max-w-[16ch] truncate font-medium" title={p.brandName}>{p.brandName}</Td>
                <Td className="max-w-[18ch] truncate" title={p.serviceName}>{p.serviceName}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1">
                    {p.tiers.length === 0
                      ? <span className="text-ink-faint">—</span>
                      : p.tiers.map((t) => <ComplexityPill key={t} complexity={t as never} />)}
                  </span>
                </Td>
                <Td className="tabular">{p.variations}</Td>
                <Td className="tabular">
                  {p.rounds}
                  {/*
                    The client's own vocabulary: "3 included" is the contract
                    term they agreed, where "beyond allowance" is ours. The
                    number that costs them money is the one called out.
                  */}
                  {p.paidRounds > 0
                    ? <span className="text-beyond ml-1.5 text-micro">{p.paidRounds} charged</span>
                    : <span className="text-ink-faint ml-1.5 text-micro">of {p.includedRounds} included</span>}
                </Td>
                <Td className="text-ink-muted whitespace-nowrap">{formatDateOnly(p.deliveredOn)}</Td>
                {money && (
                  <Td align="right" className="tabular whitespace-nowrap">
                    {p.amountMinor === undefined ? '—' : formatMoneyMinor(p.amountMinor)}
                  </Td>
                )}
              </tr>
            ))}
          </tbody>

          {/*
            A total, because this table is the evidence behind the figure on
            the account page and a reader should not have to add eleven rows to
            check that it matches.
          */}
          {money && projects.length > 0 && (
            <tfoot>
              <tr className="border-rule-strong bg-wash/70 border-t font-medium">
                <Td colSpan={7}>
                  {projects.length} {projects.length === 1 ? 'project' : 'projects'}
                  {active > 0 && ' matching these filters'}
                </Td>
                <Td align="right" className="tabular whitespace-nowrap">
                  {formatMoneyMinor(
                    projects.reduce((n, p) => n + (p.amountMinor ?? 0), 0),
                  )}
                </Td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {money && (
        <p className="text-ink-muted text-micro">
          Amounts include the project itself and any revision rounds charged on it. Open a project
          to see how each was worked out.
        </p>
      )}
    </div>
  )
}

function Th({ children, align }: { children?: React.ReactNode; align?: 'right' }) {
  return (
    <th className={cn('text-ink-muted px-4 py-2.5 text-micro font-medium uppercase tracking-wide', align === 'right' && 'text-right')}>
      {children}
    </th>
  )
}

function Td({
  children,
  className,
  align,
  title,
  colSpan,
}: {
  children?: React.ReactNode
  className?: string
  align?: 'right'
  /** Long names truncate, so the full one stays reachable on hover (§5.11). */
  title?: string
  colSpan?: number
}) {
  return (
    <td
      title={title}
      colSpan={colSpan}
      className={cn('px-4 py-3 align-middle', align === 'right' && 'text-right', className)}
    >
      {children}
    </td>
  )
}

/** One labelled dropdown. Same shape for every filter, so the row reads as a row. */
function Picker({
  label,
  value,
  onChange,
  all,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  all: string
  options: { value: string; label: string }[]
}) {
  if (options.length === 0) return null
  return (
    <label className="text-dense">
      <span className="text-ink-muted mb-1 block text-micro">{label}</span>
      <select
        data-slot="control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border-control bg-surface rounded-md border px-2 py-1 text-dense"
      >
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
