'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { SessionProvider } from '@/components/session'
import { ApiError } from '@/lib/api/client'

export function Providers({ children }: { children: React.ReactNode }) {
  // One client per browser session, created lazily so it is never shared
  // across requests during SSR.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // The dashboard polls on a 30s interval and refetches on focus
            // (CLAUDE.md §5.4). Per-query overrides handle the rest.
            refetchOnWindowFocus: true,
            staleTime: 10_000,
            // A 401 is an answer, not a blip, so do not retry into it.
            retry: (count, error) =>
              error instanceof ApiError && error.status === 401 ? false : count < 1,
          },
        },
      }),
  )

  return (
    <QueryClientProvider client={client}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  )
}
