'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BrandInput } from '@/components/brand-input'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { MultiSelect, type MultiOption } from '@/components/multi-select'
import { Band, Field } from '@/components/field'
import {
  VariationRows,
  emptyVariation,
  type VariationDraft,
} from '@/components/variation-rows'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  checkDuplicate,
  createTask,
  getAgencies,
  getServices,
  getUsers,
} from '@/lib/api/client'
import type { Complexity } from '@/lib/api/types'
import { todayInIST, formatCategory } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Above this we warn but still allow — a genuine bulk delivery is possible. */
const VARIATION_SOFT_LIMIT = 20

type FormState = {
  agencyId: string
  brandName: string
  /** Order matters: it becomes the order of the sections and the saved rows. */
  serviceIds: string[]
  /** Keyed by serviceId, so deselecting and reselecting does not lose the work. */
  variationsByService: Record<string, VariationDraft[]>
  deliveredOn: string
  deliveredById: string
  clickupTaskId: string
  notes: string
}

const EMPTY: FormState = {
  agencyId: '',
  brandName: '',
  serviceIds: [],
  variationsByService: {},
  deliveredOn: todayInIST(),
  deliveredById: '',
  clickupTaskId: '',
  notes: '',
}

export function LogDeliveryForm() {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [duplicateAck, setDuplicateAck] = useState(false)
  const firstFieldRef = useRef<HTMLButtonElement>(null)

  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: getAgencies })
  // Active only: a retired service should not be offered for a new delivery.
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => getServices(),
  })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  // Auth is deferred, so "delivered by" cannot default to the signed-in user.
  // Default to a PM instead, and say so in the field's helper line.
  useEffect(() => {
    if (form.deliveredById || users.length === 0) return
    const fallback = users.find((u) => u.role === 'PM') ?? users[0]
    if (fallback) setForm((f) => ({ ...f, deliveredById: fallback.id }))
  }, [users, form.deliveredById])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => (e[key] ? { ...e, [key]: '' } : e))
    setDuplicateAck(false)
  }

  const agencyOptions: ComboboxOption[] = agencies.map((a) => ({
    value: a.id,
    label: a.name,
    hint: `${a.type === 'AGENCY' ? 'Agency' : 'Direct'} · ${a.freeRevisionAllowance} free revision${a.freeRevisionAllowance === 1 ? '' : 's'}`,
  }))

  const serviceOptions: MultiOption[] = services.map((s) => ({
    value: s.id,
    label: s.name,
    group: s.isBundle ? 'Bundles' : formatCategory(s.category),
    // Bundle contents shown inline, as §5.1 requires.
    hint: s.isBundle ? s.components.map((c) => c.name).join(' + ') : undefined,
    keywords: s.code,
  }))

  const userOptions: ComboboxOption[] = users.map((u) => ({
    value: u.id,
    label: u.name,
    hint: u.role,
  }))

  const selectedAgency = agencies.find((a) => a.id === form.agencyId)

  // Only ask about duplicates once every identifying field is filled in.
  // Advisory only, so checking the first service is enough to catch the
  // accidental double-save this guards against (§5.1).
  const firstService = form.serviceIds[0]
  const duplicateKey =
    form.agencyId && form.brandName.trim() && firstService
      ? {
          agencyId: form.agencyId,
          brandName: form.brandName.trim(),
          serviceId: firstService,
          deliveredOn: form.deliveredOn,
        }
      : null

  const { data: duplicate } = useQuery({
    queryKey: ['duplicate-check', duplicateKey],
    queryFn: () => checkDuplicate(duplicateKey!),
    enabled: Boolean(duplicateKey),
    staleTime: 0,
  })

  const mutation = useMutation({
    mutationFn: createTask,
    onSuccess: (result) => {
      const rows = result.tasks
      // One submission can create several rows, so the toast names each one.
      const title =
        rows.length === 1
          ? rows[0]!.taskCode
          : `${rows.length} deliveries logged`
      const description = [
        rows[0]!.brandName,
        ...rows.map(
          (t) =>
            `${t.taskCode} ${t.serviceName}` +
            (t.revisionRoundCount > 0 ? ` (${t.revisionRoundCount} rev)` : ''),
        ),
        result.brandCreated ? 'new brand' : null,
      ]
        .filter(Boolean)
        .join(' · ')
      toast(title, { description })
      if (result.variationWarning) toast.warning(result.variationWarning)

      // Reset, but keep agency and brand: PMs log several for one brand in a
      // row, and retyping them is the main source of friction (§5.1).
      setForm((f) => ({
        ...EMPTY,
        agencyId: f.agencyId,
        brandName: f.brandName,
        deliveredById: f.deliveredById,
        deliveredOn: f.deliveredOn,
      }))
      setErrors({})
      setDuplicateAck(false)
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['brands'] })
      firstFieldRef.current?.focus()
    },
    onError: (error) => {
      if (error instanceof ApiError && error.issues.length > 0) {
        // The server is authoritative (§4.6), so its field errors win.
        setErrors(Object.fromEntries(error.issues.map((i) => [i.path, i.message])))
        toast.error('Check the highlighted fields')
        return
      }
      toast.error(error instanceof Error ? error.message : 'Could not save')
    },
  })

  /** Client-side checks are a convenience only; the API validates again (§4.6). */
  function validate(): boolean {
    const next: Record<string, string> = {}
    if (!form.agencyId) next.agencyId = 'Pick an agency'
    if (!form.brandName.trim()) next.brandName = 'Enter a brand'
    if (form.serviceIds.length === 0) next.serviceIds = 'Pick at least one service'
    for (const serviceId of form.serviceIds) {
      const rows = form.variationsByService[serviceId] ?? []
      rows.forEach((v, i) => {
        if (!v.complexity) next[`${serviceId}.variations.${i}.complexity`] = 'Pick one'
        const n = Number(v.revisionCount)
        if (!Number.isInteger(n) || n < 0)
          next[`${serviceId}.variations.${i}.revisionCount`] = '0 or more'
      })
    }
    if (!form.deliveredOn) next.deliveredOn = 'Pick a date'
    else if (form.deliveredOn > todayInIST()) next.deliveredOn = 'Cannot be in the future'
    if (!form.deliveredById) next.deliveredById = 'Pick who delivered it'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function submit() {
    if (!validate()) return
    if (duplicate && !duplicateAck) {
      setDuplicateAck(true)
      return
    }
    mutation.mutate({
      agencyId: form.agencyId,
      brandName: form.brandName.trim(),
      lines: form.serviceIds.map((serviceId) => ({
        serviceId,
        variations: (form.variationsByService[serviceId] ?? []).map((v) => ({
          complexity: v.complexity as Complexity,
          revisionCount: Number(v.revisionCount),
        })),
      })),
      deliveredOn: form.deliveredOn,
      deliveredById: form.deliveredById,
      clickupTaskId: form.clickupTaskId.trim() || null,
      notes: form.notes.trim() || null,
    })
  }


  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault()
          submit()
        }
      }}
      /* Bands separated by hairlines. A ledger is ruled, not boxed. */
      className="divide-rule divide-y"
    >
      <Band title="Who it is for" className="pb-7">
        <Field label="Agency or direct client" htmlFor="agency" error={errors.agencyId}>
          <Combobox
            id="agency"
            triggerRef={firstFieldRef}
            options={agencyOptions}
            value={form.agencyId}
            invalid={Boolean(errors.agencyId)}
            placeholder="Select"
            searchPlaceholder="Search agencies"
            clearable={false}
            onChange={(v) => {
              // Brands are scoped to an agency, so changing it clears the brand (§2.7).
              setForm((f) => ({ ...f, agencyId: v, brandName: '' }))
              setErrors((e) => ({ ...e, agencyId: '', brandName: '' }))
            }}
          />
        </Field>

        <Field
          label="Brand"
          htmlFor="brand"
          error={errors.brandName}
          hint={
            selectedAgency
              ? `${selectedAgency.freeRevisionAllowance} free revision${selectedAgency.freeRevisionAllowance === 1 ? '' : 's'} on this contract.`
              : undefined
          }
        >
          <BrandInput
            id="brand"
            agencyId={form.agencyId}
            value={form.brandName}
            onChange={(v) => set('brandName', v)}
            invalid={Boolean(errors.brandName)}
          />
        </Field>
      </Band>

      <Band title="What shipped" className="py-7">
        <Field
          label="Services"
          htmlFor="services"
          error={errors.serviceIds}
          hint="Pick every service this job covered. Each one gets its own variations below."
        >
          <MultiSelect
            id="services"
            options={serviceOptions}
            values={form.serviceIds}
            invalid={Boolean(errors.serviceIds)}
            placeholder="Select one or more services"
            searchPlaceholder="Search the catalogue"
            onChange={(next) => {
              setForm((f) => ({
                ...f,
                serviceIds: next,
                // A newly picked service starts with one variation. Existing
                // sections are kept as they are, keyed by service, so
                // deselecting and reselecting does not throw away the work.
                variationsByService: Object.fromEntries(
                  next.map((id) => [
                    id,
                    f.variationsByService[id] ?? [emptyVariation()],
                  ]),
                ),
              }))
              setErrors({})
              setDuplicateAck(false)
            }}
          />
        </Field>

        {/*
          One section per selected service. This is the whole point of the
          multi-select: a client taking Basic A+ and Listing Images needs
          different complexity and different revision counts for each.
        */}
        {form.serviceIds.map((serviceId, index) => {
          const service = services.find((s) => s.id === serviceId)
          if (!service) return null
          const rows = form.variationsByService[serviceId] ?? []

          return (
            <div
              key={serviceId}
              className={cn(
                'border-rule pt-4',
                // A rule between sections, but not above the first one: the
                // field above it already provides the separation.
                index > 0 && 'border-t',
              )}
            >
              <div className="mb-2 flex flex-wrap items-baseline gap-x-2">
                <span className="text-dense font-medium">{service.name}</span>
                {service.isBundle && (
                  <span className="border-rule text-ink-muted rounded-sm border px-1 text-micro">
                    bundle
                  </span>
                )}
                {service.isBundle && (
                  <span className="text-ink-muted text-micro">
                    {service.components.map((c) => c.name).join(' + ')}
                  </span>
                )}
              </div>

              <VariationRows
                variations={rows}
                onChange={(next) => {
                  setForm((f) => ({
                    ...f,
                    variationsByService: { ...f.variationsByService, [serviceId]: next },
                  }))
                  setErrors({})
                  setDuplicateAck(false)
                }}
                allowance={selectedAgency?.freeRevisionAllowance}
                // Errors are namespaced per service, so two sections cannot
                // light each other's fields up.
                errors={Object.fromEntries(
                  Object.entries(errors)
                    .filter(([k]) => k.startsWith(`${serviceId}.`))
                    .map(([k, v]) => [k.slice(serviceId.length + 1), v]),
                )}
              />
            </div>
          )
        })}

        {form.serviceIds.length > 1 && (
          <p className="text-ink-muted text-micro">
            Saving creates {form.serviceIds.length} ledger rows, one per service, linked as
            one delivery. That keeps the delivered count and the service mix exact.
          </p>
        )}
      </Band>

      <Band title="When and who" className="py-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Delivered on" htmlFor="deliveredOn" error={errors.deliveredOn}>
            <Input
              id="deliveredOn"
              type="date"
              max={todayInIST()}
              value={form.deliveredOn}
              aria-invalid={Boolean(errors.deliveredOn)}
              onChange={(e) => set('deliveredOn', e.target.value)}
            />
          </Field>

          <Field
            label="Delivered by"
            htmlFor="deliveredBy"
            error={errors.deliveredById}
            hint="Defaults to a PM until sign-in exists."
          >
            <Combobox
              id="deliveredBy"
              options={userOptions}
              value={form.deliveredById}
              invalid={Boolean(errors.deliveredById)}
              placeholder="Select"
              searchPlaceholder="Search people"
              clearable={false}
              onChange={(v) => set('deliveredById', v)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ClickUp task" htmlFor="clickup" optional>
            <Input
              id="clickup"
              value={form.clickupTaskId}
              placeholder="ID or URL"
              onChange={(e) => set('clickupTaskId', e.target.value)}
            />
          </Field>

          <Field label="Notes" htmlFor="notes" optional>
            <Input
              id="notes"
              value={form.notes}
              placeholder="Anything worth recording"
              onChange={(e) => set('notes', e.target.value)}
            />
          </Field>
        </div>
      </Band>

      {/*
        Sticky action bar: the save button is never below the fold, which is the
        difference between a 20-second entry and a 40-second one.
      */}
      {/* Solid, not translucent: a blurred bar over a scrolling form reads as
          mush, and this one has to stay legible while fields pass under it. */}
      <div className="border-rule bg-paper sticky bottom-0 -mx-6 border-t px-6 py-4">
        {duplicate && (
          <div
            className={cn(
              'mb-3 rounded-md px-3 py-2 text-dense',
              // The only chromatic colour in the product means "beyond
              // allowance", so a duplicate warning must not borrow it. Neutral
              // wash with a rule instead.
              'border-rule-strong bg-wash border',
            )}
          >
            <span className="code">{duplicate.taskCode}</span>{' '}
            <span className="text-ink-muted">
              matches this exactly and was logged minutes ago.
              {duplicateAck
                ? ' Press save again to log it anyway.'
                : ' Saving is allowed; genuine duplicates happen.'}
            </span>
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="bg-ink text-primary-foreground text-dense hover:bg-ink/90 rounded-md px-4 py-2 font-medium transition-colors duration-[120ms] disabled:opacity-50"
          >
            {mutation.isPending
              ? 'Saving'
              : duplicateAck
                ? 'Save anyway'
                : 'Save delivery'}
          </button>

          <p className="text-ink-faint text-micro">
            <kbd className="text-ink-muted font-sans">⌘</kbd>
            <kbd className="text-ink-muted font-sans">↵</kbd> to save. Agency and brand
            are kept for the next entry.
          </p>
        </div>
      </div>
    </form>
  )
}
