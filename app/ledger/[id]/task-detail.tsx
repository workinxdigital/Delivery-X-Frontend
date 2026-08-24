'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { Combobox } from '@/components/combobox'
import { Field } from '@/components/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ApiError, addRevisionRound, getRevisionReasons, getTask } from '@/lib/api/client'
import type { TaskVariationDetail } from '@/lib/api/types'
import { COMPLEXITY_LABELS, STATUS_LABELS, formatDateOnly, todayInIST } from '@/lib/format'
import { cn } from '@/lib/utils'

export function TaskDetailView({ id }: { id: string }) {
  const { data: task, isLoading, isError, error } = useQuery({
    queryKey: ['task', id],
    queryFn: () => getTask(id),
  })

  if (isLoading) {
    return (
      <div className="max-w-[52rem] space-y-4">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (isError || !task) {
    return (
      <div className="max-w-[52rem]">
        <p className="text-danger">
          {error instanceof Error ? error.message : 'Task not found'}
        </p>
        <Link
          href="/ledger"
          className="text-ink-muted hover:text-ink mt-3 inline-block text-dense underline decoration-dotted"
        >
          Back to the ledger
        </Link>
      </div>
    )
  }

  const locked = task.periodStatus === 'LOCKED'
  const mix = task.complexities.map((c) => COMPLEXITY_LABELS[c]).join(' + ')

  return (
    <div className="max-w-[52rem]">
      <Link
        href="/ledger"
        className="text-ink-muted hover:text-ink mb-5 inline-flex items-center gap-1.5 text-dense transition-colors duration-[120ms]"
      >
        <ArrowLeft className="size-3.5" />
        Ledger
      </Link>

      <div className="border-rule border-b pb-5">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="code text-ink-muted">{task.taskCode}</span>
          <h1 className="text-[1.375rem] font-semibold tracking-tight">
            {task.title ?? `${task.brandName} — ${task.serviceName}`}
          </h1>
        </div>
        <p className="text-ink-muted mt-1 text-dense">
          {task.agencyName} · {task.brandName} · {formatDateOnly(task.deliveredOn)} ·{' '}
          {STATUS_LABELS[task.status]}
        </p>
      </div>

      <dl className="divide-rule grid divide-y">
        <Detail label="Service">
          {task.serviceName}
          {task.isBundle && (
            <span className="border-rule text-ink-muted ml-1.5 rounded-sm border px-1 text-micro">
              bundle
            </span>
          )}
        </Detail>
        <Detail label="Variations">
          {task.variationCount}
          {mix && <span className="text-ink-muted"> · {mix}</span>}
        </Detail>
        <Detail label="Revisions">
          {task.revisionRoundCount === 0 ? (
            'none'
          ) : (
            <>
              {task.revisionRoundCount} across {task.variationCount} variation
              {task.variationCount === 1 ? '' : 's'}
            </>
          )}
        </Detail>
        <Detail label="Delivered by">{task.deliveredByName}</Detail>
        <Detail label="Logged by">{task.loggedByName}</Detail>
        {task.clickupTaskId && <Detail label="ClickUp">{task.clickupTaskId}</Detail>}
        {task.notes && <Detail label="Notes">{task.notes}</Detail>}
      </dl>

      <AllowanceSummary task={task} />

      <section className="border-rule mt-10 border-t pt-6">
        <h2 className="text-dense font-medium">Variations and their revisions</h2>
        <p className="text-ink-muted mt-1 text-micro">
          Each variation has its own complexity and its own rounds. The allowance of{' '}
          {task.freeRevisionAllowanceSnapshot} was fixed when this was logged, so changing
          the agency later will not alter these numbers.
        </p>

        <div className="mt-5 space-y-8">
          {task.variations.map((variation) => (
            <VariationBlock
              key={variation.id}
              taskId={task.id}
              variation={variation}
              allowance={task.freeRevisionAllowanceSnapshot}
              locked={locked}
            />
          ))}
        </div>
      </section>

      <section className="border-rule mt-10 border-t pt-6">
        <h2 className="text-dense font-medium">Edit history</h2>
        <p className="text-ink-muted mt-1 text-micro">
          {task.editCount === 0
            ? 'Never edited. Editing a delivered task arrives in Phase 2.5.'
            : `Edited ${task.editCount}×.`}
        </p>
      </section>
    </div>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <dt className="text-ink-muted text-dense">{label}</dt>
      <dd className="text-dense">{children}</dd>
    </div>
  )
}

/**
 * Both readings of the allowance, side by side.
 *
 * They answer different questions and can differ, so showing one and hiding the
 * other would be picking an answer on the reader's behalf.
 */
function AllowanceSummary({
  task,
}: {
  task: {
    revisionRoundCount: number
    roundsBeyondAllowancePerVariation: number
    roundsBeyondAllowancePerDelivery: number
    freeRevisionAllowanceSnapshot: number
  }
}) {
  if (task.revisionRoundCount === 0) return null

  return (
    <div className="border-rule mt-8 grid gap-px border-y sm:grid-cols-2">
      <Reading
        label="Beyond allowance, per variation"
        value={task.roundsBeyondAllowancePerVariation}
        note={`Each variation measured against its own allowance of ${task.freeRevisionAllowanceSnapshot}.`}
      />
      <Reading
        label="Beyond allowance, per delivery"
        value={task.roundsBeyondAllowancePerDelivery}
        note={`All ${task.revisionRoundCount} rounds measured against one allowance of ${task.freeRevisionAllowanceSnapshot}.`}
      />
    </div>
  )
}

function Reading({
  label,
  value,
  note,
}: {
  label: string
  value: number
  note: string
}) {
  return (
    <div className="py-4">
      <p className="text-ink-muted text-micro">{label}</p>
      {/* Zero is the normal case and gets no colour. */}
      <p
        className={cn(
          'mt-0.5 text-[1.375rem] font-semibold',
          value > 0 ? 'text-beyond' : 'text-ink',
        )}
      >
        {value}
      </p>
      <p className="text-ink-faint mt-0.5 text-micro">{note}</p>
    </div>
  )
}

function VariationBlock({
  taskId,
  variation,
  allowance,
  locked,
}: {
  taskId: string
  variation: TaskVariationDetail
  allowance: number
  locked: boolean
}) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [reasonId, setReasonId] = useState('')
  const [requestedOn, setRequestedOn] = useState(todayInIST())
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: reasons = [] } = useQuery({
    queryKey: ['revision-reasons'],
    queryFn: getRevisionReasons,
  })

  const mutation = useMutation({
    mutationFn: () =>
      addRevisionRound(variation.id, { reasonId, requestedOn, notes: notes || null }),
    onSuccess: (result) => {
      toast(`Variation ${result.variationNumber}, round ${result.round.roundNumber}`, {
        description: result.round.beyondAllowance
          ? `Beyond the allowance of ${result.allowanceInForce}.`
          : `Within the allowance of ${result.allowanceInForce}.`,
      })
      setAdding(false)
      setReasonId('')
      setNotes('')
      setErrors({})
      void queryClient.invalidateQueries({ queryKey: ['task', taskId] })
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (err) => {
      if (err instanceof ApiError && err.issues.length > 0) {
        setErrors(Object.fromEntries(err.issues.map((i) => [i.path, i.message])))
        return
      }
      toast.error(err instanceof Error ? err.message : 'Could not add the round')
    },
  })

  function submit() {
    const next: Record<string, string> = {}
    if (!reasonId) next.reasonId = 'Pick a reason'
    if (!requestedOn) next.requestedOn = 'Pick a date'
    else if (requestedOn > todayInIST()) next.requestedOn = 'Cannot be in the future'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    mutation.mutate()
  }

  const within = variation.revisionRoundCount - variation.roundsBeyondAllowance

  return (
    <div>
      <div className="border-rule flex flex-wrap items-baseline justify-between gap-3 border-b pb-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-dense font-medium">Variation {variation.variationNumber}</span>
          <span className="text-ink-muted text-dense">
            {COMPLEXITY_LABELS[variation.complexity]}
          </span>
          <span className="text-ink-muted text-micro">
            {variation.revisionRoundCount === 0
              ? 'no revisions'
              : `${within} within allowance`}
            {variation.roundsBeyondAllowance > 0 && (
              <span className="text-beyond font-medium">
                {', '}
                {variation.roundsBeyondAllowance} beyond
              </span>
            )}
          </span>
        </div>

        {!locked && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="border-control text-ink-muted hover:text-ink hover:bg-wash rounded-md border px-2 py-1 text-micro transition-colors duration-[120ms]"
          >
            Add a round
          </button>
        )}
      </div>

      {variation.revisionRounds.length > 0 && (
        <ol className="divide-rule divide-y">
          {variation.revisionRounds.map((round) => (
            <li
              key={round.id}
              className="grid gap-1 py-2 sm:grid-cols-[4rem_1fr_auto] sm:gap-4"
            >
              <span className="text-ink-muted text-dense">Round {round.roundNumber}</span>
              <span className="text-dense">
                {round.reason}
                {round.notes && <span className="text-ink-muted"> · {round.notes}</span>}
                <span className="text-ink-faint block text-micro">
                  requested {formatDateOnly(round.requestedOn)}
                  {round.completedOn && `, completed ${formatDateOnly(round.completedOn)}`}
                  {' · '}
                  {round.loggedByName}
                </span>
              </span>
              <span
                className={cn(
                  'text-micro whitespace-nowrap sm:text-right',
                  round.beyondAllowance ? 'text-beyond font-medium' : 'text-ink-muted',
                )}
              >
                {round.beyondAllowance ? 'beyond allowance' : 'within allowance'}
              </span>
            </li>
          ))}
        </ol>
      )}

      {locked && (
        <p className="text-ink-muted mt-2 text-micro">
          This task is in a locked period, so no rounds can be added.
        </p>
      )}

      {adding && (
        <div className="border-rule bg-wash/50 mt-3 grid gap-4 rounded-md border p-4 sm:grid-cols-[1fr_10rem]">
          <Field label="Why was it changed" error={errors.reasonId}>
            <Combobox
              options={reasons.map((r) => ({ value: r.id, label: r.label }))}
              value={reasonId}
              onChange={setReasonId}
              placeholder="Select a reason"
              searchPlaceholder="Search reasons"
              invalid={Boolean(errors.reasonId)}
              clearable={false}
            />
          </Field>

          <Field label="Requested on" error={errors.requestedOn}>
            <Input
              type="date"
              max={todayInIST()}
              value={requestedOn}
              aria-invalid={Boolean(errors.requestedOn)}
              onChange={(e) => setRequestedOn(e.target.value)}
            />
          </Field>

          <Field label="Notes" optional className="sm:col-span-2">
            <Input
              value={notes}
              placeholder="What changed"
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <div className="flex items-center gap-3 sm:col-span-2">
            <button
              type="button"
              onClick={submit}
              disabled={mutation.isPending}
              className="bg-ink text-primary-foreground text-dense hover:bg-ink/90 rounded-md px-3 py-1.5 font-medium transition-colors duration-[120ms] disabled:opacity-50"
            >
              {mutation.isPending ? 'Adding' : 'Add round'}
            </button>
            <button
              type="button"
              onClick={() => {
                setAdding(false)
                setErrors({})
              }}
              className="text-ink-muted hover:text-ink text-dense transition-colors duration-[120ms]"
            >
              Cancel
            </button>
            <p className="text-ink-faint text-micro">
              A lifecycle event, not a correction, so it will not count as an edit.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
