'use client'

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
  /** The ClickUp task for this listing, since a job is one task per ASIN. */
  clickupTaskId: string
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
    clickupTaskId: '',
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
  return (
    <div className="border-rule bg-surface shadow-card rounded-xl border p-4">
      <div className="mb-3 flex items-start gap-4">
        <div className="grid grow gap-4 sm:grid-cols-2">
          <Field
            label={`ASIN ${index + 1}`}
            htmlFor={`asin-${value.key}`}
            optional
            error={errors.code}
          >
            <AsinInput
              id={`asin-${value.key}`}
              brandId={brandId}
              value={value.code}
              onChange={(code) => onChange({ ...value, code })}
              invalid={Boolean(errors.code)}
            />
          </Field>

          {/* Paired with the code, because they identify the same thing from
              two directions: the listing, and the task that delivered it. */}
          <Field label="ClickUp task" htmlFor={`clickup-${value.key}`} optional>
            <Input
              id={`clickup-${value.key}`}
              value={value.clickupTaskId}
              placeholder="ID or URL"
              onChange={(e) => onChange({ ...value, clickupTaskId: e.target.value })}
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
        htmlFor={`services-${value.key}`}
        error={errors.serviceIds}
        hint="Each service picked here gets its own variations."
      >
        <MultiSelect
          id={`services-${value.key}`}
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
          <div key={serviceId} className={cn('mt-4', i > 0 && 'pt-4')}>
            <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2">
              <span className="text-dense font-medium">{service.name}</span>
              <span className="text-ink-faint text-micro">
                {formatCategory(service.category)}
              </span>
            </div>

            <VariationRows
              variations={value.variationsByService[serviceId] ?? []}
              onChange={(next) =>
                onChange({
                  ...value,
                  variationsByService: { ...value.variationsByService, [serviceId]: next },
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
          </div>
        )
      })}
    </div>
  )
}
