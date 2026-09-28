'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter } from 'next/navigation'
import { createContext, useContext, useEffect } from 'react'
import { ApiError, getMe } from '@/lib/api/client'
import type { SessionUser } from '@/lib/api/types'

const SessionContext = createContext<{
  user: SessionUser | null
  loading: boolean
}>({ user: null, loading: true })

export const useSession = () => useContext(SessionContext)

/**
 * Queries that belong to the signed-out state and must survive a cache clear.
 *
 * Empty since the login form's public account list was removed (§5.10) — kept
 * because the mechanism below still needs the distinction, and the next public
 * query would otherwise reintroduce the bug that made this list necessary: a
 * blanket `clear()` on 401 removed an in-flight unauthenticated query and left
 * it pending forever.
 */
const PUBLIC_QUERY_KEYS: string[] = []

/**
 * Who reaches the admin screens. Mirrors requireAdmin on the API.
 *
 * Two roles since 2026-08-28 (§5.10). This is a convenience, not the boundary:
 * the API refuses an admin route to a PM whatever the browser renders.
 */
export const isAdmin = (user: SessionUser | null) => user?.role === 'ADMIN'

/** A PM sees only their own deliveries, so some controls have nothing to offer. */
export const isPM = (user: SessionUser | null) => user?.role === 'PM'

/**
 * Session state, and the redirect to /login when there is none.
 *
 * The gate here is a convenience, not the security boundary: the API rejects
 * every request without a session regardless of what the browser thinks. Doing
 * it in the client too just avoids rendering a screen that would only fill with
 * errors.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const queryClient = useQueryClient()

  const { data: user = null, isLoading, isError, error } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    retry: false,
    // A 401 is an answer, not a failure to retry.
    staleTime: 60_000,
  })

  const unauthenticated = isError && error instanceof ApiError && error.status === 401

  useEffect(() => {
    if (isLoading) return
    if (unauthenticated && pathname !== '/login') {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
    if (user && pathname === '/login') router.replace('/log')
  }, [isLoading, unauthenticated, user, pathname, router])

  /**
   * Signing out anywhere should not leave another tab's cached data lying about.
   *
   * Everything EXCEPT the public queries, and that exception is load-bearing.
   * `clear()` used to wipe the whole cache the moment /auth/me answered 401 —
   * which is every visit to the login screen, not just a sign-out. Once the
   * login form gained a query of its own (the account dropdown), that query was
   * being deleted mid-flight: the fetch resolved into a query that no longer
   * existed, so its observer sat at "pending" forever and the field silently
   * fell back to a plain text box. Nothing errored, which is what made it hard
   * to see.
   *
   * Public data belongs to the signed-out state, so clearing it on becoming
   * signed out is wrong on its own terms as well as broken in practice.
   */
  useEffect(() => {
    if (!unauthenticated) return
    queryClient.removeQueries({
      predicate: (query) => !PUBLIC_QUERY_KEYS.includes(String(query.queryKey[0])),
    })
  }, [unauthenticated, queryClient])

  return (
    <SessionContext.Provider value={{ user, loading: isLoading }}>
      {children}
    </SessionContext.Provider>
  )
}
