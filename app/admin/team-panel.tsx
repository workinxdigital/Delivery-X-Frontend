'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/field'
import { Input } from '@/components/ui/input'
import {
  ApiError,
  createDeliverer,
  deleteDeliverer,
  getAdminDeliverers,
} from '@/lib/api/client'
import { GhostButton, PanelHeader, PrimaryButton, Td, Th } from './panel-parts'

/**
 * The people who deliver work.
 *
 * Deliberately not accounts: nobody here needs an email, a password or a role
 * to have their name on a delivery. Names also appear on their own — typing one
 * on the logging form adds it — so this screen is for correcting the list rather
 * than building it.
 *
 * Removing a name is a soft delete. It stops being offered on the form, and
 * every delivery that names it keeps saying who delivered it. Removing the row
 * outright would blank the "delivered by" column on real records.
 */
export function TeamPanel() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [confirming, setConfirming] = useState<string | null>(null)

  const { data: people = [], isLoading } = useQuery({
    queryKey: ['admin', 'deliverers'],
    queryFn: getAdminDeliverers,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'deliverers'] })
    // The logging form reads the same list.
    void queryClient.invalidateQueries({ queryKey: ['deliverers'] })
  }

  const onError = (e: unknown) =>
    toast.error(e instanceof ApiError ? e.message : 'That did not work')

  const create = useMutation({
    mutationFn: () => createDeliverer(name.trim()),
    onSuccess: (r) => {
      toast(r.deliverer.created ? `${r.deliverer.name} added` : `${r.deliverer.name} is already on the list`)
      setName('')
      setAdding(false)
      refresh()
    },
    onError,
  })

  const remove = useMutation({
    mutationFn: (id: string) => deleteDeliverer(id),
    onSuccess: (r) => {
      toast(`${r.removed.name} removed`, {
        description:
          r.removed.keptDeliveries > 0
            ? `${r.removed.keptDeliveries} deliveries keep their name — only the form stops offering it.`
            : undefined,
      })
      refresh()
    },
    onError,
  })

  return (
    <div>
      <PanelHeader
        title="Team"
        note="Who can be named as having delivered work. Not accounts — nobody here needs a login. Typing a new name while logging a delivery adds it too."
        action={
          !adding && (
            <PrimaryButton type="button" onClick={() => setAdding(true)}>
              Add person
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
          <Field label="Name">
            <Input
              autoFocus
              value={name}
              placeholder="First name is enough"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <div className="flex items-end gap-3">
            <PrimaryButton disabled={create.isPending || !name.trim()}>
              {create.isPending ? 'Adding' : 'Add person'}
            </PrimaryButton>
            <GhostButton
              onClick={() => {
                setAdding(false)
                setName('')
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
            <tr className="border-rule bg-wash/60 border-b">
              <Th>Name</Th>
              <Th>Deliveries</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={3} className="text-ink-muted py-8 text-center text-micro">
                  Loading
                </td>
              </tr>
            )}

            {!isLoading && people.length === 0 && (
              <tr>
                <td colSpan={3} className="text-ink-muted py-8 text-center text-micro">
                  Nobody on the list yet.
                </td>
              </tr>
            )}

            {people.map((p) => (
              <tr key={p.id} className="border-rule hover:bg-wash border-b last:border-0">
                <Td className="font-medium">{p.name}</Td>
                {/* Live deliveries only. A count that included deleted ones
                    once claimed seven deliveries against an empty ledger. */}
                <Td className="tabular">{p.taskCount}</Td>
                <Td align="right" control>
                  {confirming === p.id ? (
                    <span className="inline-flex items-center gap-1.5">
                      {p.taskCount > 0 && (
                        <span className="text-ink-muted text-micro">
                          {p.taskCount} deliver{p.taskCount === 1 ? 'y' : 'ies'} keep the name.
                        </span>
                      )}
                      <GhostButton
                        danger
                        disabled={remove.isPending}
                        onClick={() => {
                          remove.mutate(p.id)
                          setConfirming(null)
                        }}
                      >
                        {remove.isPending ? 'Removing' : 'Confirm'}
                      </GhostButton>
                      <GhostButton onClick={() => setConfirming(null)}>Cancel</GhostButton>
                    </span>
                  ) : (
                    <GhostButton danger onClick={() => setConfirming(p.id)}>
                      Remove
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
