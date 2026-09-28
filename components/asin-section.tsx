'use client'

import { ChevronRight, Plus, X } from 'lucide-react'
import { useId } from 'react'
import { AsinInput } from '@/components/asin-input'
import { Field } from '@/components/field'
import { MultiSelect, type MultiOption } from '@/components/multi-select'
import { ComplexityPill } from '@/components/pill'
import { Segmented } from '@/components/segmented'
import { Input } from '@/components/ui/input'
import type { Complexity, Service } from '@/lib/api/types'
import { COMPLEXITY_LABELS, formatCategory } from '@/lib/format'
import { cn } from '@/lib/utils'

export type AsinDraft = {
  /** Stable local id, so React keys survive reordering and removal. */
  key: string
  /** Optional: a PM without the code to hand still needs to log the work. */
  code: string
  /** What the product is called. How anyone actually recognises the listing. */
  productName: string
  /**
   * Whether this card is a parent listing or one of its variations.
   *
   * Per card since 2026-09-01 (owner): one submission can log the hero product
   * for one listing and a variation for another, and a single delivery-level
   * answer could not say that. The control at the top of the form sets every
   * card at once; this is what each card actually carries.
   */
  forParent: boolean
  /**
   * The tier this card was delivered at.
   *
   * Only meaningful on a variation delivery: a parent line always ships
   * standalone (§2.4). Empty is an answer rather than a blank — it means the
   * plain version of the service.
   */
  complexity: Complexity | ''
  serviceIds: string[]
}



let seq = 0
export function emptyAsin(forParent = true): AsinDraft {
  seq += 1
  return {
    key: `asin-${seq}`,
    code: '',
    productName: '',
    /* Inherits whatever the last card was, so adding a second variation does
       not silently start as a parent delivery. */
    forParent,
    complexity: '',
    serviceIds: [],
  }
}

/**
 * Three tiers, and leaving them alone is the fourth answer.
 *
 * Standalone used to sit here as a fourth button, which made it look like a
 * degree of complexity. It is not one: it means no tier applies — the plain
 * version of the service, at its base price (owner, 2026-08-27). So it is
 * absence rather than a choice, and the control clears back to it.
 */
const TIERS: { value: Complexity; label: string }[] = (
  ['LOW', 'MEDIUM', 'HIGH'] as Complexity[]
).map((c) => ({ value: c, label: COMPLEXITY_LABELS[c] }))

/**
 * An actual table, not a grid.
 *
 * The first attempt used one grid for the headings and another per row, which
 * cannot work: CSS grids do not share column widths, so "COMPLEXITY" sized its
 * column to the word while the row below sized the same column to the segmented
 * control. The headings ended up over the wrong columns.
 *
 * A table shares column widths across the head and body by definition, sizes
 * them to their content, and is the honest markup for what this is: rows of
 * delivered services with the same fields each. It scrolls sideways rather than
 * squeezing on a narrow window, since a segmented control and two inputs have a
 * floor below which they stop being usable.
 */
const CELL = 'px-1.5 py-3 align-top first:pl-0 last:pr-0'

/**
 * One PARENT product listing and everything shipped for it.
 *
 * The parent is the listing in the header; each variation below is a CHILD of
 * it — the same product in another size, colour or count, with its own ASIN.
 * That mirrors how Amazon itself is organised, and it is what makes "which SKU
 * did this artwork go on" a question the ledger can answer.
 *
 * Two parts, and the split is the point: a header saying which product this is,
 * then a table of what shipped for it. Both used to be one undifferentiated
 * stack of fields, so nothing marked where the product ended and the work began.
 *
 * The work is a table rather than a block repeated per service. Five services
 * meant five copies of "Complexity", "Revisions", "ClickUp" and "Add variation"
 * — the labels outnumbered the data. Stated once as column headings, each
 * service is one line you can read across and scan down.
 */
export function AsinSection({
  index,
  value,
  onChange,
  services,
  serviceOptions,
  brandId,
  errors,
  open,
  onOpen,
  onDone,
  onRemove,
  removable,
}: {
  index: number
  value: AsinDraft
  onChange: (next: AsinDraft) => void
  services: Service[]
  serviceOptions: MultiOption[]
  /** Resolved brand, when it already exists — ASIN suggestions are scoped to it. */
  brandId: string | null
  errors: Record<string, string>
  /**
   * Whether this card is the one being filled in.
   *
   * One at a time (owner, 2026-09-01). Each card is roughly 300px, so five
   * products put 1500px of form between you and the Save button — and the four
   * you have finished are not the ones you are looking at. A finished card
   * collapses to the line that summarises it and reopens on a click.
   */
  open: boolean
  onOpen: () => void
  /**
   * Close this card without opening another.
   *
   * Until this there was no way to put a finished card away: it collapsed only
   * when you opened a different one or added a product, so someone filling in
   * their last product had no way to stand back and read the stack before
   * saving (owner, 2026-09-01).
   *
   * It only closes it. The delivery is still saved once, by Save task — a card
   * is one product of a submission, not a submission of its own.
   */
  onDone: () => void
  onRemove: () => void
  removable: boolean
}) {
  /**
   * Stable ids for the labels. Built from the draft key these differed between
   * server and client — the key comes from a module counter — so every load
   * logged a hydration mismatch. useId is identical on both sides.
   */
  const uid = useId()

  if (!open) {
    /*
      The collapsed line: everything the card decided, in the order it decided
      it. Blank fields are named rather than skipped — "no ASIN" is a fact worth
      seeing before saving, where an absence you cannot see is one you find out
      about afterwards.
    */
    return (
      <div className="border-rule bg-surface shadow-card min-w-0 rounded-xl border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onOpen}
            aria-expanded={false}
            className="flex min-w-0 grow items-center gap-3 text-left text-dense"
          >
            <ChevronRight className="text-ink-faint size-3.5 shrink-0" />

            {/*
              The product name alone, at full strength.

              The line carried the ASIN and the services too, which made three
              greys of near-equal weight and nothing to find a card by. What you
              are looking for when you scan a stack of these is the product, so
              it is the only thing on the line and it reads as the heading it is.
              Everything else is a click away, inside the card.
            */}
            <span
              className={cn(
                'min-w-0 grow truncate',
                value.productName ? 'text-ink font-medium' : 'text-ink-faint',
              )}
            >
              {value.productName || 'unnamed'}
            </span>

            <span className="text-ink-faint shrink-0 text-micro">
              {value.forParent ? 'parent' : 'variation'}
            </span>
          </button>

          {removable && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove product ${index + 1}`}
              title="Remove this product"
              className="text-ink-faint hover:text-beyond hover:bg-paper flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-[120ms]"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    /*
      No overflow-hidden on the card.
      
      It was there to clip the tinted header into the rounded corners, and it
      also clipped every popover inside — the services dropdown opened and was
      cut off to a sliver showing only its search box. The header rounds its own
      top corners instead, which needs no clipping context.
    */
    /*
      min-w-0 is load-bearing.

      This card sits in a `[9rem_1fr]` grid, and a grid item's default
      `min-width: auto` means the column is sized by its content's minimum —
      so the table below stretched the card, and with it the ASIN and product
      fields in the header above, every time a variation was added. The card
      now takes its width from the column and the table scrolls inside it,
      which is what the overflow container was always there to do.
    */
    <div className="border-rule bg-surface shadow-card min-w-0 rounded-xl border">
      <div className="px-6 pt-6 pb-6">
        {/*
          What THIS card is.

          Per card since 2026-09-01 (owner): one submission can carry the hero
          product for one listing and a variation for another, and the control
          at the top of the form — which sets every card at once — could not say
          that on its own.

          Changing it clears the card's own rows, because a row means a
          different thing on each side: a parent line saves no name or tier
          (§2.4) and a variation card saves both.
        */}
        {/*
          No label above it. The two segments say what the choice is — "Parent
          product" or "Variations" — so a heading repeating the same words in
          the same breath was the label naming its own options. The control
          keeps its accessible name for anyone not reading it visually.
        */}
        <div className="mb-6">
          <Segmented
            name="What this card is"
            options={[
              { value: 'parent', label: 'Parent product' },
              { value: 'variation', label: 'Variations' },
            ]}
            value={value.forParent ? 'parent' : 'variation'}
            onChange={(v) => onChange({ ...value, forParent: v === 'parent', complexity: '' })}
          />
        </div>

        <Field
          label="What shipped"
          htmlFor={`${uid}-services`}
          error={errors.serviceIds}
          hint={
            value.serviceIds.length === 0
              ? value.forParent
                ? 'Each service picked here is one delivered line against this listing.'
                : 'Each service picked here is one delivered line for this variation.'
              : undefined
          }
        >
          <MultiSelect
            id={`${uid}-services`}
            options={serviceOptions}
            values={value.serviceIds}
            invalid={Boolean(errors.serviceIds)}
            placeholder="Select one or more services"
            searchPlaceholder="Search the catalogue"
            onChange={(next) =>
              onChange({
                ...value,
                serviceIds: next,
              })
            }
          />
        </Field>

        {value.serviceIds.length > 0 && (
          /* Scrolls rather than squeezes: below a certain width a segmented
             control and two inputs stop being usable, and a table that shrinks
             them to fit is worse than one you nudge sideways. */
          /* Close under the picker, not a section away from it: the bands are
             what that select just produced, so the gap between them should read
             as "here is the result" rather than as a new part of the card. */
          <div className="-mx-2.5 mt-3 overflow-x-auto px-2.5">
            <table className="w-full min-w-[28rem] border-collapse text-dense">
              {/*
                No headings on a parent delivery: it has no columns left to head.

                Its product and its listing code are the card's, above, and its
                tier is always standalone — so the capsule was a column with one
                fixed value repeated once per service, saying nothing a reader
                could act on. Each service is simply one delivered line, and the
                band below names it.
              */}
              {value.serviceIds.map((serviceId) => {
                const service = services.find((s) => s.id === serviceId)
                if (!service) return null

                return (
                  /* One tbody per service, so the rule falls between services
                     rather than between variations of the same one. */
                  <tbody key={serviceId}>
                    {/*
                      The service names itself across the table, not down a
                      column of its own.

                      It was the first column, and it was the widest — wide
                      enough to hold "Generated Images" over its category — on a
                      row whose remaining cells were mostly empty. A service is
                      not a property of these rows; it is what they are a list
                      of. Said once, as a band, it costs no column width and
                      groups its rows more plainly than a name in a cell ever
                      did.
                    */}
                    <tr>
                      <td
                        colSpan={value.forParent ? 1 : 2}
                        className="border-rule bg-wash/60 border-y px-2.5 py-2 first:pl-2.5"
                      >
                        {/* The allowance warning that used to sit here counted
                            rounds typed on this form. Rounds are added on the
                            delivery's record now, so there is nothing to warn
                            about while it is being logged. */}
                        <div className="flex items-baseline gap-2">
                          <span className="font-medium">{service.name}</span>
                          <span className="text-ink-faint text-micro">
                            {formatCategory(service.category)}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* A parent delivery is the band and nothing else: one line
                        per service, against the listing named above. There is
                        no product, no code and no tier left to fill in. */}
                    {/* Nothing under a band on either side of the toggle. A
                        parent delivery is one line against the listing; a
                        variation delivery is the SKUs named above, and each of
                        them already carries its own tier. The band IS the
                        delivered line. */}
                  </tbody>
                )
              })}
            </table>
          </div>
        )}
      </div>
      {/*
        Which product this is — below what shipped, not above it (owner,
        2026-09-01). The card now reads in the order the work is described: what
        was delivered, then what it was delivered for.

        It keeps the tint and becomes the card's foot, so the strip that names
        the thing still reads as one band rather than dissolving into the fields
        above it. What it is called follows the toggle, since a parent delivery
        names the product itself and a variation delivery names the SKU.
      */}
      <div className="border-rule bg-wash/50 rounded-b-xl border-t px-6 py-5">
        <div className="flex items-start gap-4">
          <div
            className={cn(
              'grid grow gap-4',
              /* A variation card carries a third field — its tier — so the
                 header is three columns wide on that side of the toggle. */
              value.forParent
                ? 'sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]'
                : 'sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto]',
            )}
          >
            {/*
              The header names whatever the toggle says this delivery is for.

              In a parent delivery they name the listing; in a variation
              delivery the card IS the variation (owner, 2026-09-01), so they
              name the SKU and the tier joins them. Either way the card holds
              one delivered thing and says which.
            */}
            <Field
              label={value.forParent ? 'Product ASIN' : 'Variation ASIN'}
              htmlFor={`${uid}-asin`}
              optional
              error={errors.code}
            >
              <AsinInput
                id={`${uid}-asin`}
                brandId={brandId}
                value={value.code}
                onChange={(code) => onChange({ ...value, code })}
                onPick={(asin) =>
                  onChange({
                    ...value,
                    code: asin.code,
                    productName: value.productName.trim() || (asin.productName ?? ''),
                  })
                }
                invalid={Boolean(errors.code)}
              />
            </Field>

            <Field
              label={value.forParent ? 'Product name' : 'Variation name'}
              htmlFor={`${uid}-product`}
              optional
              error={errors.productName}
            >
              <Input
                id={`${uid}-product`}
                value={value.productName}
                placeholder={
                  value.forParent ? 'What the product is called' : 'What this variation is called'
                }
                onChange={(e) => onChange({ ...value, productName: e.target.value })}
              />
            </Field>

            {/*
              The tier belongs to the variation, and on this side of the toggle
              the card IS the variation (owner, 2026-09-01) — so it is asked
              here, beside the name and code it describes, rather than in a list
              below repeating what the header already said.

              A parent line is always standalone (§2.4), so it is not asked at
              all on the other side.
            */}
            {!value.forParent && (
              <Field label="Complexity" htmlFor={`${uid}-tier`}>
                <div className="flex h-10 items-center">
                  <Segmented
                    name="Complexity"
                    options={TIERS}
                    clearable
                    value={value.complexity}
                    onChange={(c) => onChange({ ...value, complexity: c })}
                  />
                </div>
              </Field>
            )}
          </div>

          {removable && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove product ${index + 1}`}
              title="Remove this product"
              className="text-ink-faint hover:text-beyond hover:bg-paper mt-6 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-[120ms]"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        {/*
          Done closes the card. Not "save": the delivery is saved once, at the
          bottom of the form, and a card that offered its own Save would promise
          a ledger row this button does not write.
        */}
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onDone}
            className="border-rule hover:border-control hover:text-ink text-ink-muted rounded-full border px-3 py-1 text-micro transition-colors duration-[120ms]"
          >
            Done
          </button>
        </div>
      </div>

    </div>
  )
}


/** Column heading: stated once, in the table's own vocabulary. */
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="text-ink-muted px-1.5 pb-2.5 text-left text-micro font-medium tracking-[0.04em] whitespace-nowrap uppercase first:pl-0 last:pr-0"
    >
      {children}
    </th>
  )
}
