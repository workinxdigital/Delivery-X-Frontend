'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { isClient, useSession } from '@/components/session'

/**
 * The client surface (§6.4).
 *
 * A gate on top of the session gate, and a convenience rather than the
 * boundary: the API refuses every `/client` route to a staff account and every
 * staff route to a client, whatever the browser renders. This exists so a
 * member of staff who follows a client link sees their own screens instead of
 * a page that fills with 403s.
 */
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading } = useSession()

  useEffect(() => {
    if (loading || !user) return
    if (!isClient(user)) router.replace('/log')
  }, [loading, user, router])

  if (loading) return null
  if (user && !isClient(user)) return null

  return <>{children}</>
}
