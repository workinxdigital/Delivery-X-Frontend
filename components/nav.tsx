'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { isAdmin, useSession } from '@/components/session'
import { logoutRequest } from '@/lib/api/client'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/log', label: 'Log a delivery' },
  { href: '/ledger', label: 'Ledger' },
  { href: '/admin', label: 'Admin', adminOnly: true },
]

export function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useSession()

  const logout = useMutation({
    mutationFn: logoutRequest,
    onSuccess: () => {
      // Clear the cache before leaving, so nothing from this session stays
      // rendered behind the login screen.
      queryClient.clear()
      router.replace('/login')
    },
  })

  // The login screen has no navigation to offer.
  if (pathname === '/login') return null

  const links = LINKS.filter((l) => !l.adminOnly || isAdmin(user))

  return (
    <header className="border-rule bg-paper/95 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1240px] items-stretch gap-6 px-6">
        {/*
          The company mark and the product name are two different things, so a
          rule separates them: WorkinX made this, DeliverX is what it is. The
          logo is placed directly on the paper because this file is genuinely
          transparent, so the brand's dark-lockup workaround does not apply.
        */}
        <div className="flex items-center gap-4 py-3">
          <Link href="/log" className="flex items-center" aria-label="DeliverX home">
            <Image
              src="/workinx-logo.png"
              alt="WorkinX Digital"
              width={720}
              height={228}
              priority
              // 120px wide is the brand's stated minimum for legibility, which
              // at this artwork's 3.16:1 ratio makes it 38px tall.
              className="h-auto w-[120px]"
            />
          </Link>

          <span aria-hidden className="bg-rule h-6 w-px" />

          <Link href="/log" className="display text-[0.9375rem] font-semibold">
            DeliverX
          </Link>
        </div>

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
                  // Lime marks what you are looking at. It is drawn as a bar
                  // rather than coloured text, because lime on paper has almost
                  // no contrast: it identifies by filling, not by lettering.
                  active
                    ? 'text-ink after:bg-lime font-medium after:absolute after:inset-x-2.5 after:bottom-0 after:h-[3px] after:rounded-full'
                    : 'text-ink-muted hover:text-ink',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 py-3">
          {user ? (
            <>
              {/*
                One capsule, not a name with the role stacked underneath it.
                The two were usually saying the same thing twice — the admin
                account is called "Admin", so the header read "Admin / ADMIN" —
                and a two-line block sat awkwardly beside single-line nav items.

                The name is what identifies you and is what stays; the role is
                on the account page this links to, and in the tooltip here.
              */}
              <Link
                href="/account"
                title={`Signed in as ${user.name} · ${user.role.toLowerCase()}`}
                className={cn(
                  'hidden items-center rounded-full px-3 py-1 text-dense whitespace-nowrap transition-colors duration-[120ms] sm:inline-flex',
                  pathname.startsWith('/account')
                    ? 'bg-ink text-paper'
                    : 'bg-wash text-ink-muted hover:text-ink',
                )}
              >
                {user.name}
              </Link>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                className="border-control text-ink-muted hover:text-ink hover:bg-wash rounded-md border px-2.5 py-1.5 text-micro transition-colors duration-[120ms] disabled:opacity-50"
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
