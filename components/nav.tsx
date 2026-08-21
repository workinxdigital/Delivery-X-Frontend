'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const LINKS = [
  { href: '/log', label: 'Log a Delivery' },
  { href: '/ledger', label: 'Task Ledger' },
  { href: '/', label: 'Status' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <header className="border-border/60 bg-background/95 supports-backdrop-filter:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-8 px-6 py-3">
        <Link href="/log" className="flex items-baseline gap-2">
          <span className="text-base font-semibold tracking-tight">DeliverX</span>
          <span className="text-muted-foreground hidden text-xs sm:inline">
            WorkinX Digital
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {LINKS.map((link) => {
            const active =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm transition-colors',
                  active
                    ? 'bg-secondary text-secondary-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50',
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Auth is deferred (step 0.4). Stated plainly rather than faking a user menu. */}
        <div className="text-muted-foreground ml-auto text-xs">No sign-in yet</div>
      </div>
    </header>
  )
}
