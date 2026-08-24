'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { isAdmin, useSession } from '@/components/session'
import { logoutRequest } from '@/lib/api/client'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/log', label: 'Log a delivery' },
  { href: '/ledger', label: 'Ledger' },
  { href: '/admin', label: 'Admin', adminOnly: true },
  { href: '/', label: 'Status' },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useSession()

  const logout = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      // Clear the cache before leaving, so nothing from this session is left
      // rendered behind the login screen.
      queryClient.clear()
      router.replace('/login')
    },
  })

  // The login screen has no navigation to offer.
  if (pathname === '/login') return null

  const links = LINKS.filter((l) => !l.adminOnly || isAdmin(user))

  return (
    <header className="border-rule bg-paper/90 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-10 px-6">
        <Link href="/log" className="flex items-baseline gap-2 py-3.5">
          <span className="text-[0.9375rem] font-semibold tracking-tight">DeliverX</span>
          <span className="text-ink-faint hidden text-small sm:inline">WorkinX Digital</span>
        </Link>

        <nav className="flex items-stretch self-stretch">
          {links.map((link) => {
            const active =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center px-3.5 text-dense transition-colors duration-[120ms]',
                  active
                    ? 'text-ink after:bg-ink font-medium after:absolute after:inset-x-3.5 after:-bottom-px after:h-px'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              {/* The role is shown because it decides what is reachable. */}
              <span className="text-ink-muted text-small">
                {user.name}
                <span className="text-ink-faint"> · {user.role.toLowerCase()}</span>
              </span>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="text-ink-faint hover:text-ink text-small transition-colors duration-[120ms] disabled:opacity-50"
              >
                {logout.isPending ? 'Signing out' : 'Sign out'}
              </button>
            </>
          ) : (
            <span className="text-ink-faint text-small">Not signed in</span>
          )}
        </div>
      </div>
    </header>
  )
}
