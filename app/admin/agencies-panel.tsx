'use client'

import { ConfirmDialog } from '@/components/confirm-dialog'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Combobox } from '@/components/combobox'
import { Field } from '@/components/field'
import { AgencyTypePill } from '@/components/pill'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  createAgency,
  deleteAgency,
  getAdminAgencies,
  setBillingMode,
  updateAgency,
} from '@/lib/api/client'
import type { AdminAgency } from '@/lib/api/types'
import { cn } from '@/lib/utils'
import { AgencyBrands } from './agency-brands'
import { AgencyClients } from './agency-clients'
import { AgencyLedger } from './agency-ledger'
import { AgencyRates } from './agency-rates'
import { GhostButton, PanelHeader, PrimaryButton, RevealOnOpen, Td, Th } from './panel-parts'

/**
 * The four views an agency has, and what each one is called.
 *
 * Declared once so the tab strip inside the panel and the buttons on the row
 * cannot drift apart — they are the same four things reached two ways.
 */
type PanelKey = 'brands' | 'clients' | 'ledger' | 'rates'

const PANELS: { key: PanelKey; label: string; title: (name: string) => string; lede: React.ReactNode }[] = [
  {
    key: 'brands',
    label: 'Brands',
    title: (name) => `${name} brands`,
    lede: (
      <>
        Brands are created by typing one on the logging form, so a misspelling becomes its own
        brand and splits that client&rsquo;s history in two. Merging folds one into another, moves
        its deliveries across, and makes the old spelling resolve to the survivor from then on.
      </>
    ),
  },
  {
    key: 'clients',
    label: 'Clients',
    title: (name) => `${name} client logins`,
    lede: (
      <>
        Who on the client&rsquo;s side can sign in and read their own account. They see delivered
        work, revision rounds and&nbsp;— for brands you have switched money on for&nbsp;— what it
        cost. They can never see another account, another brand, or anything internal.
      </>
    ),
  },
  {
    key: 'ledger',
    label: 'Money',
    title: (name) => `${name} money`,
    lede: (
      <>
        Charges are written when a delivery or a revision round is logged, never typed here. Only
        deposits and adjustments are posted by hand, and both appear on the client&rsquo;s
        statement straight away.
      </>
    ),
  },
  {
    key: 'rates',
    label: 'Rates',
    title: (name) => `${name} rates`,
    lede: (
      <>
        What this agency pays, per service and tier. Nothing here is stored against a delivery, so
        changing a rate re-prices this agency&rsquo;s history rather than rewriting it, and saving
        one charges any delivery that was logged before the rate existed.
      </>
    ),
  },
]

const TYPES = [
  { value: 'AGENCY', label: 'Agency, brings us their clients' },
  { value: 'DIRECT', label: 'Direct, the brand itself' },
]

type Draft = {
  name: string
  type: 'AGENCY' | 'DIRECT'
  contactName: string
  contactEmail: string
  freeRevisionAllowance: string
}

const EMPTY: Draft = {
  name: '',
  type: 'AGENCY',
  contactName: '',
  contactEmail: '',
  freeRevisionAllowance: '3',
}

export function AgenciesPanel() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)
  /** Which row is asking to confirm a delete. */
  const [confirming, setConfirming] = useState<string | null>(null)
  const [allowanceDraft, setAllowanceDraft] = useState('')
  /**
   * Whose rates are open, and whether they were just created.
   *
   * Adding an agency is two steps now (owner, 2026-08-27): the details, then
   * what they pay. The second step opens by itself on a fresh agency, because
   * the rates cannot be set before the agency exists to hang them on — and an
   * admin who has just typed a partner's name is exactly the person who knows
   * what that partner pays.
   */
  /**
   * The one open panel: which agency, and which of its four views (owner, 2026-10-01).
   *
   * Four separate pieces of state until now, which is what made switching
   * views cost a journey. Each button lived only on the agency's ROW, and the
   * panel scrolls itself to the top of the screen — so an admin reading an
   * agency's client logins who then wanted its money had to scroll all the way
   * back down to that row to find the next button, worst of all for an agency
   * at the end of the list. One panel with its own tabs means the second view
   * is one click from the first, where you already are.
   */
  const [panelFor, setPanelFor] = useState<{
    id: string
    name: string
    mode: 'DEPOSIT' | 'POSTPAID'
    which: PanelKey
    /** Opened by itself straight after the agency was added (§5.5). */
    fresh: boolean
  } | null>(null)
  /**
   * The row a panel was opened from, so closing it puts you back (owner, 2026-10-01).
   *
   * The panels render above the table and now scroll themselves into view, so
   * the agency list ends up a screen or more below whatever is open. Setting
   * one agency's rates and then wanting another meant scrolling back down past
   * the whole panel to find the list again.
   */
  const [cameFrom, setCameFrom] = useState<string | null>(null)

  /** Open a view for an agency, remembering the row to come back to. */
  function openPanel(
    which: PanelKey,
    agency: { id: string; name: string; billingMode?: 'DEPOSIT' | 'POSTPAID' | null },
  ) {
    setCameFrom(agency.id)
    setPanelFor({
      id: agency.id,
      name: agency.name,
      mode: agency.billingMode ?? 'POSTPAID',
      which,
      fresh: false,
    })
  }

  /** Close it and go back to the row it was opened from. */
  function closePanels() {
    setPanelFor(null)
    const id = cameFrom
    setCameFrom(null)
    if (!id) return
    /* After paint, so the row is where it will be once the panel has gone. */
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        document
          .querySelector(`[data-agency-row="${id}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'auto' }),
      ),
    )
  }

  const { data: agencies = [], isLoading } = useQuery({
    queryKey: ['admin', 'agencies'],
    queryFn: getAdminAgencies,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'agencies'] })
    // The logging form and ledger filters read the same master data.
    void queryClient.invalidateQueries({ queryKey: ['agencies'] })
  }

  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : 'That did not work')

  const create = useMutation({
    mutationFn: () =>
      createAgency({
        name: draft.name.trim(),
        type: draft.type,
        contactName: draft.contactName.trim() || null,
        contactEmail: draft.contactEmail.trim() || null,
        freeRevisionAllowance: Number(draft.freeRevisionAllowance),
      }),
    onSuccess: (r) => {
      toast(`${r.agency.name} added`, { description: 'Now set what they pay — until you do, their deliveries are unpriced.' })
      setDraft(EMPTY)
      setAdding(false)
      setCameFrom(r.agency.id)
      setPanelFor({
        id: r.agency.id,
        name: r.agency.name,
        mode: r.agency.billingMode ?? 'POSTPAID',
        which: 'rates',
        fresh: true,
      })
      refresh()
    },
    onError,
  })

  const save = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AdminAgency> }) =>
      updateAgency(id, payload),
    onSuccess: () => {
      setEditing(null)
      refresh()
    },
    onError,
  })

  const remove = useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) => deleteAgency(id, force),
    onSuccess: (r) => {
      // Say what actually went, not just that something did — a forced delete
      // takes deliveries with it and that should never be a surprise.
      const also = [
        r.removed.tasksRemoved > 0 ? `${r.removed.tasksRemoved} deliveries` : null,
        r.removed.brandsRemoved > 0 ? `${r.removed.brandsRemoved} brands` : null,
      ].filter(Boolean)
      toast(`${r.removed.name} deleted`, {
        description: also.length > 0 ? `Also removed: ${also.join(' and ')}` : undefined,
      })
      refresh()
    },
    onError,
  })

  /**
   * Deposit or post-paid (§6.3.0).
   *
   * One ledger either way, so this is a label on the same entries rather than a
   * migration: a deposit account is a post-paid account that has credits on it.
   * Switching a client between them keeps every entry they already had.
   */
  const billing = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode: 'DEPOSIT' | 'POSTPAID' }) => setBillingMode(id, mode),
    onSuccess: (r) => {
      toast(
        r.agency.billingMode === 'DEPOSIT'
          ? 'Now a deposit account'
          : 'Now billed in arrears',
        {
          description:
            r.agency.billingMode === 'DEPOSIT'
              ? 'Their balance counts down from what they have paid in.'
              : 'Their balance counts up toward an invoice. Existing entries are untouched.',
        },
      )
      void queryClient.invalidateQueries({ queryKey: ['admin', 'agencies'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That did not work'),
  })

  const pending = agencies.find((a) => a.id === confirming)

  return (
    <div>
      {/*
        The most destructive thing on the screen: an agency's deliveries cannot
        stay in the ledger naming something this page says is gone, so they go
        with it. That belongs in a dialog with the count spelled out, not in a
        row of text buttons where a second click lands where the first one was.
      */}
      {pending && (
        <ConfirmDialog
          title={<>Delete {pending.name}?</>}
          description="It stops being offered when logging, and its rate card goes with it. Everything is soft-deleted, so it can be restored in the database — and adding the same name again restores it rather than making a second one."
          consequence={
            pending.taskCount > 0
              ? `Takes ${pending.taskCount} deliver${pending.taskCount === 1 ? 'y' : 'ies'}${
                  pending.brandCount > 0
                    ? ` and ${pending.brandCount} brand${pending.brandCount === 1 ? '' : 's'}`
                    : ''
                } with it.`
              : undefined
          }
          confirmLabel="Delete"
          pendingLabel="Deleting"
          pending={remove.isPending}
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            // force only when there is history to take along.
            remove.mutate({ id: pending.id, force: pending.taskCount > 0 })
            setConfirming(null)
          }}
        />
      )}

      <PanelHeader
        title="Agencies and direct clients"
        note="The allowance is how many revision rounds are within contract. It is a count of free rounds, not a rate."
        action={
          !adding && <PrimaryButton type="button" onClick={() => setAdding(true)}>Add agency</PrimaryButton>
        }
      />

      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            create.mutate()
          }}
          className="border-rule bg-wash/40 mb-6 grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
        >
          <Field label="Name">
            <Input
              autoFocus
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>

          <Field label="Kind">
            <Combobox
              options={TYPES}
              value={draft.type}
              clearable={false}
              onChange={(v) => setDraft({ ...draft, type: v as Draft['type'] })}
            />
          </Field>

          <Field label="Free revisions" hint="Rounds beyond this are flagged, never charged.">
            <Input
              type="number"
              min={0}
              value={draft.freeRevisionAllowance}
              onChange={(e) => setDraft({ ...draft, freeRevisionAllowance: e.target.value })}
            />
          </Field>

          <Field label="Contact" optional>
            <Input
              value={draft.contactName}
              placeholder="Name"
              onChange={(e) => setDraft({ ...draft, contactName: e.target.value })}
            />
          </Field>

          <div className="flex items-center gap-3 sm:col-span-2">
            <PrimaryButton disabled={create.isPending || !draft.name.trim()}>
              {create.isPending ? 'Adding' : 'Add agency'}
            </PrimaryButton>
            <GhostButton
              onClick={() => {
                setAdding(false)
                setDraft(EMPTY)
              }}
            >
              Cancel
            </GhostButton>
          </div>
        </form>
      )}

      {panelFor && (
        <RevealOnOpen>
          <section className="border-rule bg-wash/40 mb-6 rounded-lg border p-4">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-dense font-medium">
                  {panelFor.fresh
                    ? `What ${panelFor.name} pays`
                    : PANELS.find((p) => p.key === panelFor.which)!.title(panelFor.name)}
                </h3>
                <p className="text-ink-muted mt-0.5 max-w-prose text-micro">
                  {PANELS.find((p) => p.key === panelFor.which)!.lede}
                </p>
              </div>
              <GhostButton onClick={closePanels}>{panelFor.fresh ? 'Done' : 'Close'}</GhostButton>
            </div>

            {/*
              The four views, reachable from inside the panel (owner, 2026-10-01).

              Until now the only way to each one was its button on the agency's
              ROW, and the panel scrolls itself to the top of the screen — so
              reading an agency's client logins and then wanting its money meant
              scrolling the whole list back down to that row, worst of all for
              an agency at the end of it. The second view is now one click from
              the first.
            */}
            <div
              role="tablist"
              aria-label={`${panelFor.name} views`}
              className="border-rule mb-4 flex flex-wrap gap-1 border-b"
            >
              {PANELS.map((tab) => {
                const current = tab.key === panelFor.which
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={current}
                    onClick={() => setPanelFor({ ...panelFor, which: tab.key, fresh: false })}
                    className={cn(
                      'rounded-t-md px-3 py-1.5 text-dense transition-colors duration-[120ms] -mb-px border-b-2',
                      current
                        ? 'border-lime text-ink font-medium'
                        : 'text-ink-muted hover:text-ink border-transparent',
                    )}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {panelFor.which === 'brands' && (
              <AgencyBrands agencyId={panelFor.id} agencyName={panelFor.name} />
            )}
            {panelFor.which === 'clients' && (
              <AgencyClients agencyId={panelFor.id} agencyName={panelFor.name} />
            )}
            {panelFor.which === 'ledger' && (
              <AgencyLedger
                agencyId={panelFor.id}
                agencyName={panelFor.name}
                billingMode={panelFor.mode}
              />
            )}
            {panelFor.which === 'rates' && (
              <AgencyRates agencyId={panelFor.id} agencyName={panelFor.name} />
            )}
          </section>
        </RevealOnOpen>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr className="border-rule-strong border-b">
              <Th>Name</Th>
              <Th>Kind</Th>
              <Th>Free revisions</Th>
              <Th>Billing</Th>
              <Th>Status</Th>
              <Th>Deliveries</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={8} className="text-ink-muted py-8 text-center text-micro">
                  Loading
                </td>
              </tr>
            )}

            {agencies.map((a) => (
              <tr
                key={a.id}
                /* Closing a panel scrolls back to the row it was opened from. */
                data-agency-row={a.id}
                className="border-rule hover:bg-wash scroll-mt-24 border-b"
              >
                <Td className="font-medium">{a.name}</Td>
                <Td>
                  <AgencyTypePill type={a.type} />
                </Td>
                <Td control>
                  {editing === a.id ? (
                    <span className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        autoFocus
                        className="h-7 w-16"
                        value={allowanceDraft}
                        onChange={(e) => setAllowanceDraft(e.target.value)}
                      />
                      <GhostButton
                        onClick={() =>
                          save.mutate({
                            id: a.id,
                            payload: { freeRevisionAllowance: Number(allowanceDraft) },
                          })
                        }
                      >
                        Save
                      </GhostButton>
                      <GhostButton onClick={() => setEditing(null)}>Cancel</GhostButton>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(a.id)
                        setAllowanceDraft(String(a.freeRevisionAllowance))
                      }}
                      className="hover:bg-wash rounded px-2 tabular"
                      title="Change the allowance"
                    >
                      {a.freeRevisionAllowance}
                    </button>
                  )}
                </Td>
                <Td control>
                  {/* Two words, one click. The consequence is a label on the
                      same ledger, so it needs no dialog. */}
                  <GhostButton
                    onClick={() =>
                      billing.mutate({
                        id: a.id,
                        mode: (a.billingMode ?? 'POSTPAID') === 'DEPOSIT' ? 'POSTPAID' : 'DEPOSIT',
                      })
                    }
                    title={
                      (a.billingMode ?? 'POSTPAID') === 'DEPOSIT'
                        ? 'They prepay and draw down. Click to bill in arrears instead.'
                        : 'They are billed in arrears. Click to make this a deposit account.'
                    }
                  >
                    {(a.billingMode ?? 'POSTPAID') === 'DEPOSIT' ? 'Deposit' : 'In arrears'}
                  </GhostButton>
                </Td>

                <Td control>
                  <GhostButton
                    onClick={() =>
                      save.mutate({
                        id: a.id,
                        payload: { status: a.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
                      })
                    }
                    title={
                      a.status === 'ACTIVE'
                        ? 'Stop offering this on the logging form'
                        : 'Offer this on the logging form again'
                    }
                  >
                    {a.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </GhostButton>
                </Td>
                <Td className="tabular">
                  {a.taskCount}
                </Td>
                <Td align="right" control>
                  {/* Rates stay reachable after the agency was added. */}
                  {confirming !== a.id && (
                    <GhostButton
                      onClick={() =>
                        panelFor?.id === a.id && panelFor.which === 'brands'
                          ? closePanels()
                          : openPanel('brands', a)
                      }
                      title={`Merge a misspelled brand for ${a.name}`}
                    >
                      Brands
                    </GhostButton>
                  )}

                  {confirming !== a.id && (
                    <GhostButton
                      onClick={() =>
                        panelFor?.id === a.id && panelFor.which === 'clients'
                          ? closePanels()
                          : openPanel('clients', a)
                      }
                      title={`Who at ${a.name} can sign in`}
                    >
                      Clients
                    </GhostButton>
                  )}

                  {confirming !== a.id && (
                    <GhostButton
                      onClick={() =>
                        panelFor?.id === a.id && panelFor.which === 'ledger'
                          ? closePanels()
                          : openPanel('ledger', a)
                      }
                      title={`Deposits, adjustments and what ${a.name} has consumed`}
                    >
                      Money
                    </GhostButton>
                  )}

                  {confirming !== a.id && (
                    <GhostButton
                      onClick={() =>
                        panelFor?.id === a.id && panelFor.which === 'rates'
                          ? closePanels()
                          : openPanel('rates', a)
                      }
                      title={`What ${a.name} pays`}
                    >
                      Rates
                    </GhostButton>
                  )}

                  {/*
                    Delete asks in a dialog: an agency takes its deliveries with
                    it, which is not a consequence to explain in a strip of small
                    text buttons. Everything is soft-deleted, so it is
                    recoverable in the database rather than destroyed.
                  */}
                  <GhostButton danger onClick={() => setConfirming(a.id)}>
                    Delete
                  </GhostButton>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
