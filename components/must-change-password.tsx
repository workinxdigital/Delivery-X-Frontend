'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Field } from '@/components/field'
import { Logo } from '@/components/logo'
import { PasswordInput } from '@/components/password-input'
import { PrimaryButton } from '@/components/primary-button'
import { useSession } from '@/components/session'
import { ApiError, changePassword } from '@/lib/api/client'

/**
 * The wall in front of an account that still has its issued password (§7).
 *
 * Rendered in place of the app rather than as a redirect: a redirect is a
 * suggestion, and while the browser is deciding what to do the screen behind it
 * has already asked for data. The server refuses everything but this form
 * anyway — this exists so a person sees a form rather than a page of errors.
 *
 * No "skip" and no dismiss. The password was typed by somebody else and is
 * known to at least two people; a wall you can walk around is not one.
 */
export function MustChangePassword() {
  const queryClient = useQueryClient()
  const { user } = useSession()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)

  const save = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: () => {
      /* The session already carries the flag, so the whole app has to re-read
         who you are before it can let you past. */
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (e) => setError(e instanceof ApiError ? e.message : 'That did not work'),
  })

  const mismatch = confirm.length > 0 && next !== confirm
  const tooShort = next.length > 0 && next.length < 10

  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center gap-6 px-6">
      <Logo className="w-[120px]" />

      <div className="border-rule bg-surface shadow-card rounded-xl border p-6">
        <h1 className="display text-[1.375rem] leading-tight font-semibold">
          Choose your own password
        </h1>
        <p className="text-ink-muted mt-1.5 text-dense">
          The password you were given was set by someone else, so it is known to more than one
          person. Pick a new one and nothing else changes.
        </p>

        <form
          className="mt-5 grid gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            setError(null)
            save.mutate()
          }}
        >
          <Field label="The password you were given">
            <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </Field>

          <Field
            label="New password"
            hint="At least 10 characters."
            error={tooShort ? 'Use at least 10 characters.' : undefined}
          >
            <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </Field>

          <Field label="New password again" error={mismatch ? 'These do not match.' : undefined}>
            <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </Field>

          {error && <p className="text-beyond text-dense">{error}</p>}

          <PrimaryButton
            type="submit"
            disabled={save.isPending || !current || next.length < 10 || next !== confirm}
          >
            {save.isPending ? 'Saving' : 'Save and continue'}
          </PrimaryButton>
        </form>
      </div>

      <p className="text-ink-muted text-center text-micro">
        Signed in as {user?.email}
      </p>
    </div>
  )
}
