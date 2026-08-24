'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Combobox } from '@/components/combobox'
import { Field } from '@/components/field'
import { Pill } from '@/components/pill'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  createAgency,
  deleteAgency,
  getAdminAgencies,
  updateAgency,
} from '@/lib/api/client'
import type { AdminAgency } from '@/lib/api/types'
import { GhostButton, PanelHeader, PrimaryButton, Td, Th } from './panel-parts'

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
      toast(`${r.agency.name} added`)
      setDraft(EMPTY)
      setAdding(false)
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
    mutationFn: (id: string) => deleteAgency(id),
    onSuccess: (r) => {
      toast(`${r.removed.name} deleted`)
      refresh()
    },
    onError,
  })

  return (
    <div>
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

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr className="border-rule-strong border-b">
              <Th>Name</Th>
              <Th>Kind</Th>
              <Th>Free revisions</Th>
              <Th>Status</Th>
              <Th align="right">Deliveries</Th>
              <Th align="right">Brands</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="text-ink-muted py-8 text-center text-micro">
                  Loading
                </td>
              </tr>
            )}

            {agencies.map((a) => (
              <tr key={a.id} className="border-rule hover:bg-wash border-b">
                <Td className="font-medium">{a.name}</Td>
                <Td>
                  <Pill tone={a.type === 'DIRECT' ? 'outline' : 'neutral'}>
                    {a.type === 'DIRECT' ? 'Direct' : 'Agency'}
                  </Pill>
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
                <Td align="right" className="tabular">
                  {a.taskCount}
                </Td>
                <Td align="right" className="tabular">
                  {a.brandCount}
                </Td>
                <Td align="right" control>
                  {/*
                    An agency with deliveries cannot be deleted: those records
                    would point at something this screen says is gone. The API
                    refuses it too (409 AGENCY_IN_USE) — this is the explanation,
                    not the enforcement.

                    Said in words rather than as a greyed-out button with a
                    tooltip. A disabled control tells you that you cannot do
                    something but not why, and on a touch screen there is no
                    hover to reveal the reason at all.
                  */}
                  {a.taskCount > 0 ? (
                    <span
                      className="text-ink-faint text-micro"
                      title={`${a.taskCount} deliveries reference this agency, so its history has to stay readable.`}
                    >
                      In use · set Inactive
                    </span>
                  ) : confirming === a.id ? (
                    <span className="inline-flex items-center gap-1">
                      <GhostButton
                        danger
                        disabled={remove.isPending}
                        onClick={() => {
                          remove.mutate(a.id)
                          setConfirming(null)
                        }}
                      >
                        {remove.isPending ? 'Deleting' : 'Confirm'}
                      </GhostButton>
                      <GhostButton onClick={() => setConfirming(null)}>Cancel</GhostButton>
                    </span>
                  ) : (
                    /* Master data, so a stray click should not remove it. */
                    <GhostButton danger onClick={() => setConfirming(a.id)}>
                      Delete
                    </GhostButton>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
