'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BrandInput } from '@/components/brand-input'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { DelivererInput } from '@/components/deliverer-input'
import type { MultiOption } from '@/components/multi-select'
import { AsinSection, emptyAsin, type AsinDraft } from '@/components/asin-section'
import { Band, Field } from '@/components/field'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  checkDuplicate,
  createTask,
  getAgencies,
  getBrands,
  getServices,
} from '@/lib/api/client'
import type { Complexity } from '@/lib/api/types'
import { todayInIST, formatCategory } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PrimaryButton } from '@/components/primary-button'

type FormState = {
  agencyId: string
  brandName: string
  /**
   * One entry per product listing. Order matters: it becomes the order of the
   * sections on screen and of the rows written to the ledger.
   */
  asins: AsinDraft[]
  deliveredOn: string
  deliveredByName: string
  notes: string
}

const EMPTY: FormState = {
  agencyId: '',
  brandName: '',
  asins: [emptyAsin()],
  deliveredOn: todayInIST(),
  deliveredByName: '',
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

  const selectedAgency = agencies.find((a) => a.id === form.agencyId)

  /**
   * A DIRECT client is its own brand.
   *
   * That is the whole distinction between the two kinds: an AGENCY brings us
   * work for other people's brands, a DIRECT client IS the brand. So the field
   * is filled from the agency and locked rather than asking someone to retype
   * the name they just chose — and the server takes the name from the agency
   * regardless of what this form sends (§4.6).
   */
  const isDirect = selectedAgency?.type === 'DIRECT'
  const brandName = isDirect ? (selectedAgency?.name ?? '') : form.brandName

  /** One ledger row per service per ASIN, which is what the note below reports. */
  const rowCount = form.asins.reduce((n, a) => n + a.serviceIds.length, 0)

  /**
   * The brand's id, when the typed name is one that already exists.
   *
   * ASIN suggestions are scoped to a brand, and the form only has the name a PM
   * is typing. A brand being entered for the first time has no id and no ASINs
   * yet, which is why this is allowed to be null rather than blocking anything.
   */
  const { data: brandMatches = [] } = useQuery({
    queryKey: ['brands', form.agencyId, brandName.trim()],
    queryFn: () => getBrands(form.agencyId, brandName.trim()),
    enabled: Boolean(form.agencyId && brandName.trim()),
  })
  const typedBrand = brandName.trim().toLowerCase()
  const brandId =
    brandMatches.find((b) => b.name.trim().toLowerCase() === typedBrand)?.id ?? null

  // Only ask about duplicates once every identifying field is filled in.
  // Advisory only, so checking the first service is enough to catch the
  // accidental double-save this guards against (§5.1).
  const firstService = form.asins[0]?.serviceIds[0]
  const duplicateKey =
    form.agencyId && brandName.trim() && firstService
      ? {
          agencyId: form.agencyId,
          brandName: brandName.trim(),
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
        deliveredByName: f.deliveredByName,
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
    // A direct client's name comes from the agency, so there is nothing to check.
    if (!isDirect && !form.brandName.trim()) next.brandName = 'Enter a brand'
    // Errors are namespaced by ASIN index, so one section cannot light up
    // another section's fields.
    form.asins.forEach((asin, ai) => {
      if (asin.serviceIds.length === 0) {
        next[`a${ai}.serviceIds`] = 'Pick at least one service'
      }
      for (const serviceId of asin.serviceIds) {
        const rows = asin.variationsByService[serviceId] ?? []
        rows.forEach((v, i) => {
          if (!v.complexity) next[`a${ai}.${serviceId}.variations.${i}.complexity`] = 'Pick one'
          const n = Number(v.revisionCount)
          if (!Number.isInteger(n) || n < 0)
            next[`a${ai}.${serviceId}.variations.${i}.revisionCount`] = '0 or more'
        })
      }
    })
    if (!form.deliveredOn) next.deliveredOn = 'Pick a date'
    else if (form.deliveredOn > todayInIST()) next.deliveredOn = 'Cannot be in the future'
    if (!form.deliveredByName.trim()) next.deliveredByName = 'Enter who delivered it'
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
      brandName: brandName.trim(),
      asins: form.asins.map((asin) => ({
        code: asin.code.trim() || null,
        productName: asin.productName.trim() || null,
        lines: asin.serviceIds.map((serviceId) => ({
          serviceId,
          clickupTaskId: asin.clickupByService[serviceId]?.trim() || null,
          variations: (asin.variationsByService[serviceId] ?? []).map((v) => ({
            complexity: v.complexity as Complexity,
            revisionCount: Number(v.revisionCount),
          })),
        })),
      })),
      deliveredOn: form.deliveredOn,
      deliveredByName: form.deliveredByName.trim(),
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
            isDirect
              ? 'A direct client is its own brand, so this comes from the agency.'
              : selectedAgency
                ? `${selectedAgency.freeRevisionAllowance} free revision${selectedAgency.freeRevisionAllowance === 1 ? '' : 's'} on this contract.`
                : undefined
          }
        >
          {isDirect ? (
            /*
             * Read-only rather than a disabled input: a disabled field looks
             * broken and is skipped by the keyboard, when the honest message is
             * "this is already decided". The value is still visible, which
             * matters — it is what gets recorded.
             */
            <div className="border-control bg-wash text-ink-muted flex h-10 items-center rounded-lg border px-3 text-dense">
              {brandName}
            </div>
          ) : (
            <BrandInput
              id="brand"
              agencyId={form.agencyId}
              value={form.brandName}
              onChange={(v) => set('brandName', v)}
              invalid={Boolean(errors.brandName)}
            />
          )}
        </Field>
      </Band>

      <Band title="Products" className="py-7">
        <Field
          label="Number of ASINs"
          htmlFor="asinCount"
          hint="How many product listings this job covered. Each one gets its own services and variations."
        >
          <Input
            id="asinCount"
            type="number"
            min={1}
            max={50}
            className="w-24"
            value={form.asins.length}
            onChange={(e) => {
              const wanted = Math.max(1, Math.min(50, Number(e.target.value) || 1))
              setForm((f) => {
                if (wanted === f.asins.length) return f
                // Growing adds empty sections; shrinking drops from the end,
                // so the work already entered in earlier sections survives.
                const asins =
                  wanted > f.asins.length
                    ? [
                        ...f.asins,
                        ...Array.from({ length: wanted - f.asins.length }, () => emptyAsin()),
                      ]
                    : f.asins.slice(0, wanted)
                return { ...f, asins }
              })
              setErrors({})
              setDuplicateAck(false)
            }}
          />
        </Field>

        <div className="space-y-4">
          {form.asins.map((asin, index) => (
            <AsinSection
              key={asin.key}
              index={index}
              value={asin}
              services={services}
              serviceOptions={serviceOptions}
              brandId={brandId}
              allowance={selectedAgency?.freeRevisionAllowance}
              removable={form.asins.length > 1}
              onRemove={() => {
                setForm((f) => ({ ...f, asins: f.asins.filter((a) => a.key !== asin.key) }))
                setErrors({})
                setDuplicateAck(false)
              }}
              onChange={(next) => {
                setForm((f) => ({
                  ...f,
                  asins: f.asins.map((a) => (a.key === asin.key ? next : a)),
                }))
                setErrors({})
                setDuplicateAck(false)
              }}
              errors={Object.fromEntries(
                Object.entries(errors)
                  .filter(([k]) => k.startsWith(`a${index}.`))
                  .map(([k, v]) => [k.slice(`a${index}.`.length), v]),
              )}
            />
          ))}
        </div>

        {rowCount > 1 && (
          <p className="text-ink-muted text-micro">
            Saving creates {rowCount} ledger rows — one per service per ASIN — linked as one
            delivery. That is what keeps the delivered count and the service mix exact.
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
            error={errors.deliveredByName}
            hint="Type a name that is not listed to add them to the team."
          >
            <DelivererInput
              id="deliveredBy"
              value={form.deliveredByName}
              invalid={Boolean(errors.deliveredByName)}
              onChange={(v) => set('deliveredByName', v)}
            />
          </Field>
        </div>

        <Field label="Notes" htmlFor="notes" optional>
          <Input
            id="notes"
            value={form.notes}
            placeholder="Anything worth recording about this delivery"
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
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
          <PrimaryButton
            type="submit"
            size="md"
            pending={mutation.isPending}
            pendingLabel="Saving"
          >
            {duplicateAck ? 'Save anyway' : 'Save delivery'}
          </PrimaryButton>

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
