'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { BrandInput } from '@/components/brand-input'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  title: string
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
  title: '',
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
  const titleRef = useRef<HTMLInputElement>(null)

  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: getAgencies })
  const { data: services = [] } = useQuery({ queryKey: ['services'], queryFn: getServices })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  // Auth is deferred, so "delivered by" cannot default to the signed-in user.
  // Default to the first PM instead, and say so in the field's help text.
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

  // Only ask about duplicates once every identifying field is filled in.
  const duplicateKey =
    form.agencyId && form.brandName.trim() && form.serviceId && form.complexity && form.deliveredOn
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
      toast.success(`Logged ${result.task.taskCode}`, {
        description: [
          `${result.task.brandName} · ${result.task.serviceName}`,
          result.brandCreated ? 'New brand created.' : null,
          result.variationWarning,
        ]
          .filter(Boolean)
          .join(' — '),
      })

      // Reset, but keep agency and brand: PMs log several for one brand in a
      // row, and retyping them every time is the main source of friction (§5.1).
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
      titleRef.current?.focus()
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
    if (!Number.isInteger(variations) || variations < 1) {
      next.variationCount = 'At least 1'
    }
    if (!form.title.trim()) next.title = 'Give the task a title'
    if (!form.deliveredOn) next.deliveredOn = 'Pick a date'
    if (form.deliveredOn > todayInIST()) next.deliveredOn = 'Cannot be in the future'
    if (!form.deliveredById) next.deliveredById = 'Pick who delivered it'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function submit() {
    if (!validate()) return
    if (duplicate && !duplicateAck) {
      setDuplicateAck(true)
      toast.warning('Looks like a duplicate', {
        description: `${duplicate.taskCode} matches this. Press Save again to log it anyway.`,
      })
      return
    }
    mutation.mutate({
      agencyId: form.agencyId,
      brandName: form.brandName.trim(),
      serviceId: form.serviceId,
      complexity: form.complexity as Complexity,
      variationCount: Number(form.variationCount),
      title: form.title.trim(),
      deliveredOn: form.deliveredOn,
      deliveredById: form.deliveredById,
      clickupTaskId: form.clickupTaskId.trim() || null,
      notes: form.notes.trim() || null,
    })
  }

  const variations = Number(form.variationCount)
  const variationWarning =
    Number.isFinite(variations) && variations > VARIATION_SOFT_LIMIT
      ? `${variations} variations is unusually high — worth a check.`
      : null

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      onKeyDown={(e) => {
        // Cmd/Ctrl+Enter saves from anywhere in the form.
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
          e.preventDefault()
          submit()
        }
      }}
      className="space-y-5"
    >
      <Field label="Agency / Client" htmlFor="agency" error={errors.agencyId}>
        <Combobox
          id="agency"
          options={agencyOptions}
          value={form.agencyId}
          invalid={Boolean(errors.agencyId)}
          placeholder="Select an agency or direct client"
          searchPlaceholder="Search agencies…"
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
            ? 'Type freely — a new brand is created on save if it does not exist.'
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

      <Field label="Service" htmlFor="service" error={errors.serviceId}>
        <Combobox
          id="service"
          options={serviceOptions}
          value={form.serviceId}
          invalid={Boolean(errors.serviceId)}
          placeholder="Select a service"
          searchPlaceholder="Search the catalogue…"
          onChange={(v) => set('serviceId', v)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Complexity" error={errors.complexity}>
          {/* 2x2 rather than 1x4: 'Standalone' does not fit in a quarter column. */}
          <div className="grid grid-cols-2 gap-1.5">
            {COMPLEXITIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => set('complexity', c.value)}
                className={cn(
                  'rounded-md border px-2 py-2 text-xs font-medium transition-colors',
                  form.complexity === c.value
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'hover:bg-accent',
                  errors.complexity && 'border-destructive',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </Field>

        <Field
          label="Variations"
          htmlFor="variations"
          error={errors.variationCount}
          hint={variationWarning ?? 'How many variations shipped.'}
        >
          <Input
            id="variations"
            type="number"
            min={1}
            step={1}
            className="tabular"
            value={form.variationCount}
            aria-invalid={Boolean(errors.variationCount)}
            onChange={(e) => set('variationCount', e.target.value)}
          />
        </Field>
      </div>

      <Field label="Task title" htmlFor="title" error={errors.title}>
        <Input
          id="title"
          ref={titleRef}
          value={form.title}
          placeholder="What was delivered"
          aria-invalid={Boolean(errors.title)}
          onChange={(e) => set('title', e.target.value)}
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Delivered on" htmlFor="deliveredOn" error={errors.deliveredOn}>
          <Input
            id="deliveredOn"
            type="date"
            max={todayInIST()}
            className="tabular"
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
            placeholder="Select a person"
            searchPlaceholder="Search people…"
            onChange={(v) => set('deliveredById', v)}
          />
        </Field>
      </div>

      <Field label="ClickUp task ID or URL" htmlFor="clickup" hint="Optional.">
        <Input
          id="clickup"
          value={form.clickupTaskId}
          placeholder="Optional"
          onChange={(e) => set('clickupTaskId', e.target.value)}
        />
      </Field>

      <Field label="Notes" htmlFor="notes" hint="Optional.">
        <Textarea
          id="notes"
          rows={2}
          value={form.notes}
          placeholder="Optional"
          onChange={(e) => set('notes', e.target.value)}
        />
      </Field>

      {duplicate && (
        <div className="border-amber-500/40 bg-amber-500/10 rounded-md border p-3 text-sm">
          <p className="font-medium text-amber-700 dark:text-amber-400">
            Possible duplicate
          </p>
          <p className="text-muted-foreground mt-0.5">
            <span className="font-mono">{duplicate.taskCode}</span> — “{duplicate.title}” was
            logged minutes ago with the same agency, brand, service, complexity and date.
            Saving is still allowed; genuine duplicates happen.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving…' : duplicateAck ? 'Save anyway' : 'Save delivery'}
        </Button>
        <span className="text-muted-foreground text-xs">
          ⌘/Ctrl + Enter to save. Agency and brand are kept for the next entry.
        </span>
      </div>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  )
}
