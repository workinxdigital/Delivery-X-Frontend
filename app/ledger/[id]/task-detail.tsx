'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { EditTask } from './edit-task'
import { toast } from 'sonner'
import { Combobox } from '@/components/combobox'
import { ComplexityPill, Pill } from '@/components/pill'
import { Field } from '@/components/field'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ApiError,
  addRevisionRound,
  getRevisionReasons,
  getTask,
  getTaskHistory,
  getTasks,
} from '@/lib/api/client'
import type { TaskVariationDetail } from '@/lib/api/types'
import {
  COMPLEXITY_LABELS,
  STATUS_LABELS,
  formatDateOnly,
  formatTimestamp,
  summarizeComplexities,
  todayInIST,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { PrimaryButton } from '@/components/primary-button'

export function TaskDetailView({ id }: { id: string }) {
  // The ledger's edit action links here with ?edit=1, so the pencil takes you
  // straight into the form rather than to the record and then the form.
  const params = useSearchParams()
  const [editing, setEditing] = useState(params.get('edit') === '1')

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
  const tiers = summarizeComplexities(task.complexities).tiers

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
          <h1 className="display text-[1.5rem] font-semibold">
            {task.title ?? `${task.brandName} — ${task.serviceName}`}
          </h1>

          {!editing && (
            <button
              type="button"
              disabled={locked}
              onClick={() => setEditing(true)}
              title={
                locked
                  ? 'This task is in a locked period and cannot be edited.'
                  : undefined
              }
              className="border-control text-ink-muted hover:text-ink hover:bg-wash ml-auto flex items-center gap-1.5 rounded-md border px-2 py-1 text-micro transition-colors duration-[120ms] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Pencil className="size-3" />
              Edit
            </button>
          )}
        </div>
        <p className="text-ink-muted mt-1 text-dense">
          {task.agencyName} · {task.brandName} · {formatDateOnly(task.deliveredOn)} ·{' '}
          {STATUS_LABELS[task.status]}
        </p>
      </div>

      {locked && (
        <p className="text-ink-muted mt-3 text-micro">
          This task is in a locked period, so it cannot be edited. Log a correction in
          the current open period noting this task code.
        </p>
      )}

      {editing && <EditTask task={task} onDone={() => setEditing(false)} />}

      <dl className="divide-rule grid divide-y">
        {task.productName && <Detail label="Product">{task.productName}</Detail>}
        <Detail label="ASIN">
          {task.asinCode ? (
            <span className="code">{task.asinCode}</span>
          ) : (
            <span className="text-ink-faint">not recorded</span>
          )}
        </Detail>
        <Detail label="Service">
          {task.serviceName}
          {task.isBundle && (
            <Pill tone="outline" className="ml-1.5">
              bundle
            </Pill>
          )}
        </Detail>
        <Detail label="Variations">
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <span className="tabular">{task.variationCount}</span>
            {tiers.map((tier) => (
              <ComplexityPill key={tier} complexity={tier} />
            ))}
          </span>
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

      <SameDelivery task={task} />

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

      <EditHistory task={task} />
    </div>
  )
}

/**
 * The other services delivered in the same job.
 *
 * One submission covering three ASINs and two services becomes six rows, which
 * keeps the delivered count and the service mix exact. This is what puts the job
 * back together for someone reading one of those rows.
 */
function SameDelivery({
  task,
}: {
  task: { id: string; deliveryGroupId: string | null }
}) {
  const { data } = useQuery({
    queryKey: ['tasks', { deliveryGroupId: task.deliveryGroupId }],
    queryFn: () => getTasks({ deliveryGroupId: task.deliveryGroupId! }),
    enabled: Boolean(task.deliveryGroupId),
  })

  const siblings = (data?.tasks ?? []).filter((t) => t.id !== task.id)
  if (siblings.length === 0) return null

  return (
    <section className="border-rule mt-8 border-t pt-4">
      <h2 className="text-ink-muted text-micro font-medium">
        Delivered in the same job
      </h2>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {siblings.map((s) => (
          <li key={s.id}>
            <Link
              href={`/ledger/${s.id}`}
              className="text-dense hover:text-ink text-ink-muted transition-colors duration-[120ms]"
            >
              <span className="code">{s.taskCode}</span> {s.serviceName}
              {/* Which product it was for — a job now spans ASINs as well as
                  services, so the service name alone no longer identifies a
                  sibling row. */}
              {s.asinCode && (
                <span className="text-ink-faint"> · {s.asinCode}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The edit history (§2.7, §5.3).
 *
 * A query against audit_log, which is the truth; the counter on the task is a
 * denormalized convenience for the ledger. An unedited task shows nothing but
 * the creation entry, because there is nothing to report yet.
 */
function EditHistory({
  task,
}: {
  task: { id: string; editCount: number; lastEditedAt: string | null; lastEditedByName: string | null }
}) {
  const [open, setOpen] = useState(false)
  const { data: history = [] } = useQuery({
    queryKey: ['history', task.id],
    queryFn: () => getTaskHistory(task.id),
    enabled: open,
  })

  const edits = history.filter((h) => h.action === 'UPDATE')

  return (
    <section className="border-rule mt-10 border-t pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-dense font-medium">Edit history</h2>
          <p className="text-ink-muted mt-1 text-micro">
            {task.editCount === 0 ? (
              'Never edited.'
            ) : (
              <>
                Edited {task.editCount}×
                {task.lastEditedAt && (
                  <>
                    {' · last '}
                    {formatTimestamp(task.lastEditedAt)}
                    {task.lastEditedByName && ` by ${task.lastEditedByName}`}
                  </>
                )}
              </>
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-ink-muted hover:text-ink text-micro underline decoration-dotted transition-colors duration-[120ms]"
        >
          {open ? 'Hide' : 'Show'} full record
        </button>
      </div>

      {open && (
        <ol className="divide-rule mt-4 divide-y">
          {history.length === 0 && (
            <li className="text-ink-muted py-3 text-micro">Loading…</li>
          )}
          {history.map((entry) => (
            <li key={entry.id} className="py-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-dense">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                <span className="text-ink-faint text-micro">
                  {formatTimestamp(entry.at)} · {entry.actorName}
                </span>
              </div>
              {entry.reason && (
                <p className="text-ink-muted mt-0.5 text-micro">“{entry.reason}”</p>
              )}
              {/* Field-level before and after, which is what makes an edit visible. */}
              {entry.action === 'UPDATE' && entry.after && (
                <ul className="mt-1 space-y-0.5">
                  {Object.keys(entry.after ?? {}).map((field) => (
                    <li key={field} className="text-micro">
                      <span className="text-ink-muted">{field}</span>{' '}
                      <span className="text-ink-faint">
                        {JSON.stringify(entry.before?.[field] ?? null)} →
                      </span>{' '}
                      <span className="text-ink">
                        {JSON.stringify(entry.after?.[field] ?? null)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}

      {task.editCount > 0 && edits.length === 0 && open && (
        <p className="text-ink-muted mt-2 text-micro">
          The counter says {task.editCount}, but no edit entries were found. That
          disagreement is worth investigating: audit_log is the truth.
        </p>
      )}
    </section>
  )
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Logged',
  UPDATE: 'Edited',
  SOFT_DELETE: 'Removed',
  RESTORE: 'Restored',
  REVISION_ROUND_ADDED: 'Revision round added',
  REVISION_ROUND_UPDATED: 'Revision round changed',
  REVISION_ROUND_DELETED: 'Revision round removed',
  BRAND_MERGE: 'Brand merged',
  PERIOD_LOCK: 'Period locked',
  PERIOD_UNLOCK: 'Period unlocked',
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
          <ComplexityPill complexity={variation.complexity} />
          <span className="text-ink-muted text-micro">
            {variation.revisionRoundCount === 0
              ? 'no revisions'
              : `${within} within allowance`}
          </span>
          {variation.roundsBeyondAllowance > 0 && (
            <Pill tone="beyond">{variation.roundsBeyondAllowance} beyond</Pill>
          )}
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
              <span className="sm:text-right">
                {round.beyondAllowance ? (
                  <Pill tone="beyond">beyond allowance</Pill>
                ) : (
                  <Pill tone="neutral">within allowance</Pill>
                )}
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
            <PrimaryButton
              type="button"
              onClick={submit}
              pending={mutation.isPending}
              pendingLabel="Adding"
            >
              Add round
            </PrimaryButton>
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
