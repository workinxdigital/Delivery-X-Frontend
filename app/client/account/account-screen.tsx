'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/field'
import { PasswordInput } from '@/components/password-input'
import { Pill } from '@/components/pill'
import { ApiError, changePassword, getClientAccount } from '@/lib/api/client'

/**
 * The client's own access (§4.5): who can sign in, and your own password.
 *
 * Read-only on the people, because an admin issues access in v1. It exists so
 * "who at our end can see this" never needs an email — a question a client
 * should be able to answer for themselves.
 */
export function ClientAccountScreen() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['client', 'account'],
    queryFn: getClientAccount,
  })

  const save = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: (r) => {
      toast('Password changed', {
        description:
          r.otherSessionsEnded > 0
            ? `Signed out of ${r.otherSessionsEnded} other ${r.otherSessionsEnded === 1 ? 'place' : 'places'}.`
            : 'You are still signed in here.',
      })
      setCurrent(''); setNext(''); setConfirm('')
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'That did not work'),
  })

  if (isLoading || !data) {
    return <p className="text-ink-muted py-16 text-center text-dense">Loading</p>
  }

  const mismatch = confirm.length > 0 && next !== confirm

  return (
    <div className="space-y-8">
      <header>
        <h1 className="display text-[1.75rem] leading-tight font-semibold">Your access</h1>
        <p className="text-ink-muted mt-1 text-dense">
          {data.account.name} · {data.account.includedRounds} revision rounds included on each
          project
        </p>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="display mb-3 text-[1.0625rem] font-semibold">Who can see this account</h2>
          <ul className="border-rule bg-surface divide-rule shadow-card divide-y overflow-hidden rounded-xl border">
            {data.people.map((p) => (
              <li key={p.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.isYou && <Pill tone="outline">you</Pill>}
                  <span className="text-ink-muted ml-auto text-micro">{p.email}</span>
                </div>
                <p className="text-ink-muted mt-0.5 text-micro">
                  {p.scope === 'ACCOUNT'
                    ? 'Sees the whole account'
                    : `Sees ${p.brands.map((b) => b.name).join(', ')}`}
                </p>
              </li>
            ))}
          </ul>
          <p className="text-ink-muted mt-2 text-micro">
            {/* Says who to ask, rather than offering a control that does not exist. */}
            To add or remove someone, ask your project manager at WorkinX.
          </p>
        </div>

        <div>
          <h2 className="display mb-3 text-[1.0625rem] font-semibold">Change your password</h2>
          <form
            className="border-rule bg-surface shadow-card grid gap-4 rounded-xl border p-5"
            onSubmit={(e) => { e.preventDefault(); save.mutate() }}
          >
            <Field label="Current password">
              <PasswordInput
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <Field label="New password" hint="At least 10 characters.">
              <PasswordInput
                value={next}
                onChange={(e) => setNext(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="New password again" error={mismatch ? 'These do not match.' : undefined}>
              <PasswordInput
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <button
              type="submit"
              disabled={save.isPending || !current || next.length < 10 || next !== confirm}
              className="border-control hover:bg-wash rounded-md border px-3 py-1.5 text-dense disabled:opacity-45"
            >
              {save.isPending ? 'Saving' : 'Change password'}
            </button>
            <p className="text-ink-muted text-micro">
              Changing it signs you out everywhere else, so a password somebody else knows stops
              working the moment you replace it.
            </p>
          </form>
        </div>
      </section>
    </div>
  )
}
