'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field } from '@/components/field'
import { Pill } from '@/components/pill'
import { EmailLocalInput } from '@/components/email-local-input'
import { Input } from '@/components/ui/input'
import { CLIENT_EMAIL_DOMAIN, clientEmailLocal } from '@/lib/default-password'
import {
  createClientUser,
  getAdminBrands,
  getClientUsers,
  revokeClientUser,
} from '@/lib/api/client'
import { formatTimestamp } from '@/lib/format'
import { cn } from '@/lib/utils'
import { GhostButton, PrimaryButton, Td, Th } from './panel-parts'

/**
 * Who from the client's side can sign in, and what they see (§6.5).
 *
 * Deliberately not the Team tab's shape. A Team member is one of ours and gets
 * a login as a convenience; a client contact is an outsider, so the two things
 * that matter are which ACCOUNT they read and which BRANDS of it — and both are
 * stated on the row rather than buried in an edit form.
 *
 * No self-serve invite in v1: an admin issues the credential and passes it on.
 */
export function AgencyClients({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  /**
   * The part before the @, editable (owner, 2026-10-01).
   *
   * The DOMAIN is the fixed half — it is a constant the server appends, so no
   * request can put a client account on a domain the company does not own. The
   * mailbox is a default, not a rule: it follows the scope until somebody
   * types over it, and then stops, which is how the Team form treats its own
   * mailbox (§5.5).
   */
  const [mailbox, setMailbox] = useState('')
  const [mailboxTouched, setMailboxTouched] = useState(false)
  const [brandIds, setBrandIds] = useState<string[]>([])
  const [revoking, setRevoking] = useState<string | null>(null)
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null)

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin', 'client-users', agencyId],
    queryFn: () => getClientUsers(agencyId),
  })
  const { data: brands = [] } = useQuery({
    queryKey: ['admin', 'brands', agencyId],
    queryFn: () => getAdminBrands(agencyId),
  })

  /*
   * What the server will issue, mirrored so the admin reads it before saving.
   * One brand names the login; several mean it reads more than one, so the
   * partner's own name is the honest label.
   */
  const scopedBrandName =
    brandIds.length === 1 ? (brands.find((b) => b.id === brandIds[0])?.name ?? null) : null
  const defaultMailbox = clientEmailLocal(scopedBrandName ?? agencyName)
  const effectiveMailbox = mailboxTouched ? mailbox : defaultMailbox
  const issuedEmail = effectiveMailbox ? `${effectiveMailbox}@${CLIENT_EMAIL_DOMAIN}` : ''

  const reset = () => {
    setAdding(false); setName(''); setPassword(''); setBrandIds([]); setMailbox(''); setMailboxTouched(false)
  }

  const create = useMutation({
    mutationFn: () =>
      createClientUser(agencyId, {
        name: name.trim(),
        emailLocal: effectiveMailbox,
        password,
        ...(brandIds.length > 0 ? { brandIds } : {}),
      }),
    onSuccess: (r) => {
      /*
       * Shown once, here, and never stored in the clear or written to the audit
       * log — the same treatment a Team login gets (§5.5). The admin passes it
       * on; there is no way to read it back.
       */
      setIssued({ email: r.user.email, password })
      reset()
      void queryClient.invalidateQueries({ queryKey: ['admin', 'client-users', agencyId] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That did not work'),
  })

  const revoke = useMutation({
    mutationFn: (id: string) => revokeClientUser(id),
    onSuccess: () => {
      toast('Access revoked', { description: 'Their sessions have ended and they can no longer sign in.' })
      setRevoking(null)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'client-users', agencyId] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'That did not work'),
  })

  const pending = users.find((u) => u.id === revoking)

  return (
    <div>
      {pending && (
        <ConfirmDialog
          title={<>Revoke access for {pending.name}?</>}
          description={`${pending.email} will be signed out immediately and will not be able to sign in again. Nothing they have seen is undone, and the account stays on record.`}
          confirmLabel="Revoke access"
          pendingLabel="Revoking"
          pending={revoke.isPending}
          onCancel={() => setRevoking(null)}
          onConfirm={() => revoke.mutate(pending.id)}
        />
      )}

      {issued && (
        <div className="border-rule bg-wash/60 mb-4 rounded-lg border p-4">
          <p className="text-dense font-medium">Pass these on now</p>
          <p className="text-ink-muted mt-1 text-micro">
            The password is shown once and is not stored anywhere you can read it back.
          </p>
          <dl className="mt-3 grid gap-1 text-dense sm:grid-cols-[auto_1fr] sm:gap-x-4">
            <dt className="text-ink-muted text-micro">Email</dt>
            <dd className="code">{issued.email}</dd>
            <dt className="text-ink-muted text-micro">Password</dt>
            <dd className="code">{issued.password}</dd>
          </dl>
          <GhostButton onClick={() => setIssued(null)}>Done</GhostButton>
        </div>
      )}

      {adding ? (
        <form
          className="border-rule bg-wash/40 mb-4 grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
          onSubmit={(e) => { e.preventDefault(); create.mutate() }}
        >
          <Field label="Their name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Priya Raman"
              autoFocus
            />
          </Field>
          <Field label="Their email">
            {/*
              Issued, not typed (owner, 2026-10-01).

              A client login now lives on a domain WorkinX owns, like a staff
              address does (§5.5) and for the same reason: no request can create
              an account on a domain the company does not control. It used to
              carry the CLIENT's own domain, which produced addresses nobody
              here could receive mail at.

              The server derives it, so the field shows what is about to be
              written rather than asking for it. The brand when the login is
              scoped to exactly one, otherwise the agency — so the address says
              what the credential can see.
            */}
            <EmailLocalInput
              value={effectiveMailbox}
              domain={CLIENT_EMAIL_DOMAIN}
              onChange={(v) => {
                setMailbox(v)
                setMailboxTouched(true)
              }}
            />
            <p className="text-ink-muted mt-1 text-micro">
              {scopedBrandName
                ? `Starts from ${scopedBrandName}, the one brand this login reads.`
                : `Starts from ${agencyName}, which is the whole account.`}{' '}
              The domain is fixed. One login per address — revoke the existing one to issue
              another.
            </p>
          </Field>

          <Field label="Starting password" hint="At least 10 characters. Shown once when you save.">
            <Input value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>

          <Field label="What they can see" hint="Leave all unticked for the whole account, including brands added later.">
            <div className="flex flex-wrap gap-2">
              {brands.length === 0 && (
                <span className="text-ink-muted text-micro">
                  No brands yet — they will see the whole account.
                </span>
              )}
              {brands.map((b) => {
                const on = brandIds.includes(b.id)
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBrandIds(on ? brandIds.filter((x) => x !== b.id) : [...brandIds, b.id])}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-micro transition-colors duration-[120ms]',
                      on ? 'border-ink bg-ink text-paper' : 'border-control hover:bg-wash',
                    )}
                  >
                    {b.name}
                  </button>
                )
              })}
            </div>
          </Field>

          <div className="flex items-center gap-2 sm:col-span-2">
            <PrimaryButton type="submit" disabled={create.isPending || !name.trim() || !issuedEmail || password.length < 10}>
              {create.isPending ? 'Creating' : 'Create login'}
            </PrimaryButton>
            <GhostButton type="button" onClick={reset}>Cancel</GhostButton>
          </div>
        </form>
      ) : (
        <div className="mb-3">
          {/* Outlined: it is the only action in the panel, so it has nothing
              to be read against and was landing as a heading (§ affordance,
              2026-09-30). */}
          <GhostButton outlined onClick={() => setAdding(true)}>
            Add a client login
          </GhostButton>
        </div>
      )}

      {isLoading ? (
        <p className="text-ink-muted text-micro">Loading</p>
      ) : users.length === 0 ? (
        <p className="text-ink-muted text-micro">
          Nobody at {agencyName} can sign in yet.
        </p>
      ) : (
        <table className="w-full border-collapse text-dense">
          <thead>
            <tr className="border-rule-strong border-b">
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Sees</Th>
              <Th>Last seen</Th>
              <Th />
            </tr>
          </thead>
          <tbody className="divide-rule divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <Td className="font-medium">
                  {u.name}
                  {!u.active && <Pill tone="outline" className="ml-1.5">revoked</Pill>}
                </Td>
                <Td className="text-ink-muted">{u.email}</Td>
                <Td>
                  {u.scope === 'ACCOUNT' ? (
                    <span className="text-ink-muted">the whole account</span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {u.brands.map((b) => <Pill key={b.id} tone="outline">{b.name}</Pill>)}
                    </span>
                  )}
                </Td>
                <Td className="text-ink-muted whitespace-nowrap">
                  {u.lastSeenAt ? formatTimestamp(u.lastSeenAt) : 'never'}
                </Td>
                <Td align="right" control>
                  {u.active && <GhostButton danger onClick={() => setRevoking(u.id)}>Revoke</GhostButton>}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
