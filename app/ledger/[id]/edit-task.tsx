'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { BrandInput } from '@/components/brand-input'
import { Combobox, type ComboboxOption } from '@/components/combobox'
import { Field } from '@/components/field'
import { Segmented } from '@/components/segmented'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  getAgencies,
  getServices,
  getUsers,
  updateTask,
} from '@/lib/api/client'
import type { Complexity, TaskDetail, TaskStatus } from '@/lib/api/types'
import { todayInIST } from '@/lib/format'

const COMPLEXITIES: { value: Complexity; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
  { value: 'STANDALONE', label: 'Standalone' },
]

const STATUSES: ComboboxOption[] = [
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'REVISION_IN_PROGRESS', label: 'In revision' },
  { value: 'CLOSED', label: 'Closed' },
]

/**
 * Edit a delivered task (§5.3).
 *
 * The same field layout as the logging form, pre-filled, minus two things:
 *
 *  - the revision counts. A round is a dated record with a reason, not a number
 *    on a form, so rounds are added from the timeline below where each gets its
 *    own date. Complexity IS here, because it describes the work rather than
 *    recording an event.
 *  - the task code, which is never editable.
 *
 * Only changed fields are sent, so an untouched field is left alone rather than
 * rewritten with the same value.
 */
export function EditTask({
  task,
  onDone,
}: {
  task: TaskDetail
  onDone: () => void
}) {
  const queryClient = useQueryClient()

  const [agencyId, setAgencyId] = useState(task.agencyId)
  const [brandName, setBrandName] = useState(task.brandName)
  const [serviceId, setServiceId] = useState(task.serviceId)
  const [deliveredOn, setDeliveredOn] = useState(task.deliveredOn)
  const [deliveredById, setDeliveredById] = useState(task.deliveredById)
  const [status, setStatus] = useState<TaskStatus>(task.status)
  const [clickupTaskId, setClickupTaskId] = useState(task.clickupTaskId ?? '')
  const [notes, setNotes] = useState(task.notes ?? '')
  const [reason, setReason] = useState('')
  const [complexities, setComplexities] = useState<Record<string, Complexity>>(
    Object.fromEntries(task.variations.map((v) => [v.id, v.complexity])),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: agencies = [] } = useQuery({ queryKey: ['agencies'], queryFn: getAgencies })
  // Includes retired services, so an existing task logged against one can be
  // saved without silently losing it.
  const { data: services = [] } = useQuery({
    queryKey: ['services', 'all'],
    queryFn: () => getServices(true),
  })
  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers })

  const agencyChanged = agencyId !== task.agencyId

  const mutation = useMutation({
    mutationFn: () => {
      // Send only what moved. An absent field is left alone by the API.
      const changedComplexity = Object.fromEntries(
        Object.entries(complexities).filter(
          ([id, c]) => task.variations.find((v) => v.id === id)?.complexity !== c,
        ),
      )
      return updateTask(task.id, {
        ...(agencyId !== task.agencyId ? { agencyId } : {}),
        ...(brandName.trim() !== task.brandName || agencyChanged
          ? { brandName: brandName.trim() }
          : {}),
        ...(serviceId !== task.serviceId ? { serviceId } : {}),
        ...(deliveredOn !== task.deliveredOn ? { deliveredOn } : {}),
        ...(deliveredById !== task.deliveredById ? { deliveredById } : {}),
        ...(status !== task.status ? { status } : {}),
        ...((clickupTaskId.trim() || null) !== task.clickupTaskId
          ? { clickupTaskId: clickupTaskId.trim() || null }
          : {}),
        ...((notes.trim() || null) !== task.notes ? { notes: notes.trim() || null } : {}),
        ...(Object.keys(changedComplexity).length
          ? { variationComplexity: changedComplexity as Record<string, Complexity> }
          : {}),
        reason: reason.trim() || null,
      })
    },
    onSuccess: (result) => {
      // A save that changed nothing says so, rather than implying an edit was
      // recorded. The counter and the history are untouched in that case (§2.7).
      if (!result.changed) {
        toast('Nothing changed', { description: 'No edit was recorded.' })
      } else {
        toast(`Edited ${task.taskCode}`, {
          description: `${result.changedFields.length} field${result.changedFields.length === 1 ? '' : 's'} changed. Edit ${result.editCount} of this task.`,
        })
      }
      void queryClient.invalidateQueries({ queryKey: ['task', task.id] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['history', task.id] })
      onDone()
    },
    onError: (err) => {
      if (err instanceof ApiError && err.issues.length > 0) {
        setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])))
        toast.error('Check the highlighted fields')
        return
      }
      toast.error(err instanceof Error ? err.message : 'Could not save the edit')
    },
  })

  function submit() {
    const next: Record<string, string> = {}
    if (!brandName.trim()) next.brandName = 'Enter a brand'
    if (!deliveredOn) next.deliveredOn = 'Pick a date'
    else if (deliveredOn > todayInIST()) next.deliveredOn = 'Cannot be in the future'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    mutation.mutate()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
      className="border-rule bg-wash/40 mt-6 space-y-4 rounded-lg border p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Agency or direct client" error={errors.agencyId}>
          <Combobox
            options={agencies.map((a) => ({ value: a.id, label: a.name }))}
            value={agencyId}
            clearable={false}
            onChange={(v) => {
              // Brands belong to an agency, so changing it clears the brand (§2.7).
              setAgencyId(v)
              if (v !== task.agencyId) setBrandName('')
            }}
          />
        </Field>

        <Field
          label="Brand"
          error={errors.brandName}
          hint={agencyChanged ? 'Agency changed, so the brand needs re-entering.' : undefined}
        >
          <BrandInput
            agencyId={agencyId}
            value={brandName}
            onChange={setBrandName}
            invalid={Boolean(errors.brandName)}
          />
        </Field>

        <Field label="Service" error={errors.serviceId}>
          <Combobox
            options={services.map((s) => ({
              value: s.id,
              label: s.active ? s.name : `${s.name} (retired)`,
              group: s.isBundle ? 'Bundles' : s.category,
            }))}
            value={serviceId}
            clearable={false}
            onChange={setServiceId}
          />
        </Field>

        <Field label="Status">
          <Combobox
            options={STATUSES}
            value={status}
            clearable={false}
            onChange={(v) => setStatus(v as TaskStatus)}
          />
        </Field>

        <Field label="Delivered on" error={errors.deliveredOn}>
          <Input
            type="date"
            max={todayInIST()}
            value={deliveredOn}
            aria-invalid={Boolean(errors.deliveredOn)}
            onChange={(e) => setDeliveredOn(e.target.value)}
          />
        </Field>

        <Field label="Delivered by">
          <Combobox
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            value={deliveredById}
            clearable={false}
            onChange={setDeliveredById}
          />
        </Field>

        <Field label="ClickUp task" optional>
          <Input
            value={clickupTaskId}
            placeholder="ID or URL"
            onChange={(e) => setClickupTaskId(e.target.value)}
          />
        </Field>

        <Field label="Notes" optional>
          <Input
            value={notes}
            placeholder="Anything worth recording"
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
      </div>

      {task.variations.length > 0 && (
        <div className="border-rule space-y-2 border-t pt-4">
          <p className="text-ink-muted text-micro">
            Complexity per variation. Revision counts are not edited here: a round is a
            dated record, so rounds are added on the timeline below.
          </p>
          {task.variations.map((v) => (
            <div key={v.id} className="grid items-center gap-3 sm:grid-cols-[6rem_1fr]">
              <span className="text-ink-muted text-dense">
                Variation {v.variationNumber}
              </span>
              <Segmented
                name={`Complexity for variation ${v.variationNumber}`}
                options={COMPLEXITIES}
                value={complexities[v.id] ?? v.complexity}
                onChange={(c) => setComplexities((prev) => ({ ...prev, [v.id]: c }))}
              />
            </div>
          ))}
        </div>
      )}

      <Field
        label="Reason for this edit"
        optional
        hint="Kept on the history entry, so a correction can be explained later."
      >
        <Input
          value={reason}
          placeholder="Why is it being changed"
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="bg-action hover:bg-action-soft text-ink text-dense rounded-md px-3 py-1.5 font-medium transition-colors duration-[120ms] disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-ink-muted hover:text-ink text-dense transition-colors duration-[120ms]"
        >
          Cancel
        </button>
        <p className="text-ink-faint text-micro">
          Saving records who, when and exactly which fields changed.
        </p>
      </div>
    </form>
  )
}
