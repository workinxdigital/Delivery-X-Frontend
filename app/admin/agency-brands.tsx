'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Combobox } from '@/components/combobox'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { getAdminBrands, mergeBrand } from '@/lib/api/client'
import { GhostButton, Td, Th } from './panel-parts'

/**
 * One agency's brands, and the merge that repairs a misspelling (§2.2, §5.5).
 *
 * Reached from the agency rather than from a tab of its own. The Brands tab was
 * removed because brands are not master data — a PM types one while logging and
 * it is created on save — and a tab listing them misled about where they come
 * from. That reasoning still holds; what it cost was the only way to repair a
 * name already on the ledger, which is what this is.
 *
 * It is a repair, not a management screen: no create, no rename, no delete. A
 * duplicate is always a duplicate WITHIN one client, so this only ever lists
 * one agency's brands and can only merge inside that list.
 */
export function AgencyBrands({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const queryClient = useQueryClient()
  /** Which brand is being merged away, and into which. */
  const [source, setSource] = useState<string | null>(null)
  const [target, setTarget] = useState('')
  const [confirming, setConfirming] = useState(false)

  const { data: brands = [], isLoading } = useQuery({
    queryKey: ['admin', 'brands', agencyId],
    queryFn: () => getAdminBrands(agencyId),
  })

  const merge = useMutation({
    mutationFn: ({ from, into }: { from: string; into: string }) => mergeBrand(from, into),
    onSuccess: (r) => {
      toast(`${r.source.name} is now ${r.target.name}`, {
        description:
          r.deliveriesMoved === 0
            ? 'It had no deliveries. The old spelling now resolves to the surviving brand.'
            : `${r.deliveriesMoved} deliver${r.deliveriesMoved === 1 ? 'y' : 'ies'} moved across. Typing the old spelling now lands on ${r.target.name}.`,
      })
      setSource(null)
      setTarget('')
      void queryClient.invalidateQueries({ queryKey: ['admin', 'brands', agencyId] })
      /* The ledger, the dashboard and pricing all name the brand. */
      void queryClient.invalidateQueries({ queryKey: ['tasks'] })
      void queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That did not work'),
  })

  const from = brands.find((b) => b.id === source)
  const into = brands.find((b) => b.id === target)

  if (isLoading) return <p className="text-ink-muted text-micro">Loading</p>

  if (brands.length === 0) {
    return (
      <p className="text-ink-muted text-micro">
        No brands yet. One is created the first time somebody logs a delivery for {agencyName}.
      </p>
    )
  }

  return (
    <div>
      {confirming && from && into && (
        <ConfirmDialog
          title={
            <>
              Merge {from.name} into {into.name}?
            </>
          }
          description={`Every delivery logged against "${from.name}" moves to "${into.name}", and the old name becomes an alias — a PM who types it again lands on "${into.name}" rather than creating the duplicate a second time.`}
          /* The number, because this moves history and the count is the size of
             what is moving. */
          consequence={
            from.taskCount > 0
              ? `Moves ${from.taskCount} deliver${from.taskCount === 1 ? 'y' : 'ies'}${from.asinCount > 0 ? ` and ${from.asinCount} ASIN${from.asinCount === 1 ? '' : 's'}` : ''}.`
              : undefined
          }
          confirmLabel="Merge"
          pendingLabel="Merging"
          pending={merge.isPending}
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            merge.mutate({ from: from.id, into: into.id })
            setConfirming(false)
          }}
        />
      )}

      <table className="w-full border-collapse text-dense">
        <thead>
          <tr className="border-rule-strong border-b">
            <Th>Brand</Th>
            <Th>Deliveries</Th>
            <Th>ASINs</Th>
            <Th />
          </tr>
        </thead>
        <tbody className="divide-rule divide-y">
          {brands.map((b) => (
            <tr key={b.id}>
              <Td className="font-medium">{b.name}</Td>
              <Td className="tabular">{b.taskCount}</Td>
              <Td className="tabular">{b.asinCount}</Td>
              <Td align="right" control>
                {source === b.id ? (
                  /*
                    The picker sits on the row being merged AWAY, because that is
                    the one you clicked and the one that disappears. Its own name
                    is excluded — a brand cannot be merged into itself, and
                    offering it would be offering a no-op.
                  */
                  <span className="flex items-center justify-end gap-1.5">
                    <span className="text-ink-muted text-micro">into</span>
                    <span className="w-56">
                    <Combobox
                      value={target}
                      onChange={setTarget}
                      options={brands
                        .filter((o) => o.id !== b.id)
                        .map((o) => ({ value: o.id, label: o.name }))}
                      placeholder="Pick the correct brand"
                    />
                    </span>
                    <GhostButton disabled={!target} onClick={() => setConfirming(true)}>
                      Merge
                    </GhostButton>
                    <GhostButton
                      onClick={() => {
                        setSource(null)
                        setTarget('')
                      }}
                    >
                      Cancel
                    </GhostButton>
                  </span>
                ) : (
                  <GhostButton
                    disabled={brands.length < 2}
                    onClick={() => {
                      setSource(b.id)
                      setTarget('')
                    }}
                    title={
                      brands.length < 2
                        ? 'There is nothing to merge this into yet'
                        : `Fold ${b.name} into another brand and keep its deliveries`
                    }
                  >
                    Merge away
                  </GhostButton>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
