'use client'

import { Plus, X } from 'lucide-react'
import { useId } from 'react'
import { AsinInput } from '@/components/asin-input'
import { Field } from '@/components/field'
import { MultiSelect, type MultiOption } from '@/components/multi-select'
import { Segmented } from '@/components/segmented'
import { Input } from '@/components/ui/input'
import { emptyVariation, type VariationDraft } from '@/components/variation-rows'
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
  /** The ClickUp task per service, keyed by serviceId. */
  clickupByService: Record<string, string>
  serviceIds: string[]
  /** Keyed by serviceId so deselecting and reselecting keeps the work. */
  variationsByService: Record<string, VariationDraft[]>
}

let seq = 0
export function emptyAsin(): AsinDraft {
  seq += 1
  return {
    key: `asin-${seq}`,
    code: '',
    productName: '',
    clickupByService: {},
    serviceIds: [],
    variationsByService: {},
  }
}

const TIERS: { value: Complexity; label: string }[] = (
  ['LOW', 'MEDIUM', 'HIGH', 'STANDALONE'] as Complexity[]
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
const CELL = 'px-2 py-2 align-top first:pl-0 last:pr-0'

/**
 * One product listing and everything shipped for it.
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
  allowance,
  errors,
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
  allowance?: number
  errors: Record<string, string>
  onRemove: () => void
  removable: boolean
}) {
  /**
   * Stable ids for the labels. Built from the draft key these differed between
   * server and client — the key comes from a module counter — so every load
   * logged a hydration mismatch. useId is identical on both sides.
   */
  const uid = useId()

  const setVariations = (serviceId: string, next: VariationDraft[]) =>
    onChange({
      ...value,
      variationsByService: { ...value.variationsByService, [serviceId]: next },
    })

  return (
    <div className="border-rule bg-surface shadow-card overflow-hidden rounded-xl border">
      {/*
        Header: which product this is. Tinted and ruled off, so the card reads as
        "this listing", then "what shipped for it".
      */}
      <div className="border-rule bg-wash/50 border-b px-4 py-3.5">
        <div className="flex items-start gap-4">
          <div className="grid grow gap-3 sm:grid-cols-[minmax(0,13rem)_minmax(0,1fr)]">
            <Field
              label={`ASIN ${index + 1}`}
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
              label="Product name"
              htmlFor={`${uid}-product`}
              optional
              error={errors.productName}
            >
              <Input
                id={`${uid}-product`}
                value={value.productName}
                placeholder="What the product is called"
                onChange={(e) => onChange({ ...value, productName: e.target.value })}
              />
            </Field>
          </div>

          {removable && (
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Remove ASIN ${index + 1}`}
              title="Remove this ASIN"
              className="text-ink-faint hover:text-beyond hover:bg-paper mt-6 flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-[120ms]"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-3.5">
        <Field
          label="What shipped"
          htmlFor={`${uid}-services`}
          error={errors.serviceIds}
          hint={
            value.serviceIds.length === 0
              ? 'Each service picked here gets its own row below.'
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
                variationsByService: Object.fromEntries(
                  next.map((id) => [id, value.variationsByService[id] ?? [emptyVariation()]]),
                ),
              })
            }
          />
        </Field>

        {value.serviceIds.length > 0 && (
          /* Scrolls rather than squeezes: below a certain width a segmented
             control and two inputs stop being usable, and a table that shrinks
             them to fit is worse than one you nudge sideways. */
          <div className="-mx-2 mt-4 overflow-x-auto px-2">
            <table className="w-full min-w-[40rem] border-collapse text-dense">
              <thead>
                <tr className="border-rule border-b">
                  <Th>Service</Th>
                  <Th>Complexity</Th>
                  <Th>Revisions</Th>
                  <Th>ClickUp task</Th>
                  <th className="w-9" />
                </tr>
              </thead>

              {value.serviceIds.map((serviceId) => {
                const service = services.find((s) => s.id === serviceId)
                if (!service) return null

                const variations = value.variationsByService[serviceId] ?? []
                const scoped = Object.fromEntries(
                  Object.entries(errors)
                    .filter(([k]) => k.startsWith(`${serviceId}.`))
                    .map(([k, v]) => [k.slice(serviceId.length + 1), v]),
                )

                const beyond =
                  allowance === undefined
                    ? 0
                    : variations.reduce((sum, v) => {
                        const n = Number(v.revisionCount)
                        return sum + Math.max(0, (Number.isFinite(n) ? n : 0) - allowance)
                      }, 0)

                return (
                  /* One tbody per service, so the rule falls between services
                     rather than between variations of the same one. */
                  <tbody key={serviceId} className="border-rule border-b last:border-0">
                    {variations.map((variation, i) => (
                      <tr key={i}>
                        <td className={cn(CELL, 'min-w-0')}>
                          {/*
                            The service names itself once. Further variations say
                            which number they are, indented, so the eye reads one
                            service with two variations rather than two services.
                          */}
                          {i === 0 ? (
                            <div className="pt-1.5">
                              <div className="font-medium">{service.name}</div>
                              <div className="text-ink-faint text-micro">
                                {formatCategory(service.category)}
                              </div>
                            </div>
                          ) : (
                            <div className="text-ink-faint pt-2.5 pl-3 text-micro">
                              Variation {i + 1}
                            </div>
                          )}
                        </td>

                        <td className={CELL}>
                          <Segmented
                            name={`Complexity for ${service.name}, variation ${i + 1}`}
                            options={TIERS}
                            value={variation.complexity}
                            invalid={Boolean(scoped[`variations.${i}.complexity`])}
                            onChange={(c) =>
                              setVariations(
                                serviceId,
                                variations.map((v, j) => (j === i ? { ...v, complexity: c } : v)),
                              )
                            }
                          />
                          {scoped[`variations.${i}.complexity`] && (
                            <p className="text-danger mt-1 text-micro">
                              {scoped[`variations.${i}.complexity`]}
                            </p>
                          )}
                        </td>

                        <td className={CELL}>
                          <Input
                            type="number"
                            min={0}
                            step={1}
                            className="h-9 w-[4.5rem] tabular"
                            aria-label={`Revisions for ${service.name}, variation ${i + 1}`}
                            value={variation.revisionCount}
                            aria-invalid={Boolean(scoped[`variations.${i}.revisionCount`])}
                            onChange={(e) =>
                              setVariations(
                                serviceId,
                                variations.map((v, j) =>
                                  j === i ? { ...v, revisionCount: e.target.value } : v,
                                ),
                              )
                            }
                          />
                        </td>

                        {/*
                          One ClickUp task per service, so it sits on the
                          service's own row and the variation rows leave the
                          column empty rather than repeating it.
                        */}
                        <td className={CELL}>
                          {i === 0 && (
                            <Input
                              id={`${uid}-clickup-${serviceId}`}
                              aria-label={`ClickUp task for ${service.name}`}
                              value={value.clickupByService[serviceId] ?? ''}
                              placeholder="ID or URL"
                              className="h-9 text-micro"
                              onChange={(e) =>
                                onChange({
                                  ...value,
                                  clickupByService: {
                                    ...value.clickupByService,
                                    [serviceId]: e.target.value,
                                  },
                                })
                              }
                            />
                          )}
                        </td>

                        <td className={cn(CELL, 'w-9')}>
                          {/* Only removable once there is more than one to tell apart. */}
                          {variations.length > 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setVariations(
                                  serviceId,
                                  variations.filter((_, j) => j !== i),
                                )
                              }
                              aria-label={`Remove variation ${i + 1} of ${service.name}`}
                              className="text-ink-faint hover:text-beyond flex size-9 items-center justify-center rounded-md transition-colors duration-[120ms]"
                            >
                              <X className="size-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* The action sits under the service it belongs to. */}
                    <tr>
                      <td />
                      <td className={cn(CELL, 'pt-0 pb-3')} colSpan={4}>
                        <div className="flex flex-wrap items-baseline gap-x-3">
                          <button
                            type="button"
                            onClick={() =>
                              setVariations(serviceId, [...variations, emptyVariation()])
                            }
                            className="text-ink-muted hover:text-ink flex items-center gap-1 text-micro transition-colors duration-[120ms]"
                          >
                            <Plus className="size-3" />
                            Add variation
                          </button>

                          {/*
                            Only once the allowance has been passed. It used to
                            state the totals and two zeros on every service,
                            restating the number just typed.
                          */}
                          {beyond > 0 && (
                            <span className="text-beyond text-micro">
                              {beyond} round{beyond === 1 ? '' : 's'} beyond allowance
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  </tbody>
                )
              })}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


/** Column heading: stated once, in the table's own vocabulary. */
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="text-ink-muted px-2 pb-1.5 text-left text-micro font-medium tracking-[0.04em] whitespace-nowrap uppercase first:pl-0"
    >
      {children}
    </th>
  )
}
