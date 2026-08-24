'use client'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/field'
import { Pill } from '@/components/pill'
import { useSession } from '@/components/session'
import { Input } from '@/components/ui/input'
import { ApiError, changePassword } from '@/lib/api/client'
import { PrimaryButton } from '@/components/primary-button'

const MIN_LENGTH = 10

/**
 * Your own account.
 *
 * Available to every role, unlike the admin People panel, which sets other
 * people's passwords. The difference is that this one demands your current
 * password, so a stolen session cannot be used to lock you out of your own
 * account.
 */
export function AccountScreen() {
  const { user, loading } = useSession()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () => changePassword(current, next),
    onSuccess: (result) => {
      toast('Password changed', {
        description:
          result.otherSessionsEnded > 0
            ? `You are still signed in here. ${result.otherSessionsEnded} other session${result.otherSessionsEnded === 1 ? '' : 's'} signed out.`
            : 'You are still signed in here.',
      })
      setCurrent('')
      setNext('')
      setConfirm('')
      setErrors({})
    },
    onError: (e) => {
      if (e instanceof ApiError && e.issues.length > 0) {
        setErrors(Object.fromEntries(e.issues.map((i) => [i.path, i.message])))
        return
      }
      // A wrong current password comes back as a plain message, and belongs on
      // that field rather than in a toast the user has to connect up themselves.
      if (e instanceof ApiError) {
        setErrors({ currentPassword: e.message })
        return
      }
      toast.error('Could not change the password')
    },
  })

  function submit() {
    const nextErrors: Record<string, string> = {}
    if (!current) nextErrors.currentPassword = 'Enter your current password'
    if (next.length < MIN_LENGTH) {
      nextErrors.newPassword = `Use at least ${MIN_LENGTH} characters`
    }
    if (next && confirm !== next) nextErrors.confirm = 'These two do not match'
    if (next && next === current) {
      nextErrors.newPassword = 'The new password is the same as the current one'
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    mutation.mutate()
  }

  if (loading || !user) return null

  return (
    <div className="max-w-[34rem]">
      <div className="border-rule mb-6 border-b pb-5">
        <h1 className="display text-[1.5rem] font-semibold">Your account</h1>
        <p className="text-ink-muted mt-1 text-dense">
          {user.name} · {user.email}
        </p>
      </div>

      <dl className="divide-rule mb-8 grid divide-y">
        <div className="grid gap-1 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
          <dt className="text-ink-muted text-dense">Role</dt>
          <dd>
            <Pill tone="neutral">{user.role}</Pill>
          </dd>
        </div>
        <div className="grid gap-1 py-2.5 sm:grid-cols-[9rem_1fr] sm:gap-4">
          <dt className="text-ink-muted text-dense">Email</dt>
          {/* Changing an email changes who signs in, so an admin does that. */}
          <dd className="text-dense">
            {user.email}
            <span className="text-ink-faint"> · an admin can change this</span>
          </dd>
        </div>
      </dl>

      <section className="border-rule border-t pt-6">
        <h2 className="text-dense font-medium">Change your password</h2>
        <p className="text-ink-muted mt-1 text-micro">
          Your current password is required. Changing it signs you out everywhere else
          but keeps you signed in here.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
          className="mt-4 space-y-4"
        >
          <Field
            label="Current password"
            htmlFor="current"
            error={errors.currentPassword}
          >
            <Input
              id="current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => {
                setCurrent(e.target.value)
                setErrors((x) => ({ ...x, currentPassword: '' }))
              }}
            />
          </Field>

          <Field
            label="New password"
            htmlFor="next"
            error={errors.newPassword}
            hint={`At least ${MIN_LENGTH} characters.`}
          >
            <Input
              id="next"
              type="password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => {
                setNext(e.target.value)
                setErrors((x) => ({ ...x, newPassword: '' }))
              }}
            />
          </Field>

          <Field label="New password again" htmlFor="confirm" error={errors.confirm}>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value)
                setErrors((x) => ({ ...x, confirm: '' }))
              }}
            />
          </Field>

          <PrimaryButton type="submit" pending={mutation.isPending} pendingLabel="Changing">
            Change password
          </PrimaryButton>
        </form>

        <p className="text-ink-faint mt-6 text-micro">
          Forgotten it entirely? Nothing here emails a reset link, so ask an admin to set
          a new one from the People panel.
        </p>
      </section>
    </div>
  )
}
