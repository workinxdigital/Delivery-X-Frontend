'use client'

import { useId } from 'react'

import { AsinInput } from '@/components/asin-input'
import { Field } from '@/components/field'
import { MultiSelect, type MultiOption } from '@/components/multi-select'
import { Input } from '@/components/ui/input'
import { VariationRows, emptyVariation, type VariationDraft } from '@/components/variation-rows'
import type { Service } from '@/lib/api/types'
import { formatCategory } from '@/lib/format'
import { cn } from '@/lib/utils'

export type AsinDraft = {
  /** Stable local id, so React keys survive reordering and removal. */
  key: string
  /** Optional: a PM without the code to hand still needs to log the work. */
  code: string
  /** What the product is called. How anyone actually recognises the listing. */
  productName: string
  /**
   * The ClickUp task per service, keyed by serviceId.
   *
   * A listing that gets A+ content and a video is two pieces of work tracked as
   * two tasks, so one id on the ASIN pointed both rows at whichever was typed.
   */
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

/**
 * One product listing and everything shipped for it.
 *
 * A job usually covers several ASINs, and what shipped differs per ASIN — one
 * product gets Basic A+ and a video, the next just Listing Images. So each ASIN
 * carries its own service selection and its own variations rather than the job
 * carrying one list for all of them.
 *
 * The code is optional by design. Blocking a save because a PM does not have
 * the ASIN to hand would make the form slower than the spreadsheet it replaces,
 * and the delivery is the fact worth keeping — the code is an attribute of it.
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
   * Stable ids for the labels.
   *
   * These were built from the draft's `key`, which comes from a module-level
   * counter — so the server rendered "asin-1" and the browser "asin-2", and
   * every load of this form logged a hydration mismatch. useId gives the same
   * value on both sides. The `key` stays what it is for: React list identity,
   * never rendered into the DOM.
   */
  const uid = useId()

  return (
    <div className="border-rule bg-surface shadow-card rounded-xl border p-4">
      <div className="mb-3 flex items-start gap-4">
        <div className="grid grow gap-4 sm:grid-cols-2">
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
              /*
               * Picking a listing you have used before brings its name with it.
               * An empty field is only filled in, never overwritten — someone
               * who has already typed a name meant that name.
               */
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

          {/*
            The name reads first for a human and the code is the identifier, so
            they sit together: what it is, and which one it is.
          */}
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
            className="text-ink-muted hover:text-ink text-micro mt-6 shrink-0 transition-colors duration-[120ms]"
          >
            Remove
          </button>
        )}
      </div>

      <Field
        label="What shipped"
        htmlFor={`${uid}-services`}
        error={errors.serviceIds}
        hint="Each service picked here gets its own variations."
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

      {value.serviceIds.map((serviceId, i) => {
        const service = services.find((s) => s.id === serviceId)
        if (!service) return null

        return (
          /*
           * One row per service, on a two-column grid: what was delivered, then
           * how it was made.
           *
           * Everything used to start at a different x — the service name at the
           * card edge, the labels indented, the add link somewhere else again,
           * and the ClickUp box floated hard right where it was the loudest
           * thing in the block despite being the least important field in it.
           *
           * The grid fixes the ragged edge and puts the fields in order of
           * weight: the service identifies the row, the complexity and revision
           * count are the record, and the ClickUp id is a pointer to somewhere
           * else — so it sits last, quiet, and only draws a border when you
           * reach for it.
           */
          <div
            key={serviceId}
            className={cn(
              'grid gap-x-5 gap-y-2 pt-3.5 sm:grid-cols-[10rem_minmax(0,1fr)]',
              i > 0 ? 'border-rule mt-3.5 border-t' : 'mt-1',
            )}
          >
            <div className="sm:pt-0.5">
              <div className="text-dense font-medium">{service.name}</div>
              <div className="text-ink-faint text-micro">
                {formatCategory(service.category)}
              </div>
            </div>

            <div>
              <VariationRows
                variations={value.variationsByService[serviceId] ?? []}
                // Stated once per ASIN, above the first service only.
                showLabels={i === 0}
                onChange={(next) =>
                  onChange({
                    ...value,
                    variationsByService: {
                      ...value.variationsByService,
                      [serviceId]: next,
                    },
                  })
                }
                allowance={allowance}
                // Namespaced per service so two sections cannot light each
                // other's fields up.
                errors={Object.fromEntries(
                  Object.entries(errors)
                    .filter(([k]) => k.startsWith(`${serviceId}.`))
                    .map(([k, v]) => [k.slice(serviceId.length + 1), v]),
                )}
              />

              {/*
                Indented to 2rem: the variation grid reserves a 1.25rem number
                track plus a 0.75rem gap before its content, so the segmented
                control, the add link and this all start at the same x. Without
                it this row sat 24px to their left, which is most of what read as
                "everything is here and there".
              */}
              <div className="mt-1.5 flex items-baseline gap-2 pl-8">
                <label
                  htmlFor={`${uid}-clickup-${serviceId}`}
                  className="text-ink-faint shrink-0 text-micro"
                >
                  ClickUp
                </label>
                {/*
                  Borderless until hovered or focused. It is optional, usually
                  empty, and a full bordered field for it competed with the
                  controls that actually carry the record.
                */}
                <input
                  id={`${uid}-clickup-${serviceId}`}
                  value={value.clickupByService[serviceId] ?? ''}
                  placeholder="task ID or URL"
                  className="text-ink placeholder:text-ink-faint hover:border-control focus:border-control w-full max-w-[20rem] border-b border-transparent bg-transparent pb-0.5 text-micro transition-colors duration-[120ms] outline-none"
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
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
