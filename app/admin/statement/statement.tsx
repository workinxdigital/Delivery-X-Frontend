'use client'

import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { isAdmin, useSession } from '@/components/session'
import { getAgencies, getPricing } from '@/lib/api/client'
import { COMPLEXITY_LABELS, formatDateOnly, formatMoneyMinor } from '@/lib/format'
import type { Complexity } from '@/lib/api/types'

/**
 * A delivery statement for one agency, designed to be saved as a PDF.
 *
 * Printed rather than generated. A drawing-API PDF library would rebuild this
 * layout in its own primitives and lose the brand's type and colour on the way
 * — the owner asked for something that is not generic, and the design system is
 * already here. So this is a real page with a real print stylesheet, and the
 * browser's Save-as-PDF turns it into a file.
 *
 * `print-color-adjust: exact` is load-bearing: without it a browser drops the
 * lime rule and the tier capsules, and what saves is a grey skeleton of this.
 *
 * What it is NOT: an invoice. No tax, no payment terms, no invoice number, no
 * due date — those are still out of scope (§1). This states what shipped and
 * what the rate card says it was worth, which is the same thing the Pricing
 * screen says, on paper.
 */
export function Statement() {
  const params = useSearchParams()
  const { user, loading } = useSession()

  const agencyId = params.get('agencyId') ?? ''
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const delivererId = params.get('delivererId') ?? ''
  /**
   * One delivery instead of the whole range (owner, 2026-08-29).
   *
   * A statement is still addressed to the agency — the masthead and the "for"
   * do not change — it simply covers one job. Partners ask for a bill against a
   * single project often enough that reaching it by narrowing the date range
   * until only that job survives was the wrong answer.
   */
  const taskId = params.get('taskId') ?? ''
  /**
   * Which deliveries do NOT charge their revision rounds.
   *
   * Per delivery since 2026-08-29. It was one switch for the whole statement,
   * which forced the same answer on every line — and a month's bill often has
   * one job revised as goodwill among a dozen that are chargeable.
   *
   * Excluded rather than included, so a delivery the sender never considered is
   * charged rather than quietly given away. `revisions=0` is still honoured for
   * any link written before this, where it means "none of them".
   */
  const excluded = new Set(
    (params.get('noRevisions') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  )
  const legacyNone = params.get('revisions') === '0'

  /**
   * Whether ONE variation's rounds are billed.
   *
   * Per child product since 2026-09-01, where it was per delivery before. The
   * reason is the reason it went per delivery in the first place, one level
   * down: a job with three SKUs can have the rounds on one of them absorbed as
   * goodwill while the other two are chargeable, and a delivery-level tick
   * forced the same answer on all three.
   *
   * The key is the variation's own code (§2.5) — derived, unique and readable,
   * so an exclusion is legible in the URL rather than being an opaque id. A
   * task id in the list still excludes that whole delivery, because links
   * written before this carry ids, and `revisions=0` still means "none of
   * them" for links older still.
   */
  const chargesLine = (taskId: string, code: string) =>
    !legacyNone && !excluded.has(code) && !excluded.has(taskId)

  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: getAgencies })

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'pricing', from, to, 'service', agencyId, delivererId, taskId],
    queryFn: () =>
      getPricing({
        from,
        to,
        groupBy: 'service',
        agencyId,
        delivererId: delivererId || undefined,
        taskId: taskId || undefined,
      }),
    enabled: Boolean(agencyId && from && to),
  })

  if (loading) return null
  if (!isAdmin(user)) {
    return <p className="p-8 text-dense">This statement needs admin access.</p>
  }
  if (!agencyId || !from || !to) {
    return <p className="p-8 text-dense">Missing agency or date range.</p>
  }

  const agency = agencies.find((a) => a.id === agencyId)
  const rows = data?.deliveries ?? []

  /*
   * Totalled from the rows, because the answer is now per delivery.
   *
   * The server's own total cannot be used any more: it charges everything, and
   * the exclusions live in the URL. Summing the rows keeps the page's own
   * arithmetic visible and means the figure at the top is the sum of the
   * figures below it, which is the only version a client can check.
   */
  const revisionsCharged = rows.reduce(
    (sum, r) =>
      sum +
      r.lines.reduce((n, l) => n + (chargesLine(r.taskId, l.code) ? l.revisionsMinor : 0), 0),
    0,
  )
  const paidRoundsCharged = rows.reduce(
    (sum, r) =>
      sum + r.lines.reduce((n, l) => n + (chargesLine(r.taskId, l.code) ? l.paidRounds : 0), 0),
    0,
  )
  const total = (data?.totals.variationsMinor ?? 0) + revisionsCharged

  /**
   * Whether the document mentions revisions at all.
   *
   * When nothing on this statement charges for them it says nothing about them
   * — no column, no paid-round count, no struck-through figure. A bill that
   * explains what it decided not to bill for reads as a discount waiting to be
   * queried (§5.7).
   */
  const anyRevisions = rows.some((r) =>
    r.lines.some((l) => chargesLine(r.taskId, l.code) && l.revisionsMinor > 0),
  )

  return (
    <div className="statement">
      {/* Screen-only. The page below it is what saves. */}
      <div className="no-print mx-auto flex max-w-[52rem] items-center justify-between gap-4 px-6 pt-6">
        <p className="text-ink-muted text-micro">
          Save as PDF from the print dialog. Turn on <strong>Background graphics</strong> if
          your browser offers it — the tier marks and the lime rule are backgrounds.
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="bg-ink text-paper hover:bg-noir-soft inline-flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-dense transition-colors duration-[120ms]"
        >
          <Printer className="size-4" />
          Save as PDF
        </button>
      </div>

      <article className="sheet">
        {/*
          The logo carries its own dark box — the asset has black baked in — so
          the mark itself is the lockup. It used to sit inside a full-bleed noir
          band, which put a heavy black strip across the top of a document that
          is otherwise warm paper.
        */}
        <header className="masthead">
          <Image
            src="/workinx-logo.png"
            alt="WorkinX Digital"
            width={132}
            height={36}
            className="mark"
            unoptimized
          />
          <div className="masthead-meta">
            <span className="eyebrow">Delivery statement</span>
            <span className="masthead-range">
              {formatDateOnly(from)} — {formatDateOnly(to)}
            </span>
          </div>
        </header>

        <div className="lede">
          <div>
            <span className="eyebrow ink">Prepared for</span>
            <h1>{agency?.name ?? 'Agency'}</h1>
            {/* One job names itself; a range counts. */}
            <p className="sub">
              {taskId && rows[0]
                ? `${rows[0].taskCode} · ${rows[0].serviceName}`
                : `${rows.length} deliver${rows.length === 1 ? 'y' : 'ies'}`}
            </p>
          </div>

          {/* The number the page exists for. */}
          <div className="total-block">
            <span className="eyebrow">Total</span>
            <span className="total">{formatMoneyMinor(total)}</span>
            <span className="currency">USD</span>
          </div>
        </div>

        {data && (
          /*
            When revisions are not charged, the statement does not mention them.

            It previously showed "Rounds (not charged)" and a struck-through
            "Revisions excluded" — which is a bill explaining what it decided
            not to bill for, and reads as a discount the client can ask about.
            Off means the document is simply about deliverables.
          */
          <div className={anyRevisions ? 'stats stats-5' : 'stats stats-3'}>
            {/* Every variation row shipped (§2.5, owner 2026-08-31), so this
                counts them rather than the ledger rows they sit under — the
                same figure the ledger and the Billing screen report. */}
            <Stat
              label="Deliveries"
              value={String(rows.reduce((n, r) => n + r.lines.length, 0))}
            />
            {/* Children only (§2.4): the first line of each delivery is the
                service against the parent listing, not a variation. Counted
                here rather than taken from the server's total, which counts
                priced lines because the Billing screen's figures explain money
                and every line is charged. */}
            <Stat
              label="Variations"
              value={String(rows.reduce((n, r) => n + Math.max(0, r.lines.length - 1), 0))}
            />
            {anyRevisions && <Stat label="Paid rounds" value={String(paidRoundsCharged)} />}
            <Stat label="Deliverables" value={formatMoneyMinor(data.totals.variationsMinor)} />
            {anyRevisions && (
              <Stat label="Revisions" value={formatMoneyMinor(revisionsCharged)} />
            )}
          </div>
        )}

        {isLoading && <p className="empty">Pricing…</p>}
        {data && rows.length === 0 && <p className="empty">Nothing delivered in this period.</p>}

        {/*
          One block per delivery, with its variations under it. Grouped this way
          rather than as one flat table because the question a client asks is
          "what is this line", and the answer is the variations beneath it.
        */}
        {rows.map((r) => {
          const nothingPriced = r.unpricedVariations === r.variations && r.variations > 0

          return (
            <section key={r.taskId} className="delivery">
              {/*
                No subtotal on the right, and nobody named.

                The subtotal repeated the sum of the two or three lines directly
                beneath it, on a page that already states the grand total at the
                top — three places for one arithmetic. And who delivered the work
                is an internal fact: a client statement should say what shipped,
                not which colleague shipped it.
              */}
              <div className="delivery-head">
                <span className="code">{r.taskCode}</span>
                <h2>{r.serviceName}</h2>
                <p className="meta">
                  {r.brandName}
                  {r.asinCode ? ` · ${r.asinCode}` : ''}
                  {r.productName ? ` · ${r.productName}` : ''} · delivered{' '}
                  {formatDateOnly(r.deliveredOn)}
                </p>
                {/* The one case worth keeping: a line that could not be priced
                    at all would otherwise show a table of dashes and no reason. */}
                {nothingPriced && <p className="unpriced">No rate set for this delivery</p>}
              </div>

              <table className="lines">
                {/* Fixed columns so money aligns across every delivery block. */}
                <colgroup>
                  <col className={anyRevisions ? 'c-product-4' : 'c-product'} />
                  <col className={anyRevisions ? 'c-tier-4' : 'c-tier'} />
                  <col className={anyRevisions ? 'c-rate' : 'c-num'} />
                  {anyRevisions && <col className="c-rev" />}
                  <col className={anyRevisions ? 'c-rate' : 'c-num'} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Tier</th>
                    <th className="num">Rate</th>
                    {anyRevisions && <th className="num">Revisions</th>}
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lines.map((l) => {
                    /* Per variation, not per delivery: this line's own tick. */
                    const charged = chargesLine(r.taskId, l.code)
                    return (
                    <tr key={l.variationNumber}>
                      <td>
                        <span className="n">{l.code}</span>{' '}
                        {/* The parent's name where a child has none: the
                            service's own line is the parent (§2.4). */}
                        {l.productName ?? r.productName ?? <em>unnamed</em>}
                      </td>
                      <td>
                        <span
                          className={`tier tier-${(l.complexity ?? 'STANDALONE').toLowerCase()}`}
                        >
                          {l.complexity === 'STANDALONE'
                            ? 'standalone'
                            : (COMPLEXITY_LABELS[l.complexity as Complexity] ?? '—')}
                        </span>
                      </td>
                      <td className="num">
                        {l.priced ? (
                          formatMoneyMinor(l.perVariationMinor ?? 0)
                        ) : (
                          <em className="warn">not priced</em>
                        )}
                      </td>
                      {anyRevisions && (
                        /*
                          One line, not two.

                          The multiplier used to sit above its result, which
                          made every revisions cell two lines tall and left the
                          right third of the page carrying three figures at two
                          different heights. Written as an equation it stays on
                          one line and still shows its working, which is the
                          point — an amount a client cannot check is an amount
                          they will ask about.
                        */
                        <td className="num">
                          {charged && l.priced && l.paidRounds > 0 ? (
                            <span className="calc">
                              <span className="mult">
                                {l.paidRounds} × {formatMoneyMinor(l.perExtraRevisionMinor ?? 0)}
                                {' = '}
                              </span>
                              {formatMoneyMinor(l.revisionsMinor)}
                            </span>
                          ) : (
                            <span className="dash">—</span>
                          )}
                        </td>
                      )}
                      <td className="num strong">
                        {l.priced ? (
                          formatMoneyMinor(charged ? l.totalMinor : l.variationMinor)
                        ) : (
                          <span className="dash">—</span>
                        )}
                      </td>
                    </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          )
        })}

        {/*
          Work delivered at a tier this agency has no rate for. Named on the
          statement itself rather than quietly dropped: a total that looks
          complete while omitting work is the one thing this must never do.
        */}
        {data && data.gaps.length > 0 && (
          <section className="gaps">
            <span className="eyebrow ink">Not included</span>
            <p>
              {data.gaps
                .map(
                  (g) =>
                    `${g.serviceName} at ${g.tiers
                      .map((t) =>
                        t === 'STANDALONE'
                          ? 'standalone'
                          : (COMPLEXITY_LABELS[t as Complexity] ?? t),
                      )
                      .join(' / ')} — ${g.variations} variation${g.variations === 1 ? '' : 's'}`,
                )
                .join('; ')}
              . These shipped but have no rate on this agency, so they are counted here and
              not priced.
            </p>
          </section>
        )}

        <footer className="foot">
          <span>WorkinX Digital · Delivery statement · All amounts USD</span>
          <span>
            {agency?.name} · {formatDateOnly(from)} to {formatDateOnly(to)}
          </span>
        </footer>
      </article>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}
