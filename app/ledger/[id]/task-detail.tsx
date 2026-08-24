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
        <Link href="/ledger" className="text-ink-muted hover:text-ink mt-3 inline-block text-dense underline decoration-dotted">
          Back to the ledger
        </Link>
      </div>
    )
  }

  const locked = task.periodStatus === 'LOCKED'
  const within = task.revisionRoundCount - task.roundsBeyondAllowance

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
          {/* Titles are optional, so the brand and service carry the heading. */}
          <h1 className="text-[1.375rem] font-semibold tracking-tight">
            {task.title ?? `${task.brandName} — ${task.serviceName}`}
          </h1>
        </div>
        <p className="text-ink-muted mt-1 text-dense">
          {task.agencyName} · {task.brandName} · {COMPLEXITY_LABELS[task.complexity]} ·{' '}
          {task.variationCount} variation{task.variationCount === 1 ? '' : 's'} ·{' '}
          {formatDateOnly(task.deliveredOn)}
        </p>
      </div>

      {/* The record itself. A definition list, not cards. */}
      <dl className="divide-rule grid divide-y">
        <Detail label="Service">
          {task.serviceName}
          {task.isBundle && (
            <span className="border-rule text-ink-muted ml-1.5 rounded-sm border px-1 text-micro">
              bundle
            </span>
          )}
        </Detail>
        <Detail label="Complexity">{COMPLEXITY_LABELS[task.complexity]}</Detail>
        <Detail label="Variations">{task.variationCount}</Detail>
        <Detail label="Status">{STATUS_LABELS[task.status]}</Detail>
        <Detail label="Delivered by">{task.deliveredByName}</Detail>
        <Detail label="Logged by">{task.loggedByName}</Detail>
        {task.clickupTaskId && <Detail label="ClickUp">{task.clickupTaskId}</Detail>}
        {task.notes && <Detail label="Notes">{task.notes}</Detail>}
      </dl>

      <RevisionTimeline task={task} within={within} locked={locked} />

      {/*
        Edit history is Phase 2.5. Stated rather than shown as an empty panel,
        because an unedited task should show nothing at all (§5.3) and there is
        no edit path yet for it to record.
      */}
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
 * The revision round timeline (§5.3).
 *
 * Rounds within allowance and rounds beyond it must never be confusable, so
 * beyond-allowance rounds carry the only chromatic colour in the product. That
 * flag is a COUNT, not a charge: this screen says how many rounds went past the
 * allowance and stops there (§2.6).
 */
function RevisionTimeline({
  task,
  within,
  locked,
}: {
  task: {
    id: string
    taskCode: string
    revisionRoundCount: number
    roundsBeyondAllowance: number
    freeRevisionAllowanceSnapshot: number
    revisionRounds: {
      id: string
      roundNumber: number
      requestedOn: string
      completedOn: string | null
      beyondAllowance: boolean
      reason: string
      notes: string | null
      loggedByName: string
    }[]
  }
  within: number
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
    mutationFn: () => addRevisionRound(task.id, { reasonId, requestedOn, notes: notes || null }),
    onSuccess: (result) => {
      toast(`Round ${result.round.roundNumber} added`, {
        description: result.round.beyondAllowance
          ? `Beyond the allowance of ${result.allowanceInForce}. ${result.roundsBeyondAllowance} now beyond.`
          : `Within the allowance of ${result.allowanceInForce}.`,
      })
      setAdding(false)
      setReasonId('')
      setNotes('')
      setErrors({})
      void queryClient.invalidateQueries({ queryKey: ['task', task.id] })
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

  return (
    <section className="border-rule mt-10 border-t pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-dense font-medium">Revision rounds</h2>
          <p className="text-ink-muted mt-1 text-micro">
            {task.revisionRoundCount === 0 ? (
              <>
                None yet. The allowance on this task is{' '}
                {task.freeRevisionAllowanceSnapshot}.
              </>
            ) : (
              <>
                {within} within the allowance of {task.freeRevisionAllowanceSnapshot}
                {task.roundsBeyondAllowance > 0 && (
                  <>
                    {', '}
                    <span className="text-beyond font-medium">
                      {task.roundsBeyondAllowance} beyond
                    </span>
                  </>
                )}
                . The allowance was fixed when this was logged, so changing the
                agency later will not alter these numbers.
              </>
            )}
          </p>
        </div>

        {!locked && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="border-control text-dense text-ink-muted hover:text-ink hover:bg-wash rounded-md border px-2.5 py-1.5 transition-colors duration-[120ms]"
          >
            Add a round
          </button>
        )}
      </div>

      {locked && (
        <p className="text-ink-muted mt-3 text-micro">
          This task is in a locked period, so no rounds can be added. Log a correction
          in the current open period instead.
        </p>
      )}

      {task.revisionRounds.length > 0 && (
        <ol className="divide-rule mt-4 divide-y">
          {task.revisionRounds.map((round) => (
            <li key={round.id} className="grid gap-1 py-2.5 sm:grid-cols-[4rem_1fr_auto] sm:gap-4">
              <span className="text-ink-muted text-dense">Round {round.roundNumber}</span>
              <span className="text-dense">
                {round.reason}
                {round.notes && (
                  <span className="text-ink-muted"> · {round.notes}</span>
                )}
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

      {adding && (
        <div className="border-rule bg-wash/50 mt-4 grid gap-4 rounded-md border p-4 sm:grid-cols-[1fr_10rem]">
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
              This is a lifecycle event, not a correction, so it will not count as an
              edit.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}
