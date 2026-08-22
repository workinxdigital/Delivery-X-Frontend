'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/log', label: 'Log a delivery' },
  { href: '/ledger', label: 'Ledger' },
  { href: '/', label: 'Status' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <header className="border-rule bg-paper/90 sticky top-0 z-40 border-b backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-10 px-6">
        <Link href="/log" className="flex items-baseline gap-2 py-3.5">
          <span className="text-[0.9375rem] font-semibold tracking-tight">DeliverX</span>
          <span className="text-ink-faint hidden text-small sm:inline">
            WorkinX Digital
          </span>
        </Link>

        <nav className="flex items-stretch self-stretch">
          {LINKS.map((link) => {
            const active =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex items-center px-3.5 text-dense transition-colors duration-[120ms]',
                  // The current section is marked by a rule under it, the way a
                  // tab in a ledger is marked. No pill, no fill.
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

        {/* Stated plainly rather than faking a user menu. Auth is step 0.4. */}
        <span className="text-ink-faint ml-auto text-small">No sign-in yet</span>
      </div>
    </header>
  )
}
