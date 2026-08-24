'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/field'
import { Pill } from '@/components/pill'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  createService,
  deleteService,
  getAdminServices,
  updateService,
} from '@/lib/api/client'
import type { AdminService } from '@/lib/api/types'
import { formatCategory } from '@/lib/format'
import { GhostButton, PanelHeader, PrimaryButton, Td, Th } from './panel-parts'

type Draft = { code: string; name: string; category: string; sortOrder: string }
const EMPTY: Draft = { code: '', name: '', category: '', sortOrder: '100' }

/** Derive a code from the name, so the admin does not have to invent one. */
function codeFromName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}

export function ServicesPanel() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  /** Which row is asking to confirm a delete. */
  const [confirming, setConfirming] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [codeTouched, setCodeTouched] = useState(false)

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['admin', 'services'],
    queryFn: getAdminServices,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'services'] })
    // The logging form and the ledger filter read the same catalogue.
    void queryClient.invalidateQueries({ queryKey: ['services'] })
  }

  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : 'That did not work')

  const create = useMutation({
    mutationFn: () =>
      createService({
        code: draft.code.trim() || codeFromName(draft.name),
        name: draft.name.trim(),
        category: draft.category.trim().toUpperCase().replace(/\s+/g, '_'),
        sortOrder: Number(draft.sortOrder),
      }),
    onSuccess: (r) => {
      toast(`${r.service.name} added to the catalogue`)
      setDraft(EMPTY)
      setCodeTouched(false)
      setAdding(false)
      refresh()
    },
    onError,
  })

  const save = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<AdminService> }) =>
      updateService(id, payload),
    onSuccess: refresh,
    onError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteService(id),
    onSuccess: (r) => {
      toast(`${r.removed.name} deleted`)
      refresh()
    },
    onError,
  })

  const categories = [...new Set(services.map((s) => s.category))].sort()

  return (
    <div>
      <PanelHeader
        title="Service catalogue"
        note="Data, not code: anything added here appears on the logging form immediately, with no deploy."
        action={
          !adding && (
            <PrimaryButton type="button" onClick={() => setAdding(true)}>
              Add service
            </PrimaryButton>
          )
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
              placeholder="Video — Unboxing"
              onChange={(e) => {
                const name = e.target.value
                setDraft((d) => ({
                  ...d,
                  name,
                  // Follows the name until the admin edits it themselves.
                  code: codeTouched ? d.code : codeFromName(name),
                }))
              }}
            />
          </Field>

          <Field
            label="Category"
            hint={categories.length ? `Existing: ${categories.map(formatCategory).join(', ')}` : undefined}
          >
            <Input
              value={draft.category}
              placeholder="VIDEO"
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </Field>

          <Field label="Code" hint="Capitals, numbers and underscores. Used in the export.">
            <Input
              value={draft.code}
              placeholder="VIDEO_UNBOXING"
              onChange={(e) => {
                setCodeTouched(true)
                setDraft({ ...draft, code: e.target.value.toUpperCase() })
              }}
            />
          </Field>

          <Field label="Sort order" hint="Lower appears first on the form.">
            <Input
              type="number"
              min={0}
              value={draft.sortOrder}
              onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
            />
          </Field>

          <div className="flex items-center gap-3 sm:col-span-2">
            <PrimaryButton
              disabled={create.isPending || !draft.name.trim() || !draft.category.trim()}
            >
              {create.isPending ? 'Adding' : 'Add service'}
            </PrimaryButton>
            <GhostButton
              onClick={() => {
                setAdding(false)
                setDraft(EMPTY)
                setCodeTouched(false)
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
              <Th>Code</Th>
              <Th>Category</Th>
              <Th align="right">Order</Th>
              <Th>On the form</Th>
              <Th align="right">Deliveries</Th>
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

            {services.map((s) => (
              <tr key={s.id} className="border-rule hover:bg-wash border-b">
                <Td className="font-medium">
                  {s.name}
                  {s.isBundle && (
                    <Pill tone="outline" className="ml-1.5">
                      bundle
                    </Pill>
                  )}
                </Td>
                <Td className="code text-ink-muted">{s.code}</Td>
                <Td className="text-ink-muted">{formatCategory(s.category)}</Td>
                <Td align="right" className="tabular">
                  {s.sortOrder}
                </Td>
                <Td control>
                  <GhostButton
                    onClick={() => save.mutate({ id: s.id, payload: { active: !s.active } })}
                    title={
                      s.active
                        ? 'Stop offering this for new deliveries. History stays readable.'
                        : 'Offer this on the logging form again'
                    }
                  >
                    {s.active ? 'Offered' : 'Retired'}
                  </GhostButton>
                </Td>
                <Td align="right" className="tabular">
                  {s.taskCount}
                </Td>
                <Td align="right" control>
                  {/*
                    Same rule as agencies: a service with deliveries logged
                    against it cannot be deleted, because those records would
                    point at something this screen says is gone. Switching it off
                    takes it out of the logging form and keeps the history
                    readable. Stated in words — a greyed-out button explains
                    nothing, and on a touch screen its tooltip never appears.
                  */}
                  {s.taskCount > 0 ? (
                    <span
                      className="text-ink-faint text-micro"
                      title={`${s.taskCount} deliveries reference this service, so its history has to stay readable.`}
                    >
                      In use · switch off
                    </span>
                  ) : confirming === s.id ? (
                    <span className="inline-flex items-center gap-1">
                      <GhostButton
                        danger
                        disabled={remove.isPending}
                        onClick={() => {
                          remove.mutate(s.id)
                          setConfirming(null)
                        }}
                      >
                        {remove.isPending ? 'Deleting' : 'Confirm'}
                      </GhostButton>
                      <GhostButton onClick={() => setConfirming(null)}>Cancel</GhostButton>
                    </span>
                  ) : (
                    <GhostButton danger onClick={() => setConfirming(s.id)}>
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
