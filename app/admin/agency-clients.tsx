'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Field } from '@/components/field'
import { Pill } from '@/components/pill'
import { Input } from '@/components/ui/input'
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
/**
 * The address to offer, built from the person and the agency.
 *
 * A guess, not a rule. Unlike a Team login — where the domain is a constant the
 * server appends and no request can change (§5.5) — a client's address belongs
 * to them, so this only fills the box in and every character stays editable.
 * `.com` because it is right more often than anything else is, and wrong is one
 * keystroke from right.
 */
function suggestedEmail(personName: string, agencyName: string): string {
  const local = slug(personName, '.')
  const domain = slug(agencyName, '')
  if (!local || !domain) return ''
  return `${local}@${domain}.com`
}

/** Latin letters and digits only, so a name with punctuation cannot produce a malformed address. */
function slug(raw: string, join: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join(join)
}

export function AgencyClients({ agencyId, agencyName }: { agencyId: string; agencyName: string }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  /**
   * Whether the admin has typed over the suggested address (owner, 2026-10-01).
   *
   * The address is filled in from the person's name and the agency's —
   * `Priya Raman` at Canopy becomes `priya.raman@canopy.com` — and stops
   * tracking the moment anybody edits it, so correcting a domain is never
   * undone by the next keystroke in the name. The same rule the Team form uses
   * for its mailbox and password (§5.5).
   */
  const [emailTouched, setEmailTouched] = useState(false)
  const [password, setPassword] = useState('')
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

  const reset = () => {
    setAdding(false); setName(''); setEmail(''); setEmailTouched(false); setPassword(''); setBrandIds([])
  }

  const create = useMutation({
    mutationFn: () =>
      createClientUser(agencyId, {
        name: name.trim(),
        email: email.trim(),
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
              onChange={(e) => {
                setName(e.target.value)
                if (!emailTouched) setEmail(suggestedEmail(e.target.value, agencyName))
              }}
              placeholder="Priya Raman"
              autoFocus
            />
          </Field>
          <Field label="Their email">
            {/*
              A client's address is their own, on their own domain — unlike a
              Team login, where the server appends @workinxdigital.us and drops
              anything after an @ (§5.5). Getting that backwards would create
              client accounts on the company's domain.

              Filled in from their name and the agency's as a starting point
              (owner, 2026-10-01), and editable to the last character: the
              suggestion is a guess about somebody else's domain, which is a
              convenience and never a rule.
            */}
            <Input
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setEmailTouched(true)
              }}
              placeholder={suggestedEmail('priya raman', agencyName) || 'priya@theirbrand.com'}
              type="email"
            />
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
            <PrimaryButton type="submit" disabled={create.isPending || !name.trim() || !email.trim() || password.length < 10}>
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
