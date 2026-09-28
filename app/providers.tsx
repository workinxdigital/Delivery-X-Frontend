'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
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
    /*
     * Theme before data, because the theme has to be on <html> before anything
     * paints. next-themes was already a dependency — Sonner's toaster reads it —
     * but nothing ever provided it, so the dark palette in globals.css has been
     * written and unreachable. `attribute="class"` matches the @custom-variant
     * there; `defaultTheme="system"` means an untouched browser follows the OS.
     *
     * disableTransitionOnChange stops every coloured element animating at once
     * when the theme flips, which reads as a glitch rather than a transition.
     */
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={client}>
        <SessionProvider>{children}</SessionProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
