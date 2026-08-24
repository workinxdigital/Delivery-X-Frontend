'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BrandInput } from '@/components/brand-input'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { Band, Field } from '@/components/field'
import { Segmented } from '@/components/segmented'
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
import { todayInIST } from '@/lib/format'
import { cn } from '@/lib/utils'

const COMPLEXITIES: { value: Complexity; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'STANDALONE', label: 'Standalone' },
]

/** Above this we warn but still allow — a genuine bulk delivery is possible. */
const VARIATION_SOFT_LIMIT = 20

type FormState = {
  agencyId: string
  brandName: string
  serviceId: string
  complexity: Complexity | ''
  variationCount: string
  revisionCount: string
  deliveredOn: string
  deliveredById: string
  clickupTaskId: string
  notes: string
}

const EMPTY: FormState = {
  agencyId: '',
  brandName: '',
  serviceId: '',
  complexity: '',
  variationCount: '1',
  revisionCount: '0',
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
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: getServices })
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

  const serviceOptions: ComboboxOption[] = services.map((s) => ({
    value: s.id,
    label: s.name,
    group: s.isBundle ? 'Bundles' : s.category,
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
  const selectedService = services.find((s) => s.id === form.serviceId)

  // Only ask about duplicates once every identifying field is filled in.
  const duplicateKey =
    form.agencyId && form.brandName.trim() && form.serviceId && form.complexity
      ? {
          agencyId: form.agencyId,
          brandName: form.brandName.trim(),
          serviceId: form.serviceId,
          complexity: form.complexity,
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
      const t = result.task
      const rounds =
        t.revisionRoundCount > 0
          ? ` · ${t.revisionRoundCount} revision${t.revisionRoundCount === 1 ? '' : 's'}${
              t.roundsBeyondAllowance > 0 ? `, ${t.roundsBeyondAllowance} beyond allowance` : ''
            }`
          : ''
      toast(t.taskCode, {
        description: `${t.brandName} · ${t.serviceName}${result.brandCreated ? ' · new brand' : ''}${rounds}`,
      })
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
    if (!form.serviceId) next.serviceId = 'Pick a service'
    if (!form.complexity) next.complexity = 'Pick a complexity'
    const variations = Number(form.variationCount)
    if (!Number.isInteger(variations) || variations < 1) next.variationCount = 'At least 1'
    const revisions = Number(form.revisionCount)
    if (!Number.isInteger(revisions) || revisions < 0) next.revisionCount = '0 or more'
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
      serviceId: form.serviceId,
      complexity: form.complexity as Complexity,
      variationCount: Number(form.variationCount),
      revisionCount: Number(form.revisionCount),
      deliveredOn: form.deliveredOn,
      deliveredById: form.deliveredById,
      clickupTaskId: form.clickupTaskId.trim() || null,
      notes: form.notes.trim() || null,
    })
  }

  const variations = Number(form.variationCount)
  const revisions = Number(form.revisionCount)

  /**
   * Tells the PM what the number they just typed will mean, before they save.
   * The allowance comes from the selected agency, which is the value that gets
   * snapshotted onto the task (§2.6).
   */
  const revisionHint = (() => {
    if (!selectedAgency || !Number.isFinite(revisions) || revisions <= 0) {
      return variations > VARIATION_SOFT_LIMIT
        ? `${variations} variations is unusually high. Worth a check.`
        : undefined
    }
    const allowance = selectedAgency.freeRevisionAllowance
    const beyond = Math.max(0, revisions - allowance)
    const within = revisions - beyond
    return beyond > 0
      ? `${within} within the allowance of ${allowance}, ${beyond} beyond it.`
      : `All ${revisions} within the allowance of ${allowance}.`
  })()

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
          label="Service"
          htmlFor="service"
          error={errors.serviceId}
          hint={
            selectedService?.isBundle
              ? selectedService.components.map((c) => c.name).join(' + ')
              : undefined
          }
        >
          <Combobox
            id="service"
            options={serviceOptions}
            value={form.serviceId}
            invalid={Boolean(errors.serviceId)}
            placeholder="Select"
            searchPlaceholder="Search the catalogue"
            clearable={false}
            onChange={(v) => set('serviceId', v)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_6rem_6rem]">
          <Field label="Complexity" error={errors.complexity}>
            <Segmented
              name="Complexity"
              options={COMPLEXITIES}
              value={form.complexity}
              invalid={Boolean(errors.complexity)}
              onChange={(v) => set('complexity', v)}
            />
          </Field>

          <Field
            label="Variations"
            htmlFor="variations"
            error={errors.variationCount}
          >
            <Input
              id="variations"
              type="number"
              min={1}
              step={1}
              value={form.variationCount}
              aria-invalid={Boolean(errors.variationCount)}
              onChange={(e) => set('variationCount', e.target.value)}
            />
          </Field>

          {/*
            Replaces the old task title field. The number typed here becomes
            that many real revision_round records server-side, each classified
            against this agency's allowance, so the count stays reportable
            rather than being a second loose number on the task.
          */}
          <Field
            label="Revisions"
            htmlFor="revisions"
            error={errors.revisionCount}
          >
            <Input
              id="revisions"
              type="number"
              min={0}
              step={1}
              value={form.revisionCount}
              aria-invalid={Boolean(errors.revisionCount)}
              onChange={(e) => set('revisionCount', e.target.value)}
            />
          </Field>
        </div>

        {revisionHint && <p className="text-ink-muted text-micro">{revisionHint}</p>}

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
