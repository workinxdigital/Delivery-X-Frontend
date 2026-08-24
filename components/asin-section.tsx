'use client'

import { useQuery } from '@tanstack/react-query'
import { Field } from '@/components/field'
import { MultiSelect, type MultiOption } from '@/components/multi-select'
import { Input } from '@/components/ui/input'
import { VariationRows, emptyVariation, type VariationDraft } from '@/components/variation-rows'
import { getAsins } from '@/lib/api/client'
import type { Service } from '@/lib/api/types'
import { formatCategory } from '@/lib/format'
import { cn } from '@/lib/utils'

export type AsinDraft = {
  /** Stable local id, so React keys survive reordering and removal. */
  key: string
  /** Optional: a PM without the code to hand still needs to log the work. */
  code: string
  serviceIds: string[]
  /** Keyed by serviceId so deselecting and reselecting keeps the work. */
  variationsByService: Record<string, VariationDraft[]>
}

let seq = 0
export function emptyAsin(): AsinDraft {
  seq += 1
  return { key: `asin-${seq}`, code: '', serviceIds: [], variationsByService: {} }
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
  // Codes already used for this brand. Only possible once the brand exists; a
  // brand being typed for the first time has none, which is correct.
  const { data: known = [] } = useQuery({
    queryKey: ['asins', brandId],
    queryFn: () => getAsins(brandId!),
    enabled: Boolean(brandId),
  })

  const listId = `asin-codes-${value.key}`

  return (
    <div className="border-rule rounded-lg border p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div className="grow">
          <Field
            label={`ASIN ${index + 1}`}
            htmlFor={`asin-${value.key}`}
            optional
            error={errors.code}
            hint={
              known.length > 0
                ? `${known.length} code${known.length === 1 ? '' : 's'} used before for this brand.`
                : undefined
            }
          >
            <Input
              id={`asin-${value.key}`}
              list={known.length > 0 ? listId : undefined}
              value={value.code}
              placeholder="B0…"
              // Uppercased on the way in, since that is how Amazon prints them
              // and it makes two spellings of one code look like one code here
              // as well as in the database.
              onChange={(e) => onChange({ ...value, code: e.target.value.toUpperCase() })}
            />
            {known.length > 0 && (
              <datalist id={listId}>
                {known.map((a) => (
                  <option key={a.id} value={a.code}>
                    {a.taskCount > 0
                      ? `${a.taskCount} deliver${a.taskCount === 1 ? 'y' : 'ies'} so far`
                      : ''}
                  </option>
                ))}
              </datalist>
            )}
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
