'use client'

import { useQuery } from '@tanstack/react-query'
import { ChevronDown, FileDown } from 'lucide-react'
import Link from 'next/link'
import { Fragment, useState } from 'react'
import { Combobox } from '@/components/combobox'
import { DateRange } from '@/components/date-range'
import { CodePill, ComplexityPill, Pill } from '@/components/pill'
import { PriceBreakdown } from '@/components/price-breakdown'
import {
  getAdminDeliverers,
  getAgencies,
  getPricing,
} from '@/lib/api/client'
import type { Complexity, PricedDelivery } from '@/lib/api/types'
import {
  COMPLEXITY_LABELS,
  currentYearMonth,
  formatDateOnly,
  formatMoneyMinor,
  monthRange,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { PanelHeader, Td, Th } from './panel-parts'

/**
 * The pricing calculator. Admin only, inside the already-gated admin screen.
 *
 * CLAUDE.md §1 said this system holds no pricing; the owner reversed that on
 * 2026-08-25 for this screen, in USD, priced per complexity tier. What that does
 * and does not mean is worth being precise about: the rate card is the only
 * place money is stored, and no delivery carries an amount — so a rate typed
 * today re-prices last month rather than rewriting it. The ledger keeps saying
 * what shipped; this says what it was worth.
 *
 * There is no house rate card here any more. Rates are set on an agency when it
 * is created (owner, 2026-08-27), so this screen reports and does not edit: what
 * the month came to, who it came from, and which delivery made it.
 */
export function PricingPanel() {
  /**
   * Any date range, not calendar months only (owner, 2026-08-29).
   *
   * It was an `<input type="month">`, which could not answer "what did we ship
   * between the 12th and the 3rd" — the question any contract that does not
   * start on the 1st eventually asks. The range is held here as two dates and
   * passed straight through to the API and to the statement's query string,
   * both of which already spoke from/to; only the control was the limit.
   *
   * Defaults to the current month, which is still the common case.
   */
  const [range, setRange] = useState(() => monthRange(currentYearMonth()))
  const [agencyId, setAgencyId] = useState('')
  const [delivererId, setDelivererId] = useState('')
  /**
   * Only jobs that went past the allowance, or only those that did not.
   *
   * "Paid rounds" are the rounds this agency is charged for (§2.6) — the only
   * ones that reach the money. Which jobs went over is a question asked of a
   * whole month, and scrolling to find them is the wrong way to answer it.
   *
   * Filtered server-side in the same pass that prices them, so the total, the
   * rollup and the table all describe the rows the filter left.
   */
  const [paidRounds, setPaidRounds] = useState('')
  /**
   * Whether the STATEMENT charges revision rounds.
   *
   * A PDF option and nothing else (owner, 2026-08-28). The screen always shows
   * full pricing — deliverables plus revisions — because the screen reports what
   * the month was worth, and that does not change because of how one document
   * is going to be written.
   *
   * Off produces a genuinely different bill rather than the same bill with a
   * column hidden: the revision money leaves every line and the total on paper.
   * It lives here, in the page rather than inside the statement, because the
   * statement is opened by a link and its query string is where the choice has
   * to travel.
   */
  /**
   * Deliveries whose revision rounds the PDF should NOT charge for.
   *
   * A single switch for the whole statement until 2026-08-29, when the owner
   * asked for it per project: one job on a month's bill can be a goodwill
   * revision while the rest are chargeable, and an all-or-nothing toggle forced
   * the wrong answer on every other line.
   *
   * Held as the EXCLUDED set rather than the included one, so charging is the
   * default and a delivery logged after this screen was opened is charged
   * rather than silently free.
   *
   * Keyed by VARIATION code since 2026-09-01, where it was task ids before. A
   * delivery of three SKUs can have the rounds on one absorbed as goodwill and
   * the other two charged, which a delivery-level key cannot say. Unticking a
   * whole delivery simply excludes all of its line codes, so the two levels are
   * the same mechanism rather than two that have to agree.
   */
  const [noRevisions, setNoRevisions] = useState<Set<string>>(new Set())

  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: getAgencies })
  const { data: people = [] } = useQuery({
    queryKey: ['admin', 'deliverers'],
    queryFn: getAdminDeliverers,
  })

  const { data: pricing, isLoading } = useQuery({
    queryKey: ['admin', 'pricing', range.from, range.to, agencyId, delivererId, paidRounds],
    queryFn: () =>
      getPricing({
        from: range.from,
        to: range.to,
        // Always by agency. The rollup exists to answer "what does this partner
        // owe", which is what the statement below it is addressed to; the finer
        // cuts are all readable from the priced table further down.
        groupBy: 'agency',
        agencyId: agencyId || undefined,
        delivererId: delivererId || undefined,
        paidRounds: (paidRounds || undefined) as 'with' | 'without' | undefined,
      }),
  })

  const agencyName = agencies.find((a) => a.id === agencyId)?.name


  return (
    <div className="space-y-10">
      <section>
        <PanelHeader
          title={rangeTitle(range)}
          note="Priced from the ledger: every variation at its own tier, plus the rounds past the agency's free allowance. Change a rate and this recalculates — no delivery stores an amount."
          action={
            <div className="flex flex-wrap items-end gap-2">
              <DateRange from={range.from} to={range.to} onChange={setRange} />
              {/*
                Narrowing to one agency, because "what is this partner worth
                this month" is the question that gets asked by name.
              */}
              <div className="w-[13rem]">
                <Combobox
                  options={agencies.map((a) => ({ value: a.id, label: a.name }))}
                  value={agencyId}
                  onChange={setAgencyId}
                  placeholder="All agencies"
                  searchPlaceholder="Search agencies…"
                />
              </div>

              {/* Who delivered it. The Team list (§5.5), not login accounts. */}
              <div className="w-[12rem]">
                <Combobox
                  options={people.map((p) => ({
                    value: p.id,
                    label: p.name,
                    hint: `${p.taskCount} deliver${p.taskCount === 1 ? 'y' : 'ies'}`,
                  }))}
                  value={delivererId}
                  onChange={setDelivererId}
                  placeholder="Everyone"
                  searchPlaceholder="Search people…"
                />
              </div>

              {/*
                Beside the range, because it narrows the same question: what is
                worth billing, and which of it went over.
              */}
              <div className="w-[11rem]">
                <Combobox
                  options={[
                    { value: 'with', label: 'With paid rounds' },
                    { value: 'without', label: 'No paid rounds' },
                  ]}
                  value={paidRounds}
                  onChange={setPaidRounds}
                  placeholder="Any rounds"
                  searchPlaceholder="Filter…"
                />
              </div>
            </div>
          }
        />

        {/*
          One card: the total, then the agencies that make it up.

          These were two — a totals strip and a rollup table — carrying the same
          six figures under the same six headings. With a single agency they
          were identical row for row, and even with several the strip was just
          the table's own sum sitting above it in a different shape. So the sum
          moved into the table as a footer row, where it lines up under the
          columns it totals, and the strip kept only the thing a table cannot
          do: state the headline figure large.
        */}
        <div className="border-rule bg-surface shadow-card mb-8 overflow-hidden rounded-xl border">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-5 pt-4 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span aria-hidden className="bg-lime h-3 w-1 shrink-0 rounded-full" />
                <span className="text-ink-muted text-micro font-medium tracking-[0.08em] uppercase">
                  {/* "Month total" is a lie over eleven days. The word follows
                      the range, the same way the heading above it does. */}
                  {agencyName ? `${totalLabel(range)} · ${agencyName}` : totalLabel(range)}
                </span>
              </div>

              <div className="mt-2 inline-block">
                <div className="display tabular text-[2.5rem] leading-[1.05] font-semibold">
                  {pricing
                    ? formatMoneyMinor(
                        pricing.totals.totalMinor,
                      )
                    : '—'}
                </div>
                {/* The statement's lime total rule, on screen. */}
                <div aria-hidden className="bg-lime mt-1.5 h-[3px] w-full rounded-full" />
              </div>
            </div>

            <div className="flex flex-col items-end gap-1 pb-1">
              <span className="text-ink-faint text-micro">All amounts USD</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-dense">
              <thead>
                <tr className="border-rule-strong bg-wash/70 border-y">
                  <Th>Agency</Th>
                  <Th>Deliveries</Th>
                  <Th>Variations</Th>
                  <Th>Paid rounds</Th>
                  <Th>Deliverables</Th>
                  <Th>Revisions</Th>
                  <Th>Total</Th>
                </tr>
              </thead>

              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-ink-muted py-8 text-center text-micro">
                      Counting
                    </td>
                  </tr>
                )}

                {pricing?.lines.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-ink-muted py-8 text-center text-micro">
                      Nothing delivered in this range.
                    </td>
                  </tr>
                )}

                {pricing?.lines.map((l) => (
                  <tr key={l.key} className="border-rule hover:bg-wash border-b last:border-0">
                    <Td className="font-medium">
                      {l.label}
                      {l.sublabel && (
                        <span className="text-ink-faint ml-2 text-micro font-normal">
                          {l.sublabel}
                        </span>
                      )}
                      {l.unpricedVariations > 0 && (
                        <span className="text-beyond ml-2 text-micro font-normal">
                          {l.unpricedVariations} unpriced
                        </span>
                      )}
                    </Td>
                    <Td className="tabular">{l.deliveries}</Td>
                    <Td className="tabular">{l.variations}</Td>
                    <Td className={cn('tabular', l.extraRounds > 0 && 'text-beyond')}>
                      {l.extraRounds}
                    </Td>
                    <Td className="tabular text-ink-muted">
                      {formatMoneyMinor(l.variationsMinor, false)}
                    </Td>
                    <Td className="tabular text-ink-muted">
                      {formatMoneyMinor(l.revisionsMinor, false)}
                    </Td>
                    <Td className="tabular font-medium">
                      {formatMoneyMinor(l.totalMinor)}
                    </Td>

                  </tr>
                ))}
              </tbody>

              {/*
                The sum, under the columns it sums. Shown only when there is
                more than one row to add up — with a single agency the footer
                would repeat that row verbatim, which is the duplication this
                merge removed in the first place.
              */}
              {pricing && pricing.lines.length > 1 && (
                <tfoot>
                  <tr className="border-rule-strong bg-wash/50 border-t">
                    <Td className="text-ink-muted font-medium">
                      {pricing.lines.length} agencies
                    </Td>
                    <Td className="tabular font-medium">{pricing.totals.deliveries}</Td>
                    <Td className="tabular font-medium">{pricing.totals.variations}</Td>
                    <Td
                      className={cn(
                        'tabular font-medium',
                        pricing.totals.extraRounds > 0 && 'text-beyond',
                      )}
                    >
                      {pricing.totals.extraRounds}
                    </Td>
                    <Td className="tabular font-medium">
                      {formatMoneyMinor(pricing.totals.variationsMinor, false)}
                    </Td>
                    <Td className="tabular font-medium">
                      {formatMoneyMinor(pricing.totals.revisionsMinor, false)}
                    </Td>
                    <Td className="tabular font-semibold">
                      {formatMoneyMinor(
                        pricing.totals.totalMinor,
                      )}
                    </Td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {/*
          A tier delivered with no rate is named, not priced at zero (§5.7). A
          total that looks complete while omitting work is the worst thing this
          screen could do. Reported by service whatever else is on screen,
          because a missing rate is fixed on the agency's rate card and that
          card is per service.
        */}
        {pricing && pricing.gaps.length > 0 && (
          <p className="text-beyond mb-6 text-micro">
            No rate set for{' '}
            {pricing.gaps
              .map(
                (g) =>
                  `${g.serviceName} at ${g.tiers
                    .map((t) => COMPLEXITY_LABELS[t as Complexity] ?? t)
                    .join('/')} (${g.variations} variation${g.variations === 1 ? '' : 's'})`,
              )
              .join('; ')}{' '}
            — counted above, but not priced.
          </p>
        )}

        <PricedLedger
          rows={pricing?.deliveries ?? []}
          loading={isLoading}
          range={range}
          delivererId={delivererId}
          noRevisions={noRevisions}
          /* One variation. */
          onToggleRevisions={(code) =>
            setNoRevisions((prev) => {
              const next = new Set(prev)
              if (next.has(code)) next.delete(code)
              else next.add(code)
              return next
            })
          }
          /* A whole delivery: every line it has, together. Charging any part of
             it clears them all, so the delivery tick and its variation ticks
             can never disagree about what the PDF will do. */
          onToggleDelivery={(codes, charge) =>
            setNoRevisions((prev) => {
              const next = new Set(prev)
              for (const code of codes) {
                if (charge) next.delete(code)
                else next.add(code)
              }
              return next
            })
          }
          onToggleAllRevisions={(chargeAll) =>
            setNoRevisions(
              chargeAll
                ? new Set()
                : new Set(
                    (pricing?.deliveries ?? []).flatMap((r) => r.lines.map((l) => l.code)),
                  ),
            )
          }
        />
      </section>

    </div>
  )
}


/**
 * The ledger, priced.
 *
 * Same identity columns as /ledger and in the same order, so the two screens
 * read as one register seen twice: a row here is the same delivery, with what
 * it was worth added on the right. The rollup above says a number; this says
 * which deliveries made it, which is the only way a number gets checked.
 *
 * A delivery whose tier has no rate shows "no rate", never $0.00 — a zero would
 * be indistinguishable from free work.
 */
function PricedLedger({
  rows,
  loading,
  range,
  delivererId,
  noRevisions,
  onToggleRevisions,
  onToggleDelivery,
  onToggleAllRevisions,
}: {
  rows: PricedDelivery[]
  loading: boolean
  /** Carried into a single-delivery statement's URL, which still needs a range. */
  range: { from: string; to: string }
  delivererId: string
  /** Task ids whose rounds the PDF will not charge for. */
  noRevisions: Set<string>
  onToggleRevisions: (variationCode: string) => void
  onToggleDelivery: (variationCodes: string[], charge: boolean) => void
  onToggleAllRevisions: (chargeAll: boolean) => void
}) {
  /** Which delivery is showing its arithmetic. One at a time — this is a check,
      not a reading view, and every row open at once is just a taller table. */
  const [open, setOpen] = useState<string | null>(null)

  /**
   * Which deliveries in the Statements panel are showing their child products.
   *
   * Collapsed by default. Listing every variation of every delivery turned the
   * panel into twenty near-identical capsules — each child repeats its parent's
   * code in full and only the suffix is new — and a control you need once a
   * month should not cost that much reading every day.
   *
   * A delivery whose children DISAGREE opens itself regardless (below), so a
   * split can never be hidden behind a chevron.
   */
  const [openLines, setOpenLines] = useState<Set<string>>(new Set())

  /** Deliveries that have revision money at all — the rest cannot be charged. */

  /**
   * The deliveries grouped by the agency whose bill they land on.
   *
   * Order follows the table beside it — newest delivery first — so an agency
   * appears where its most recent job does, rather than alphabetically, which
   * would put the partner you just logged work for somewhere unpredictable.
   */
  const byAgency = rows.reduce<
    {
      agencyId: string
      agencyName: string
      rows: PricedDelivery[]
      /** Variation rows across those deliveries — what actually shipped. */
      deliveredItems: number
      /** This agency's excluded variation codes, comma-joined for its own URL. */
      excluded: string
      /** What its rounds come to with the current ticks, for the summary line. */
      chargedMinor: number
      /** Every variation code on this agency's bill, for its own tick. */
      codes: string[]
      /** How many of those are left off it. */
      off: number
    }[]
  >((acc, r) => {
    const group =
      acc.find((g) => g.agencyId === r.agencyId) ??
      (acc.push({
        agencyId: r.agencyId,
        agencyName: r.agencyName,
        rows: [],
        deliveredItems: 0,
        excluded: '',
        chargedMinor: 0,
        codes: [],
        off: 0,
      }),
      acc[acc.length - 1]!)

    group.rows.push(r)
    group.deliveredItems += r.lines.length
    for (const l of r.lines) {
      group.codes.push(l.code)
      if (noRevisions.has(l.code)) {
        group.off += 1
        group.excluded = group.excluded ? `${group.excluded},${l.code}` : l.code
      } else {
        group.chargedMinor += l.revisionsMinor
      }
    }
    return acc
  }, [])

  /** The whole range, for the tick at the head of the panel. */
  const allCodes = rows.flatMap((r) => r.lines.map((l) => l.code))
  const allOff = allCodes.filter((c) => noRevisions.has(c)).length

  return (
    <>
      <PanelHeader
        title="Every delivery, priced"
        note="One row per delivery, newest first — the same rows as the ledger with what each was worth. Open a row for how its total was worked out. Anything at a tier with no rate says so rather than counting as zero. The statements beside it are per agency; the ticks there decide which deliveries put their revision rounds on that bill, and nothing here changes when they move."
      />

      {/*
        Two panels: the figures, and the statements built from them.

        The per-delivery controls were briefly columns in the table, then a strip
        inside each opened row. Both were wrong for the same reason — a table of
        money is one thing to read and a set of documents to produce is another,
        and putting the second inside the first made every row carry controls it
        had nothing to do with. They are their own table now (owner,
        2026-08-29), beside the one they refer to.
      */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start">
      <div className="border-rule bg-surface shadow-card overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[60rem] border-collapse text-dense">
          <thead>
            <tr className="border-rule-strong bg-wash/70 border-b">
              {/*
                The disclosure sits first, not last.

                As the last column it was the first thing to fall off the right
                edge when the table scrolled — so the only sign a row opens, and
                the controls behind it, were invisible. Leading the row also
                reads the way a disclosure triangle is meant to.
              */}
              <Th />
              <Th>Code</Th>
              <Th>Delivered</Th>
              <Th>Brand</Th>
              <Th>ASIN</Th>
              <Th>Agency</Th>
              <Th>Service</Th>
              <Th>Variations</Th>
              <Th>Paid rounds</Th>
              <Th>Deliverables</Th>
              <Th>Revisions</Th>
              <Th>Total</Th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={12} className="text-ink-muted py-8 text-center text-micro">
                  Pricing
                </td>
              </tr>
            )}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={12} className="text-ink-muted py-8 text-center text-micro">
                  Nothing delivered in this range.
                </td>
              </tr>
            )}

            {rows.map((r) => {
              // Nothing on the row could be priced: say so once, in the total,
              // rather than printing three zeroes that look like a real figure.
              const nothingPriced = r.unpricedVariations === r.variations && r.variations > 0

              const expanded = open === r.taskId

              return (
                <Fragment key={r.taskId}>
                {/*
                  Reachable by keyboard, not just by mouse.

                  A bare onClick on a <tr> is invisible to the keyboard and to a
                  screen reader — the breakdown, and everything behind it, could
                  only be opened by pointing at it. The row announces itself as a
                  button, says whether it is open, and answers Enter and Space
                  the way one does.
                */}
                <tr
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                  aria-label={`How ${r.taskCode} was priced`}
                  onClick={() => setOpen(expanded ? null : r.taskId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setOpen(expanded ? null : r.taskId)
                    }
                  }}
                  className={cn(
                    'border-rule hover:bg-wash focus-visible:bg-wash cursor-pointer border-b outline-none last:border-0',
                    expanded && 'bg-wash',
                  )}
                >
                  <Td control>
                    <ChevronDown
                      aria-hidden
                      className={cn(
                        'text-ink-faint size-4 transition-transform duration-[160ms]',
                        expanded && 'text-ink rotate-180',
                      )}
                    />
                  </Td>

                  <Td className="whitespace-nowrap">
                    <Link
                      href={`/ledger/${r.taskId}`}
                      className="code text-ink-muted hover:text-ink underline decoration-dotted underline-offset-2 transition-colors duration-[120ms]"
                    >
                      {r.taskCode}
                    </Link>
                  </Td>
                  <Td className="text-ink-muted whitespace-nowrap">
                    {formatDateOnly(r.deliveredOn)}
                  </Td>
                  <Td className="max-w-[14ch] truncate font-medium" title={r.brandName}>
                    {r.brandName}
                  </Td>
                  <Td className="text-ink-muted whitespace-nowrap" title={r.productName ?? undefined}>
                    {r.asinCode ? <span className="code">{r.asinCode}</span> : '—'}
                  </Td>
                  <Td className="text-ink-muted max-w-[14ch] truncate" title={r.agencyName}>
                    {r.agencyName}
                    {r.agencyType === 'DIRECT' && (
                      <Pill tone="outline" className="ml-1.5">
                        direct
                      </Pill>
                    )}
                  </Td>
                  <Td className="max-w-[16ch] truncate whitespace-nowrap" title={r.serviceName}>
                    {r.serviceName}
                    {r.isBundle && (
                      <Pill tone="outline" className="ml-1.5">
                        bundle
                      </Pill>
                    )}
                  </Td>
                  {/*
                    A count per tier, not a total followed by tier names.

                    It read "2 standalone High", which nobody could parse: the 2
                    was the delivery's variation count and the capsules were the
                    distinct tiers present, so it looked like two standalones
                    and one High — three variations, on a row that had two. Each
                    figure now sits against the capsule it counts, and they add
                    up to the column heading.
                  */}
                  <Td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-2.5">
                      {tierCounts(r).map(({ tier, count }) => (
                        <span key={tier} className="inline-flex items-center gap-1.5">
                          <span className="tabular">{count}</span>
                          <ComplexityPill complexity={tier} />
                        </span>
                      ))}
                    </span>
                  </Td>
                  {/*
                    Rounds past the allowance snapshotted when this was logged —
                    the ones the rate card actually charges for.
                  */}
                  {/*
                    A count of rounds past the allowance, which is not the same
                    as a charge — rounds on an untiered variation are free, so
                    this can read 2 while Revisions reads 0.00. The tooltip says
                    so, because that pairing looks like a bug otherwise.
                  */}
                  <Td
                    className={cn('tabular', r.extraRounds > 0 && 'text-beyond')}
                    title={
                      `Allowance ${r.allowanceSnapshot} when logged. ` +
                      'Rounds on a variation with no tier are not charged — the standalone price is flat.'
                    }
                  >
                    {r.extraRounds}
                  </Td>
                  <Td className="tabular text-ink-muted">
                    {nothingPriced ? '—' : formatMoneyMinor(r.variationsMinor, false)}
                  </Td>
                  <Td className="tabular text-ink-muted">
                    {nothingPriced ? '—' : formatMoneyMinor(r.revisionsMinor, false)}
                  </Td>
                  <Td className="tabular font-medium">
                    {nothingPriced ? (
                      <span className="text-beyond text-micro font-normal">no rate</span>
                    ) : (
                      <>
                        {formatMoneyMinor(r.totalMinor)}
                        {r.unpricedVariations > 0 && (
                          <span className="text-beyond ml-1.5 text-micro font-normal">
                            +{r.unpricedVariations} unpriced
                          </span>
                        )}
                      </>
                    )}
                  </Td>

                </tr>

                {/*
                  An open breakdown pushes this row's half down and the other
                  half does not follow, so the two stop describing the same job
                  below it. Accepted: the breakdown belongs with the figures, it
                  is transient, and the alternative — mirroring an empty spacer
                  into the statements panel — would be a lie about that row.
                */}
                {expanded && (
                  <tr className="border-rule bg-wash/60 border-b last:border-0">
                    <td colSpan={12} className="px-4 py-3">
                      <PriceBreakdown row={r} />

                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/*
        Statements, one per agency (owner, 2026-08-29).

        This was one PDF per project for a few hours, and the owner reversed it:
        a partner is billed for a month of work, not for one job at a time, so
        the document that matters covers everything that agency had delivered in
        the range — every service, one bill.

        The per-delivery ticks stay, nested under the agency they belong to,
        because "charge the rounds on this job but not that one" is a real thing
        to want inside a single statement. Each agency's PDF carries only its own
        exclusions: another partner's task ids have no business in a URL that
        gets opened, printed and forwarded.

        It no longer lines up row-for-row with the table beside it, and cannot —
        it is grouped by agency where that is grouped by delivery. That is the
        cost of the reversal and it is the right way round: the panel matches the
        documents it produces rather than the table it sits next to.
      */}
      <div className="border-rule bg-surface shadow-card overflow-hidden rounded-xl border">
        <div className="border-rule-strong bg-wash/70 border-b px-4 py-3">
          {/*
            The heading and the tick that governs every row under it.

            All-or-nothing used to be two buttons — Charge all / None — in the
            priced table's header next door, which needed the words "in PDFs"
            to explain that nothing in that table moved when they were pressed.
            Here it needs no such caption: this panel IS the PDFs, and the
            control is the same shape as every tick beneath it, so the four
            levels — the range, an agency, a delivery, a child product — read as
            one hierarchy rather than as two mechanisms that have to agree.
          */}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-dense font-medium">Statements</h3>

            {rows.length > 0 && (
              <label className="text-ink-muted hover:text-ink flex cursor-pointer items-center gap-2 text-micro transition-colors duration-[120ms]">
                <input
                  type="checkbox"
                  checked={allOff === 0}
                  ref={(el) => {
                    if (el) el.indeterminate = allOff > 0 && allOff < allCodes.length
                  }}
                  onChange={() => onToggleAllRevisions(allOff > 0)}
                  title="Charge revision rounds on every statement in this range"
                  className="accent-ink size-3.5 shrink-0"
                />
                Charge revision rounds
              </label>
            )}
          </div>
        </div>

        {byAgency.length === 0 && (
          <p className="text-ink-muted px-4 py-8 text-center text-micro">
            Nothing to bill in this range.
          </p>
        )}

        <ul className="divide-rule divide-y">
          {byAgency.map((group) => (
            <li key={group.agencyId} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                {/* Everything on this agency's bill, together. */}
                <input
                  type="checkbox"
                  checked={group.off === 0}
                  ref={(el) => {
                    if (el) el.indeterminate = group.off > 0 && group.off < group.codes.length
                  }}
                  onChange={() => onToggleDelivery(group.codes, group.off > 0)}
                  aria-label={`Charge revision rounds on ${group.agencyName}'s statement`}
                  title={`Charge the revision rounds on every delivery in ${group.agencyName}'s statement`}
                  className="accent-ink size-3.5 shrink-0"
                />

                <span className="min-w-0 grow">
                  <span className="text-dense block truncate font-medium">
                    {group.agencyName}
                  </span>
                  <span className="text-ink-faint block text-micro">
                    {/* The rows below are ledger rows; the count is what
                        actually shipped — every variation under them (§2.5). */}
                    {group.deliveredItems} deliver{group.deliveredItems === 1 ? 'y' : 'ies'}
                    {group.chargedMinor > 0 &&
                      ` · ${formatMoneyMinor(group.chargedMinor)} in rounds`}
                  </span>
                </span>

                <Link
                  href={
                    `/admin/statement?agencyId=${encodeURIComponent(group.agencyId)}` +
                    `&from=${range.from}&to=${range.to}` +
                    (group.excluded ? `&noRevisions=${encodeURIComponent(group.excluded)}` : '') +
                    (delivererId ? `&delivererId=${encodeURIComponent(delivererId)}` : '')
                  }
                  target="_blank"
                  title={`Statement for ${group.agencyName}, ${range.from} to ${range.to}`}
                  className="text-ink-muted hover:text-ink inline-flex shrink-0 items-center gap-1 text-micro underline decoration-dotted underline-offset-2"
                >
                  <FileDown className="size-3.5" />
                  PDF
                </Link>
              </div>

              {/* The jobs on that bill, each with its own revision decision —
                  and, where a delivery shipped for more than one child product,
                  each of those with its own beneath it (§5.7).

                  Indented past the agency's own tick, so the four levels read
                  as a hierarchy rather than as one flat column of boxes: the
                  offset is that checkbox plus its gap. */}
              <ul className="mt-2 ml-[1.625rem] space-y-1.5">
                {group.rows.map((r) => {
                  const codes = r.lines.map((l) => l.code)
                  const off = codes.filter((c) => noRevisions.has(c)).length
                  const charged = r.lines.reduce(
                    (n, l) => n + (noRevisions.has(l.code) ? 0 : l.revisionsMinor),
                    0,
                  )

                  /* Some charged and some not. The collapsed row says so in
                     words, so opening it is for changing the split rather than
                     for discovering there is one. */
                  const mixed = off > 0 && off < codes.length
                  const showLines = r.lines.length > 1 && openLines.has(r.taskId)

                  return (
                    <li key={r.taskId}>
                      <div className="flex items-center gap-2.5 text-micro">
                        <input
                          type="checkbox"
                          checked={off === 0}
                          /*
                            Half-ticked when some of its variations are charged
                            and some are not — the honest third state, and the
                            only way a collapsed delivery can tell the truth
                            about the lines under it. `indeterminate` is a DOM
                            property with no HTML attribute, so it is set on the
                            node itself.
                          */
                          ref={(el) => {
                            if (el) el.indeterminate = off > 0 && off < codes.length
                          }}
                          onChange={() => onToggleDelivery(codes, off > 0)}
                          aria-label={`Charge revision rounds for ${r.taskCode}`}
                          title={
                            r.revisionsMinor > 0
                              ? `Charge the revision rounds on every variation of ${r.taskCode}`
                              : 'Charge revision rounds on this bill. This delivery has none to charge, so the figure does not change.'
                          }
                          className="accent-ink size-3.5 shrink-0"
                        />
                        <CodePill>{r.taskCode}</CodePill>
                        <span
                          className={cn(
                            'min-w-0 grow truncate',
                            charged > 0 ? 'text-ink' : 'text-ink-faint',
                          )}
                        >
                          {charged > 0
                            ? /* "in rounds" gives way to the count when the
                                 delivery is split: the panel's own heading
                                 already says these are revision rounds, and
                                 the split is the thing this row has to fit. */
                              mixed
                              ? `${formatMoneyMinor(charged)} · ${off} left off`
                              : `${formatMoneyMinor(charged)} in rounds`
                            : r.extraRounds === 0
                              ? 'no paid rounds'
                              : r.unpricedVariations > 0
                                ? `${r.extraRounds} paid, not priced`
                                : off > 0
                                  ? 'rounds left off this bill'
                                  : `${r.extraRounds} paid, free at this rate`}
                        </span>

                        {/*
                          Only where there is more than one line to show. A
                          delivery with a single variation IS that variation —
                          its code and the task code are the same string (§2.5)
                          — so there is nothing under it to open.
                        */}
                        {r.lines.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setOpenLines((prev) => {
                                const next = new Set(prev)
                                if (next.has(r.taskId)) next.delete(r.taskId)
                                else next.add(r.taskId)
                                return next
                              })
                            }
                            aria-expanded={showLines}
                            aria-label={`Child products of ${r.taskCode}`}
                            title={`${r.lines.length} child products — charge their rounds one at a time`}
                            className="text-ink-faint hover:text-ink flex shrink-0 items-center gap-0.5 transition-colors duration-[120ms]"
                          >
                            <span className="tabular">{r.lines.length}</span>
                            <ChevronDown
                              className={cn(
                                'size-3 transition-transform duration-[160ms]',
                                showLines && 'rotate-180',
                              )}
                            />
                          </button>
                        )}
                      </div>

                      {showLines && (
                        <ul className="border-rule mt-1.5 ml-[0.4375rem] space-y-1.5 border-l pl-3">
                          {r.lines.map((l) => (
                            <li
                              key={l.variationNumber}
                              className="flex items-center gap-2.5 text-micro"
                            >
                              <input
                                type="checkbox"
                                checked={!noRevisions.has(l.code)}
                                onChange={() => onToggleRevisions(l.code)}
                                aria-label={`Charge revision rounds for ${l.code}`}
                                title={
                                  l.revisionsMinor > 0
                                    ? `Charge ${formatMoneyMinor(l.revisionsMinor)} of revision rounds on this bill`
                                    : 'Charge revision rounds on this bill. This variation has none to charge, so the figure does not change.'
                                }
                                className="accent-ink size-3.5 shrink-0"
                              />

                              {/*
                                The suffix, not the whole code.

                                Every child repeats its parent's code in full
                                and only the last characters differ, so a column
                                of them is the same string eight times over with
                                the one distinguishing part buried at the end.
                                The delivery's code sits directly above; what a
                                child adds to it is what it should show. The
                                whole code is on the row's title for quoting,
                                and it is what travels in the URL.
                              */}
                              <span
                                className="code text-ink-faint w-9 shrink-0 tabular"
                                title={l.code}
                              >
                                {/* A delivery with no parent line has no bare
                                    code to sit under: every line is a child. */}
                                {r.hasParentLine === false
                                  ? `-${l.variationNumber}`
                                  : l.variationNumber === 1
                                    ? '—'
                                    : `-${l.variationNumber - 1}`}
                              </span>

                              <span
                                className={cn(
                                  'min-w-0 grow truncate',
                                  l.revisionsMinor > 0 ? 'text-ink' : 'text-ink-faint',
                                )}
                              >
                                {/* The parent line has no child name; it is the
                                    service against the listing (§2.4). */}
                                {l.productName ?? r.productName ?? 'parent listing'}
                              </span>

                              {/* Right-aligned, so the figures you are deciding
                                  between form a column instead of trailing each
                                  name at a different place on the line. */}
                              <span
                                className={cn(
                                  'shrink-0 tabular',
                                  l.revisionsMinor > 0 ? 'text-ink-muted' : 'text-ink-faint',
                                )}
                              >
                                {l.revisionsMinor > 0 ? formatMoneyMinor(l.revisionsMinor) : '—'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
      </div>
    </>
  )
}

/**
 * How one delivery's total was worked out.
 *
 * One line per variation, showing the rate that was applied rather than only
 * the result — an amount you cannot check against the rate card is an amount
 * nobody can defend in front of a client. The sums are the server's, not
 * recomputed here, so this can never disagree with the row above it.
 */
/**
 * The heading, which has to describe whatever range is actually loaded.
 *
 * "What shipped this month" was true while a month picker was the only control.
 * Now the screen can be showing six weeks or a single day, and a title that
 * kept saying "this month" would be quietly wrong on exactly the ranges someone
 * chose deliberately — so it names a whole month when it is one and states the
 * dates otherwise.
 */
function rangeTitle(range: { from: string; to: string }): string {
  const current = monthRange(currentYearMonth())
  if (range.from === current.from && range.to === current.to) return 'What shipped this month'

  const whole = monthRange(range.from.slice(0, 7))
  if (range.from === whole.from && range.to === whole.to) {
    return `What shipped in ${new Date(`${range.from}T00:00:00Z`).toLocaleDateString('en-GB', {
      timeZone: 'UTC',
      month: 'long',
      year: 'numeric',
    })}`
  }

  return `What shipped, ${formatDateOnly(range.from)} to ${formatDateOnly(range.to)}`
}

/** "Month total" when the range is one, "Range total" when it is not. */
function totalLabel(range: { from: string; to: string }): string {
  const whole = monthRange(range.from.slice(0, 7))
  return range.from === whole.from && range.to === whole.to ? 'Month total' : 'Range total'
}

/**
 * How many variations sat at each tier, in the order the tiers are shown.
 *
 * Counted from the priced lines — one per variation, each carrying its own
 * complexity — rather than asked of the API, so the figures beside the capsules
 * are the same rows the breakdown below expands to and cannot disagree with it.
 *
 * Falls back to the distinct-tier list for any delivery whose lines did not
 * come through, which puts a 1 against each rather than dropping the cell.
 */
function tierCounts(r: PricedDelivery): { tier: Complexity; count: number }[] {
  if (!r.lines?.length) return r.tiers.map((tier) => ({ tier, count: 1 }))

  const counts = new Map<Complexity, number>()
  for (const line of r.lines) {
    const tier = (line.complexity ?? 'STANDALONE') as Complexity
    counts.set(tier, (counts.get(tier) ?? 0) + 1)
  }

  // Shown in the tier order the rest of the product uses, not line order.
  return r.tiers
    .filter((tier) => counts.has(tier))
    .map((tier) => ({ tier, count: counts.get(tier)! }))
}
