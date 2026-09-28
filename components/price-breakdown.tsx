'use client'

import { CodePill, ComplexityPill } from '@/components/pill'
import type { PricedDelivery } from '@/lib/api/types'
import { formatMoneyMinor } from '@/lib/format'

/**
 * How one delivery's total was worked out (§5.7).
 *
 * One line per variation with the product, the tier, **the rate actually
 * applied**, the rounds taken and how many were paid, and the line total. The
 * rate is shown rather than only its result: an amount that cannot be checked
 * against the card is an amount nobody can defend in front of a client.
 *
 * Shared by the Pricing screen and a delivery's own record, so the two are the
 * same arithmetic rendered once and can never disagree.
 */
function BreakdownTable({ row }: { row: PricedDelivery }) {
  return (
    <div className="max-w-[52rem]">
      <div className="text-ink-muted mb-2 text-micro">
        {row.taskCode} · {row.serviceName} for {row.brandName} · allowance{' '}
        {row.allowanceSnapshot} free round{row.allowanceSnapshot === 1 ? '' : 's'} per variation
        when logged
      </div>

      <table className="w-full border-collapse text-micro">
        <thead>
          <tr className="border-rule text-ink-muted border-b">
            <th className="py-1.5 pr-3 text-left font-medium">Variation</th>
            <th className="py-1.5 pr-3 text-left font-medium">Tier</th>
            <th className="py-1.5 pr-3 text-left font-medium">Rate</th>
            <th className="py-1.5 pr-3 text-left font-medium">Rounds</th>
            <th className="py-1.5 pr-3 text-left font-medium">Revisions</th>
            <th className="py-1.5 text-left font-medium">Line total</th>
          </tr>
        </thead>
        <tbody>
          {row.lines.map((l) => (
            <tr key={l.variationNumber} className="border-rule/60 border-b last:border-0">
              <td className="py-1.5 pr-3">
                {/*
                  The variation's own code, not its ordinal (§2.5).

                  This is the identifier somebody quotes back — "what is
                  WX-2026-0043-2" — and it was a bare "2." here while the same
                  breakdown in a delivery's sidebar and every line of the
                  statement already carried the code. A row of a money table
                  that cannot be named is a row that cannot be queried. The
                  number is still in it: the code ends in the same digit the
                  label does.
                */}
                {/*
                  A real gap, not a JSX space. The capsule is inline-flex, so
                  the `{' '}` that used to sit here collapsed against its edge
                  and the code ran straight into the product name as one word.
                */}
                <span className="flex items-center gap-2">
                  <CodePill className="shrink-0">{l.code}</CodePill>
                  {/* Falls back to the listing's own name: the first line of a
                      delivery is the service against the parent, which carries
                      no child name of its own (§2.4). Calling that "unnamed"
                      was wrong — it has a name, one level up. */}
                  <span className="min-w-0 truncate">
                    {l.productName ?? row.productName ?? (
                      <span className="text-ink-faint">unnamed</span>
                    )}
                  </span>
                </span>
              </td>
              <td className="py-1.5 pr-3">
                {l.complexity ? (
                  <ComplexityPill complexity={l.complexity} />
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </td>

              {/* The rate applied, straight from the agency card. */}
              <td className="tabular py-1.5 pr-3">
                {l.priced ? (
                  formatMoneyMinor(l.perVariationMinor ?? 0)
                ) : (
                  <span className="text-beyond">no rate set</span>
                )}
              </td>

              {/*
                Rounds taken, and how many of those were past the allowance —
                the paid ones, which are the only ones that reach the money.
              */}
              <td className="tabular py-1.5 pr-3">
                {l.rounds}
                {l.paidRounds > 0 && (
                  <span className="text-beyond ml-1.5">{l.paidRounds} paid</span>
                )}
              </td>

              <td className="tabular py-1.5 pr-3">
                {l.priced && l.paidRounds > 0 ? (
                  <span className="text-ink-muted">
                    {l.paidRounds} × {formatMoneyMinor(l.perExtraRevisionMinor ?? 0)} ={' '}
                    <span className="text-ink">{formatMoneyMinor(l.revisionsMinor)}</span>
                  </span>
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </td>

              <td className="tabular py-1.5 font-medium">
                {l.priced ? (
                  formatMoneyMinor(l.totalMinor)
                ) : (
                  <span className="text-ink-faint">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-rule border-t">
            <td colSpan={5} className="text-ink-muted py-1.5 pr-3 text-right">
              {row.unpricedVariations > 0 && (
                <span className="text-beyond mr-3">
                  {row.unpricedVariations} variation{row.unpricedVariations === 1 ? '' : 's'} not
                  priced, so not counted
                </span>
              )}
              Delivery total
            </td>
            <td className="tabular py-1.5 font-medium">
              {formatMoneyMinor(row.totalMinor)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

/**
 * The same working, stacked for a narrow column.
 *
 * Six columns do not fit a sidebar, and shrinking the table until they do makes
 * a wall of clipped figures. Each variation becomes a small block instead: what
 * it was, then the arithmetic as label-and-value rows. The numbers and the
 * wording are identical to the table — only the axis changes.
 */
function BreakdownStack({ row }: { row: PricedDelivery }) {
  return (
    <div className="divide-rule divide-y">
      {row.lines.map((l) => (
        <div key={l.variationNumber} className="py-3 first:pt-0 last:pb-0">
          {/* The capsule keeps its size and the name gives way: truncating a
              span that contains a pill clips the pill instead of the prose. */}
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <CodePill className="shrink-0">{l.code}</CodePill>
              <span className="text-dense truncate">
                {l.productName ?? row.productName ?? (
                  <span className="text-ink-faint">unnamed</span>
                )}
              </span>
            </div>
            {l.complexity && (
              <span className="shrink-0">
                <ComplexityPill complexity={l.complexity} />
              </span>
            )}
          </div>

          <dl className="mt-2 space-y-1 text-micro">
            <Row label="Rate">
              {l.priced ? (
                formatMoneyMinor(l.perVariationMinor ?? 0)
              ) : (
                <span className="text-beyond">no rate set</span>
              )}
            </Row>

            <Row label="Rounds">
              {l.rounds}
              {l.paidRounds > 0 && (
                <span className="text-beyond ml-1.5">{l.paidRounds} paid</span>
              )}
            </Row>

            {/* Only when there are paid rounds: a row of dashes on every
                variation would be noise in a column this narrow. */}
            {l.priced && l.paidRounds > 0 && (
              <Row label="Revisions">
                <span className="text-ink-muted">
                  {l.paidRounds} × {formatMoneyMinor(l.perExtraRevisionMinor ?? 0)} ={' '}
                </span>
                {formatMoneyMinor(l.revisionsMinor)}
              </Row>
            )}

            <Row label="Line total" strong>
              {l.priced ? formatMoneyMinor(l.totalMinor) : <span className="text-ink-faint">—</span>}
            </Row>
          </dl>
        </div>
      ))}
    </div>
  )
}

function Row({
  label,
  children,
  strong,
}: {
  label: string
  children: React.ReactNode
  strong?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`tabular text-right ${strong ? 'text-ink font-medium' : ''}`}>{children}</dd>
    </div>
  )
}

/**
 * One delivery's arithmetic, in whichever shape the space allows.
 *
 * `table` is the Pricing screen, where a full-width row expands beneath itself.
 * `stack` is a delivery's own record, where it sits in a column beside the page.
 */
export function PriceBreakdown({
  row,
  layout = 'table',
}: {
  row: PricedDelivery
  layout?: 'table' | 'stack'
}) {
  return layout === 'stack' ? <BreakdownStack row={row} /> : <BreakdownTable row={row} />
}
