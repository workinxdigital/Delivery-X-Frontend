'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { CodePill, ComplexityPill } from '@/components/pill'
import { getClientProjects } from '@/lib/api/client'
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
  const [brandId, setBrandId] = useState<string>('')

  const { data, isLoading } = useQuery({
    queryKey: ['client', 'projects', brandId],
    queryFn: () => getClientProjects(brandId ? { brandId } : {}),
  })

  const projects = data?.projects ?? []
  const money = data?.canSeeMoney ?? false

  /* Built from the rows rather than fetched: the brands a client may filter by
     are exactly the brands they can see, so deriving them cannot disagree with
     what the table holds. */
  const brands = [...new Map(projects.map((p) => [p.brandId, p.brandName])).entries()]

  return (
    <div data-measure="wide" className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[1.75rem] leading-tight font-semibold">Projects</h1>
          <p className="text-ink-muted mt-1 text-dense">
            Everything delivered for you, newest first.
          </p>
        </div>

        {brands.length > 1 && (
          <label className="text-dense">
            <span className="text-ink-muted mr-2 text-micro">Brand</span>
            <select
              data-slot="control"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="border-control bg-surface rounded-md border px-2 py-1 text-dense"
            >
              <option value="">All brands</option>
              {brands.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </label>
        )}
      </header>

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
                  {brandId && ' (filtered)'}
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
