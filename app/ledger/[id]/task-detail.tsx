'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Pencil } from 'lucide-react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { EditTask } from './edit-task'
import { toast } from 'sonner'
import { Combobox } from '@/components/combobox'
import { ComplexityPill, Pill, CodePill } from '@/components/pill'
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
import type { TaskDetail, TaskVariationDetail } from '@/lib/api/types'
import {
  formatMoneyMinor,
  COMPLEXITY_LABELS,
  formatDateOnly,
  formatTimestamp,
  summarizeComplexities,
  todayInIST,
} from '@/lib/format'
import { cn } from '@/lib/utils'
import { PrimaryButton } from '@/components/primary-button'
import { PriceBreakdown } from '@/components/price-breakdown'
import { isAdmin, useSession } from '@/components/session'
import { getTaskPricing } from '@/lib/api/client'

export function TaskDetailView({ id }: { id: string }) {
  // The ledger's edit action links here with ?edit=1, so the pencil takes you
  // straight into the form rather than to the record and then the form.
  const params = useSearchParams()
  const router = useRouter()
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
    /*
      Two columns on a wide screen: the record on the left at its reading
      measure, and what it was worth beside it.

      The breakdown was a section at the bottom of a 52rem column, which left
      the right half of the page empty and buried the number under everything
      else on the record. `data-measure="wide"` gives this page the same wider
      shell the ledger takes (§5.11) so both columns fit; below `xl` the grid
      collapses and the panel falls back underneath, where it reads fine.
    */
    <div
      data-measure="wide"
      className="xl:grid xl:grid-cols-[minmax(0,52rem)_minmax(19rem,23rem)] xl:items-start xl:gap-10"
    >
      <div className="max-w-[52rem]">
      {/*
        Back to wherever you came from, not always the ledger.

        It was a hard link to /ledger, so opening a delivery from the Billing
        screen and pressing back landed you somewhere you had never been
        (owner, 2026-08-31). `router.back()` retraces the actual step; the
        ledger stays the fallback for someone who arrived here by URL, where
        there is no step to retrace.
      */}
      <button
        type="button"
        onClick={() => {
          if (window.history.length > 1) router.back()
          else router.push('/ledger')
        }}
        className="text-ink-muted hover:text-ink mb-5 inline-flex items-center gap-1.5 text-dense transition-colors duration-[120ms]"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </button>

      <div className="border-rule border-b pb-5">
        {/*
          The code is context, not the headline. It sits above the title as an
          eyebrow so the name of the thing is the first thing read — previously
          it shared a baseline with the title.

          The status pill went with it (owner, 2026-09-01). DELIVERED → IN
          REVISION → CLOSED is set by the server from the round count, so on a
          ledger where most jobs get revised it said "this came back" on nearly
          every record while carrying no decision — and being read as a
          judgement it was not making. What it was standing in for is on the
          record already, in numbers: the rounds, and how many went beyond the
          allowance. The column, the API field and the CSV are untouched.
        */}
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <CodePill>{task.taskCode}</CodePill>
          {locked && (
            <Pill tone="outline" title="In a locked period">
              locked
            </Pill>
          )}
        </div>

        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
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
          {task.agencyName} · {task.brandName} · delivered {formatDateOnly(task.deliveredOn)}
        </p>
      </div>

      {locked && (
        <p className="text-ink-muted mt-3 text-micro">
          This task is in a closed month, so it cannot be edited. Log a correction in
          the current open month noting this task code.{' '}
          {/*
            Rework is the exception, and saying so here matters: the banner used
            to read as "nothing about this job can change", which is exactly the
            belief that would send somebody off to log a duplicate delivery for
            a revision (owner, 2026-09-29).
          */}
          <span className="text-ink-muted">
            Revision rounds can still be added — a round is dated in its own right, so
            rework on an old job belongs to the month it was asked for.
          </span>
        </p>
      )}

      {editing && <EditTask task={task} onDone={() => setEditing(false)} />}

      {/*
        The numbers first, as figures rather than as rows in a list.

        Variations, rounds and rounds-beyond are what this record exists to
        report (§1), and they were previously three lines of prose in a
        seven-row table where "Logged by" carried identical weight. Everything
        that is a count is now read as a count.
      */}
      <div className="divide-rule border-rule mt-6 grid divide-y border-y sm:grid-cols-[1fr_1fr_1.5fr] sm:divide-x sm:divide-y-0">
        <Figure label="Variations" value={task.variationCount}>
          {tiers.length > 0 && (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {tiers.map((tier) => (
                <ComplexityPill key={tier} complexity={tier} />
              ))}
            </span>
          )}
        </Figure>

        <Figure
          label="Revision rounds"
          value={task.revisionRoundCount}
          note={
            task.revisionRoundCount === 0
              ? 'none yet'
              : `across ${task.variationCount} variation${task.variationCount === 1 ? '' : 's'}`
          }
        />

        {/*
          The one figure that is allowed colour, and only when it is not zero:
          rounds past the allowance are where scope leaks (§5.4). Zero beyond
          allowance is good news and must not be painted as a warning.
        */}
        {/*
          Both readings of the allowance live here (§2.6), rather than here and
          again in a card below.

          The page previously showed this number twice: once as this figure and
          once as the headline of a four-band panel further down, which left the
          reader working out whether they were the same thing. They were. The
          per-variation reading is the one promoted, because it is the one that
          attributes rounds to a piece of work; the per-delivery reading is a
          second way of counting the same rounds and reads as its note.
        */}
        <Figure
          label="Beyond allowance"
          value={task.roundsBeyondAllowancePerVariation}
          alarm={task.roundsBeyondAllowancePerVariation > 0}
          note={`per variation, each against its own ${task.freeRevisionAllowanceSnapshot}`}
        >
          {task.revisionRoundCount > 0 && (
            <div className="text-ink-muted mt-1 text-micro">
              <span
                className={cn(
                  'tabular font-medium',
                  task.roundsBeyondAllowancePerDelivery > 0 && 'text-beyond',
                )}
              >
                {task.roundsBeyondAllowancePerDelivery}
              </span>{' '}
              per delivery, all {task.revisionRoundCount} against one{' '}
              {task.freeRevisionAllowanceSnapshot}
            </div>
          )}
          <div className="text-ink-faint mt-1.5 text-micro">A count, never a charge.</div>
        </Figure>
      </div>

      {/*
        Two columns, because a value like "mercy" stranded alone on a 52rem line
        is mostly empty space — and the pairing puts what shipped beside who
        shipped it rather than stacking seven unrelated rows.
      */}
      <dl className="mt-8 grid gap-x-10 gap-y-0 sm:grid-cols-2">
        <div className="divide-rule grid divide-y">
          {task.productName && <Detail label="Product">{task.productName}</Detail>}
          <Detail label="ASIN">
            {task.asinCode ? (
              <CodePill title="Parent listing">{task.asinCode}</CodePill>
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
        </div>

        <div className="divide-rule grid divide-y">
          <Detail label="Delivered by">{task.deliveredByName}</Detail>
          <Detail label="Logged by">{task.loggedByName}</Detail>
          <Detail label="ClickUp">
            {task.clickupTaskId ? (
              <CodePill title="ClickUp task">{task.clickupTaskId}</CodePill>
            ) : (
              <span className="text-ink-faint">not recorded</span>
            )}
          </Detail>
        </div>
      </dl>

      {/* Full width: a note is prose and wants the measure. */}
      {task.notes && (
        <div className="border-rule mt-6 border-t pt-4">
          <div className="text-ink-muted text-micro">Notes</div>
          <p className="text-dense mt-1 whitespace-pre-line">{task.notes}</p>
        </div>
      )}

      <SameDelivery task={task} />

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
              hasParentLine={task.hasParentLine ?? true}
            />
          ))}
        </div>
      </section>

      <EditHistory task={task} />
      </div>

      {/*
        What this delivery was worth — admin only (§1, §5.7).

        The ledger still stores no amount: this is the same server pass the
        Pricing screen runs, narrowed to one delivery and read fresh from the
        agency's rate card, so a rate typed today re-prices this record rather
        than rewriting it. It sits on the task because "how did that total come
        about" is a question asked while looking at the delivery, and answering
        it meant finding the row again on another screen.

        A PM never sees it. Money is admin-only, and the API refuses the route.
      */}
      <PriceForTask task={task} />
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
              <CodePill>{s.taskCode}</CodePill> {s.serviceName}
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

              {/*
                Field-level before/after, which is what §2.7 asks the history to
                show. Rendered from the keys actually present, so a field added
                to the task later appears here with no change to this component.
              */}
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

      {/*
        The counter is a denormalized convenience; audit_log is the truth. When
        they disagree, say so rather than quietly showing the smaller number.
      */}
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

/**
 * One count, set as a figure.
 *
 * Tabular and large enough to be read as a number rather than as text. The
 * label sits above it in the mono voice used for labels everywhere else, and a
 * note underneath says what the number is measured against — a count with
 * nothing to compare it to is just a digit.
 */
function Figure({
  label,
  value,
  note,
  alarm,
  children,
}: {
  label: string
  value: number
  note?: string
  alarm?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="px-4 py-4 first:pl-0 sm:px-5">
      <div className="text-ink-muted text-micro font-medium tracking-[0.06em] uppercase">
        {label}
      </div>
      <div
        className={cn(
          'display tabular mt-1.5 text-[1.75rem] leading-none font-semibold',
          alarm && 'text-beyond',
        )}
      >
        {value}
      </div>
      {note && <div className="text-ink-faint mt-1.5 text-micro">{note}</div>}
      {children}
    </div>
  )
}


type Round = {
  id: string
  roundNumber: number
  requestedOn: string
  completedOn: string | null
  beyondAllowance: boolean
  reason: string
  notes: string | null
  loggedByName: string
}

/** What a round logged at delivery time says. Anything else was added by hand. */
const BULK_REASON = 'Recorded with the delivery'

/**
 * Every round as one strip, and only the ones that say something as a row.
 *
 * A delivery logged with "7 revisions" creates seven records sharing a reason,
 * a date, a person and a verdict. Rendering those as seven rows — or even as
 * two collapsed ones — repeated the variation heading directly above it, which
 * already reports "3 within allowance · 4 beyond". The rows were restating a
 * summary rather than adding to it.
 *
 * So the shape of the revision load is drawn instead: one numbered chip per
 * round, neutral within the allowance and red past it, where the boundary is
 * visible at a glance rather than counted. Each chip carries its full detail in
 * a tooltip, so nothing is lost.
 *
 * A round added later from this screen has its own date, reason and person —
 * genuinely new information — so those keep a full row beneath the strip. That
 * is where a row earns its space.
 */
function RoundStrip({ rounds }: { rounds: Round[] }) {
  const notable = rounds.filter((r) => r.reason !== BULK_REASON || r.notes)

  return (
    <div className="mt-2">
      <ol className="flex flex-wrap gap-1">
        {rounds.map((round) => (
          <li key={round.id}>
            <span
              title={
                `Round ${round.roundNumber} · ${round.reason}` +
                (round.notes ? ` · ${round.notes}` : '') +
                ` · requested ${formatDateOnly(round.requestedOn)}` +
                (round.completedOn ? `, completed ${formatDateOnly(round.completedOn)}` : '') +
                ` · ${round.loggedByName}` +
                ` · ${round.beyondAllowance ? 'beyond the allowance' : 'within the allowance'}`
              }
              className={cn(
                'tabular flex size-7 items-center justify-center rounded-md text-micro',
                round.beyondAllowance
                  ? 'bg-beyond-wash text-beyond font-medium'
                  : 'bg-wash text-ink-muted',
              )}
            >
              {round.roundNumber}
            </span>
          </li>
        ))}
      </ol>

      {/*
        Only rounds that differ from the bulk. Their reason, date and person are
        the reason to read them; the rest are already in the strip.
      */}
      {notable.length > 0 && (
        <ol className="divide-rule mt-3 divide-y border-t pt-1">
          {notable.map((round) => (
            <li key={round.id} className="grid gap-1 py-2 sm:grid-cols-[5rem_1fr_auto] sm:gap-4">
              <span className="text-ink-muted text-dense whitespace-nowrap">
                Round {round.roundNumber}
              </span>
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

function VariationBlock({
  taskId,
  variation,
  allowance,
  hasParentLine,
}: {
  taskId: string
  variation: TaskVariationDetail
  allowance: number
  /** Whether this delivery's first row is the parent listing (§2.4). */
  hasParentLine: boolean
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
    /* A date is required; which date is the PM's to decide — the same rule the
       delivery date follows (§5.1, owner 2026-09-28). */
    if (!requestedOn) next.requestedOn = 'Pick a date'
    setErrors(next)
    if (Object.keys(next).length > 0) return
    mutation.mutate()
  }

  const within = variation.revisionRoundCount - variation.roundsBeyondAllowance

  return (
    <div>
      <div className="border-rule flex flex-wrap items-baseline justify-between gap-3 border-b pb-2">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <span className="text-dense font-medium">
            {/* Position no longer decides this: a delivery for child SKUs only
                has no parent line, so its first row is Variation 1 (§2.4). */}
            {hasParentLine
              ? variation.variationNumber === 1
                ? 'Parent listing'
                : `Variation ${variation.variationNumber - 1}`
              : `Variation ${variation.variationNumber}`}
          </span>

          {/* Its own code. Every variation is a delivered thing (§2.5), so each
              one is quotable — the parent by the delivery's own code, the
              children by that code plus their number. */}
          <CodePill>{variation.code}</CodePill>
          {/* The child product this variation shipped for, and its own ClickUp task. */}
          {variation.productName && (
            <span className="text-ink-muted text-micro">{variation.productName}</span>
          )}

          {/* The child's own listing, beside the name it goes by (§2.2b). */}
          {variation.asinCode && (
            <CodePill label="ASIN" title="This variation's own listing">
              {variation.asinCode}
            </CodePill>
          )}
          {variation.clickupTaskId && (
            <CodePill label="ClickUp" title="ClickUp task">
              {variation.clickupTaskId}
            </CodePill>
          )}
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

        {/*
          Not gated on the period lock any more (owner, 2026-09-29). Rework
          arrives on old jobs, and a round carries its own date — so adding one
          to a closed month's delivery is not touching that month. The server
          checks the ROUND's month instead, and refuses a date inside a closed
          one.
        */}
        {!adding && (
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
        <RoundStrip rounds={variation.revisionRounds} />
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

/**
 * The priced breakdown for one delivery, for an admin.
 *
 * Rendered as nothing at all for a PM — not a locked panel or an "ask an admin"
 * message, which would only advertise a number they cannot have. The query does
 * not even run: `enabled` is false, so a PM's browser never asks the API for a
 * price and never gets a 403 in its console for a screen it did nothing wrong
 * on.
 */
function PriceForTask({ task }: { task: TaskDetail }) {
  const { user } = useSession()
  const admin = isAdmin(user)

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'pricing', 'task', task.id],
    queryFn: () => getTaskPricing(task.id, task.deliveredOn),
    enabled: admin,
  })

  if (!admin) return null

  return (
    /*
      A card beside the record, not a section under it.

      As a section at the bottom of a 52rem column it left the right half of the
      page empty and buried the number beneath everything else. Sticky, so the
      total stays put while the variations and the edit history scroll past — it
      is the thing being looked up and should not have to be scrolled back to.
    */
    <aside className="border-rule bg-surface shadow-card mt-10 rounded-xl border p-5 xl:sticky xl:top-24 xl:mt-0">
      <h2 className="text-ink-muted text-micro font-medium tracking-[0.06em] uppercase">
        What this was worth
      </h2>

      {/* The figure first and large: it is the reason to look here at all. */}
      {data && (
        <p className="mt-1.5 text-[1.75rem] leading-none tabular">
          {data.unpricedVariations === data.variations && data.variations > 0 ? (
            <span className="text-beyond text-dense">no rate set</span>
          ) : (
            formatMoneyMinor(data.totalMinor)
          )}
        </p>
      )}

      <p className="text-ink-faint mt-2 text-micro">
        Priced from the agency&rsquo;s rate card as it stands now. Nothing is stored on the
        delivery — change a rate and this recalculates.
      </p>

      {isLoading && <p className="text-ink-muted mt-4 text-micro">Pricing…</p>}

      {data ? (
        <>
          <div className="border-rule mt-4 border-t pt-3">
            <PriceBreakdown row={data} layout="stack" />
          </div>

          {/*
            Named, not silently dropped: work at a tier with no rate is counted
            and not priced, and a total that looked complete while omitting it
            is the one thing this must never do (§5.7).
          */}
          {data.unpricedVariations > 0 && (
            <p className="text-beyond mt-3 text-micro">
              {data.unpricedVariations} variation
              {data.unpricedVariations === 1 ? '' : 's'} not priced, so not counted.
            </p>
          )}

          <p className="text-ink-faint mt-3 text-micro">
            Allowance {data.allowanceSnapshot} free round
            {data.allowanceSnapshot === 1 ? '' : 's'} per variation when logged.
          </p>
        </>
      ) : (
        !isLoading && (
          <p className="text-ink-muted mt-4 text-micro">
            This delivery is outside every priced range, so there is nothing to show.
          </p>
        )
      )}
    </aside>
  )
}
