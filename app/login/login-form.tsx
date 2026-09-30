'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Logo } from '@/components/logo'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { ThemeToggle } from '@/components/theme-toggle'
import { Field } from '@/components/field'
import { PrimaryButton } from '@/components/primary-button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { homeFor, isClient } from '@/components/session'
import { ApiError, loginRequest } from '@/lib/api/client'

/**
 * The sign-in screen.
 *
 * The nav hides itself on this route, so this is the only place the company
 * mark appears before you are inside — hence the lockup at the top. It follows
 * the nav's own arrangement (WorkinX made this · DeliverX is what it is) so the
 * two screens read as one product rather than two designs.
 *
 * The form sits on a raised surface against the paper, centred in the viewport.
 * That is the whole treatment: this is a tool people open many times a day, and
 * DESIGN.md rejects decorative gradients and hero furniture. The one piece of
 * motion is a short entrance, skipped entirely for anyone who has asked their
 * system for reduced motion.
 */
export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const queryClient = useQueryClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  /*
   * No account list.
   *
   * A dropdown of everyone's email sat here between 2026-08-27 and 2026-08-28.
   * It was served publicly, because the login page has no session — so it
   * published the staff email list to anyone who opened the site, which is half
   * of every credential handed over before a password is typed. It went when
   * the login was hardened (§5.10). Do not put it back.
   */

  const mutation = useMutation({
    mutationFn: () => loginRequest(email.trim(), password),
    onSuccess: (user) => {
      // Seed the cache so the next screen does not flicker through its
      // unauthenticated state before the session query resolves.
      /*
       * Seed, then re-read.
       *
       * Seeding stops the next screen flickering through its signed-out state.
       * But the login response is a different endpoint from /auth/me, and when
       * the two drifted — login omitted `mustChangePassword` — the seeded copy
       * was missing the field that decides whether the password wall shows, so
       * a temporary password sailed past it into a dashboard the server was
       * refusing. Invalidating makes /auth/me the authority a moment later,
       * whatever login happened to return.
       */
      queryClient.setQueryData(['me'], user)
      void queryClient.invalidateQueries({ queryKey: ['me'] })
      /*
       * Where you land depends on who you are (§6.4).
       *
       * A `next` from the URL is only honoured when it belongs to this role: a
       * client bounced to /login from a stale /ledger link would otherwise be
       * sent straight back to a screen the API refuses them, and the redirect
       * loop reads as a broken sign-in rather than a screen that is not theirs.
       */
      const home = homeFor(user)
      const next = params.get('next')
      const allowed =
        next && next.startsWith('/') && (isClient(user) ? next.startsWith('/client') : !next.startsWith('/client'))
      router.replace(allowed ? next : home)
    },
    onError: (e) => {
      setError(
        e instanceof ApiError ? e.message : 'Could not sign in. Is the API running?',
      )
    },
  })

  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-2 py-8">
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 w-full max-w-[24rem] motion-safe:duration-300">
        {/* The nav is hidden on this route, so the toggle lives beside the
            mark — a preference should not require signing in first. */}
        <div className="mb-7 flex items-center justify-between gap-4">
          {/* 120px is the brand's stated minimum for legibility. */}
          <Logo priority className="w-[120px]" />
          <ThemeToggle />
        </div>

        <div className="border-rule bg-surface shadow-raised rounded-2xl border p-7">
          <h1 className="display text-[1.375rem] font-semibold">Sign in</h1>
          <p className="text-ink-muted mt-1 text-dense">
            Internal delivery log for WorkinX Digital.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              setError(null)
              mutation.mutate()
            }}
            className="mt-6 space-y-4"
          >
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="username"
                autoFocus
                placeholder="you@workinxdigital.us"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>

            <Field label="Password" htmlFor="password">
              <PasswordInput
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            {/*
              One message for every failure, matching the API.

              Account enumeration, again: saying which half was wrong would
              reveal who has an account here. Repeated failures also lock the
              account for a lengthening spell, and that message — the one case
              where the API says something specific — arrives through the same
              path as every other error.

              role="alert" so it is announced rather than only appearing, and it
              sits directly above the button where the eye already is after a
              failed submit.
            */}
            {error && (
              <p role="alert" className="text-danger text-micro">
                {error}
              </p>
            )}

            <PrimaryButton
              type="submit"
              size="md"
              disabled={!email || !password}
              pending={mutation.isPending}
              pendingLabel="Signing in"
              className="w-full"
            >
              Sign in
            </PrimaryButton>
          </form>
        </div>

        <p className="text-ink-faint mt-5 text-micro">
          No password? Run <span className="code">npm run set-password</span> in the API
          project to set one.
        </p>
      </div>
    </div>
  )
}
