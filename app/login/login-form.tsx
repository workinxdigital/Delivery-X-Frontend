'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Field } from '@/components/field'
import { PrimaryButton } from '@/components/primary-button'
import { Input } from '@/components/ui/input'
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

  const mutation = useMutation({
    mutationFn: () => loginRequest(email.trim(), password),
    onSuccess: (user) => {
      // Seed the cache so the next screen does not flicker through its
      // unauthenticated state before the session query resolves.
      queryClient.setQueryData(['me'], user)
      const next = params.get('next')
      router.replace(next && next.startsWith('/') ? next : '/log')
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
        <div className="mb-7 flex items-center">
          <Image
            src="/workinx-logo.png"
            alt="WorkinX Digital"
            width={720}
            height={228}
            priority
            // 120px is the brand's stated minimum for legibility, which at this
            // artwork's 3.16:1 ratio makes it 38px tall.
            className="h-auto w-[120px]"
          />
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
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>

            {/*
              One message for every failure, matching the API. Saying which half
              was wrong would let someone work out who has an account here.

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
