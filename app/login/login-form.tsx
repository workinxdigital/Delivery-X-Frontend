'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { Field } from '@/components/field'
import { Input } from '@/components/ui/input'
import { ApiError, loginRequest } from '@/lib/api/client'

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
    <div className="mx-auto max-w-sm pt-16">
      <h1 className="display text-[1.5rem] font-semibold">DeliverX</h1>
      <p className="text-ink-muted mt-1 text-dense">
        Internal delivery log for WorkinX Digital. Sign in to continue.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          mutation.mutate()
        }}
        className="mt-8 space-y-4"
      >
        <Field label="Email" htmlFor="email">
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
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
          One message for every failure, matching the API. Saying which half was
          wrong would let someone work out who has an account here.
        */}
        {error && <p className="text-danger text-micro">{error}</p>}

        <button
          type="submit"
          disabled={mutation.isPending || !email || !password}
          className="bg-ink text-paper hover:bg-ink/90 text-dense w-full rounded-md px-3 py-2 font-medium transition-colors duration-[120ms] disabled:opacity-50"
        >
          {mutation.isPending ? 'Signing in' : 'Sign in'}
        </button>
      </form>

      <p className="text-ink-faint mt-8 text-micro">
        No password? An admin can set one, or run{' '}
        <span className="code">npm run set-password</span> in the API project.
      </p>
    </div>
  )
}
