'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Logo } from '@/components/logo'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ClientActivityBell } from '@/components/client-activity-bell'
import { NotificationCentre } from '@/components/notification-centre'
import { homeFor, isAdmin, isClient, useSession } from '@/components/session'
import { ThemeToggle } from '@/components/theme-toggle'
import { logoutRequest } from '@/lib/api/client'
import { cn } from '@/lib/utils'

const STAFF_LINKS = [
  { href: '/log', label: 'Log a delivery' },
  { href: '/ledger', label: 'Ledger' },
  { href: '/admin', label: 'Admin', adminOnly: true },
]

/**
 * A client's nav is its own, not the staff one with things removed (§6.4).
 *
 * Sharing the list and hiding items would leave a client one CSS mistake away
 * from seeing a link to the logging form — and a link they cannot use is worse
 * than no link, because it implies the screen is theirs.
 */
const CLIENT_LINKS = [
  { href: '/client', label: 'Overview' },
  { href: '/client/projects', label: 'Projects' },
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

  const client = isClient(user)
  const links = client
    ? CLIENT_LINKS
    : STAFF_LINKS.filter((l) => !l.adminOnly || isAdmin(user))
  const home = homeFor(user)

  return (
    /*
      The nav floats over the page as it scrolls, so it is glass — but a lighter
      pour than a popover: it spans the full width and sits behind everything,
      where a heavy blur would read as a smear rather than a surface.
    */
    <header className="border-rule bg-paper/85 sticky top-0 z-40 border-b backdrop-blur-md backdrop-saturate-150 dark:bg-paper/70">
      <div className="mx-auto flex w-full max-w-[1240px] items-stretch gap-6 px-6">
        {/*
          The company mark and the product name are two different things, so a
          rule separates them: WorkinX made this, DeliverX is what it is. The
          mark swaps to the white-X artwork in the dark, which is what the brand
          supplies that variant for.
        */}
        <div className="flex items-center gap-4 py-3">
          <Link href={home} className="flex items-center" aria-label="DeliverX home">
            {/* 120px wide is the brand's stated minimum for legibility. */}
            <Logo priority className="w-[120px]" />
          </Link>

          <span aria-hidden className="bg-rule h-6 w-px" />

          <Link href={home} className="display text-[0.9375rem] font-semibold">
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

        <div className="ml-auto flex items-center gap-2 py-3">
          {/* Outside the signed-in branch: the theme is a preference, not a
              privilege, and it should not vanish while the session loads. */}
          <ThemeToggle />

          {user ? (
            <>
              {/*
                Admin only (owner, 2026-08-29).

                The feed is a window onto audit_log — everything the team did.
                It was scoped so a PM saw only rows they were the actor on,
                which made it a list of things they had just done themselves:
                true, private, and of no use to anybody. Watching what the team
                shipped is an owner's job (§5.4), so the bell belongs with the
                rest of the admin surface. The API refuses the routes as well;
                this only avoids rendering a bell that would answer 403.
              */}
              {isAdmin(user) && <NotificationCentre />}
              {/* A client's counterpart: their own account activity (§4.4). */}
              {client && <ClientActivityBell />}

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
                  'hidden items-center gap-2 rounded-full border px-3 py-1.5 text-dense whitespace-nowrap transition-colors duration-[120ms] sm:inline-flex',
                  /*
                    Lime, filled.

                    Lime is identity in this system and this capsule is the one
                    place the product says who you are, so it takes the
                    signature colour outright. It was a wash fill before, which
                    could not work: --wash and --paper are two steps apart in
                    lightness, so it read as a smudge rather than a control.

                    Filled rather than lettered, and that is the rule — lime on
                    paper has almost no contrast as text. Its text is `noir`
                    rather than `ink` because ink inverts to near-white in dark
                    mode while the lime fill does not, and light text on lime is
                    unreadable in either theme.
                  */
                  pathname.startsWith('/account')
                    ? 'border-ink bg-ink text-paper'
                    : 'border-lime bg-lime text-noir hover:brightness-95',
                )}
              >
                {user.name}
              </Link>
              <button
                type="button"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
                // Same height and radius as the capsule beside it, so the two
                // read as a pair rather than two unrelated shapes.
                className="border-rule-strong text-ink-muted hover:text-ink hover:border-control hover:bg-wash rounded-full border px-3 py-1.5 text-dense transition-colors duration-[120ms] disabled:opacity-50"
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
