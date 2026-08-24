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

/** Roles allowed to reach the admin screens. Mirrors requireAdmin on the API. */
export const isAdmin = (user: SessionUser | null) =>
  user?.role === 'ADMIN' || user?.role === 'OWNER'

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

  // Signing out anywhere should not leave another tab's cached data lying about.
  useEffect(() => {
    if (unauthenticated) queryClient.clear()
  }, [unauthenticated, queryClient])

  return (
    <SessionContext.Provider value={{ user, loading: isLoading }}>
      {children}
    </SessionContext.Provider>
  )
}
