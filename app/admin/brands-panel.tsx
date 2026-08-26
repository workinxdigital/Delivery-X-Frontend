'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Combobox } from '@/components/combobox'
import { Field } from '@/components/field'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  createBrand,
  deleteBrand,
  getAdminAgencies,
  getAdminBrands,
  renameBrand,
} from '@/lib/api/client'
import { GhostButton, PanelHeader, PrimaryButton, Td, Th } from './panel-parts'

/**
 * Brand management (§2.2, §5.5).
 *
 * Brands are not master data — a PM types one on the logging form and it is
 * created on save. So this screen is not how they normally appear; it is how
 * they get corrected. Renaming a misspelling is the common case, since the wrong
 * spelling is otherwise permanent and quietly splits one client's history in
 * two.
 */
export function BrandsPanel() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ agencyId: '', name: '' })
  const [editing, setEditing] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)
  const [filterAgency, setFilterAgency] = useState('')

  const { data: agencies = [] } = useQuery({
    queryKey: ['admin', 'agencies'],
    queryFn: getAdminAgencies,
  })
  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['admin', 'brands', filterAgency],
    queryFn: () => getAdminBrands(filterAgency || undefined),
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] })
    // The logging form's brand autocomplete reads the same rows.
    void queryClient.invalidateQueries({ queryKey: ['brands'] })
    void queryClient.invalidateQueries({ queryKey: ['admin', 'agencies'] })
  }

  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : 'That did not work')

  const create = useMutation({
    mutationFn: () => createBrand({ agencyId: draft.agencyId, name: draft.name.trim() }),
    onSuccess: (r) => {
      toast(`${r.brand.name} added`)
      setDraft({ agencyId: draft.agencyId, name: '' })
      setAdding(false)
      refresh()
    },
    onError,
  })

  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameBrand(id, name),
    onSuccess: (r) => {
      toast(`Renamed to ${r.brand.name}`)
      setEditing(null)
      refresh()
    },
    onError,
  })

  const remove = useMutation({
    mutationFn: ({ id, force }: { id: string; force: boolean }) => deleteBrand(id, force),
    onSuccess: (r) => {
      toast(`${r.removed.name} deleted`, {
        description:
          r.removed.tasksRemoved > 0
            ? `Also removed: ${r.removed.tasksRemoved} deliveries`
            : undefined,
      })
      refresh()
    },
    onError,
  })

  const agencyOptions = agencies.map((a) => ({ value: a.id, label: a.name }))

  return (
    <div>
      <PanelHeader
        title="Brands"
        note="Brands appear on their own when a PM types one while logging. This is where a misspelling gets renamed — otherwise one client's history quietly splits in two."
        action={
          !adding && (
            <PrimaryButton type="button" onClick={() => setAdding(true)}>
              Add brand
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
          className="border-rule bg-wash/40 mb-6 grid gap-4 rounded-xl border p-4 sm:grid-cols-2"
        >
          <Field label="Agency">
            <Combobox
              options={agencyOptions}
              value={draft.agencyId}
              clearable={false}
              placeholder="Which agency"
              searchPlaceholder="Search agencies"
              onChange={(v) => setDraft({ ...draft, agencyId: v })}
            />
          </Field>

          <Field label="Brand name">
            <Input
              autoFocus
              value={draft.name}
              placeholder="The company the work is for"
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </Field>

          <div className="flex items-center gap-3 sm:col-span-2">
            <PrimaryButton
              disabled={create.isPending || !draft.name.trim() || !draft.agencyId}
            >
              {create.isPending ? 'Adding' : 'Add brand'}
            </PrimaryButton>
            <GhostButton
              onClick={() => {
                setAdding(false)
                setDraft({ agencyId: '', name: '' })
              }}
            >
              Cancel
            </GhostButton>
          </div>
        </form>
      )}

      {/* Brands are scoped to an agency, so filtering by one is how you find
          anything once there are more than a screenful. */}
      <div className="mb-4 max-w-[18rem]">
        <Combobox
          options={agencyOptions}
          value={filterAgency}
          placeholder="All agencies"
          searchPlaceholder="Search agencies"
          onChange={setFilterAgency}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr className="border-rule bg-wash/60 border-b">
              <Th>Brand</Th>
              <Th>Agency</Th>
              <Th>Deliveries</Th>
              <Th>ASINs</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="text-ink-muted py-8 text-center text-micro">
                  Loading
                </td>
              </tr>
            )}

            {!isLoading && brands.length === 0 && (
              <tr>
                <td colSpan={5} className="text-ink-muted py-8 text-center text-micro">
                  No brands yet. They appear here as PMs log deliveries.
                </td>
              </tr>
            )}

            {brands.map((b) => (
              <tr key={b.id} className="border-rule hover:bg-wash border-b last:border-0">
                <Td control={editing === b.id}>
                  {editing === b.id ? (
                    <span className="flex items-center gap-1.5">
                      <Input
                        autoFocus
                        className="h-8 w-48"
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                      />
                      <GhostButton
                        disabled={rename.isPending || !nameDraft.trim()}
                        onClick={() => rename.mutate({ id: b.id, name: nameDraft.trim() })}
                      >
                        Save
                      </GhostButton>
                      <GhostButton onClick={() => setEditing(null)}>Cancel</GhostButton>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(b.id)
                        setNameDraft(b.name)
                      }}
                      className="hover:bg-wash -mx-1 rounded px-1 font-medium"
                      title="Rename this brand"
                    >
                      {b.name}
                    </button>
                  )}
                </Td>
                <Td className="text-ink-muted">{b.agencyName}</Td>
                <Td className="tabular">{b.taskCount}</Td>
                <Td className="tabular">{b.asinCount}</Td>
                <Td align="right" control>
                  {confirming === b.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      {b.taskCount > 0 && (
                        <span className="text-beyond text-micro">
                          Takes {b.taskCount} deliver{b.taskCount === 1 ? 'y' : 'ies'} with it.
                        </span>
                      )}
                      <GhostButton
                        danger
                        disabled={remove.isPending}
                        onClick={() => {
                          remove.mutate({ id: b.id, force: b.taskCount > 0 })
                          setConfirming(null)
                        }}
                      >
                        {remove.isPending ? 'Deleting' : 'Confirm'}
                      </GhostButton>
                      <GhostButton onClick={() => setConfirming(null)}>Cancel</GhostButton>
                    </span>
                  ) : (
                    <GhostButton danger onClick={() => setConfirming(b.id)}>
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
