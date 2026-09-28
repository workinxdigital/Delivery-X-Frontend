'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Light and dark.
 *
 * `resolvedTheme` rather than `theme`, because the default is "system": `theme`
 * would read "system" and the button could not say what it is about to do.
 * Toggling writes an explicit choice, which then stops following the OS — that
 * is the point of touching it.
 *
 * Nothing renders until mounted. The server has no idea which theme the browser
 * will resolve to, so rendering a sun on the server and a moon on the client is
 * a hydration mismatch; a placeholder of the same size keeps the header from
 * shifting while that resolves.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const dark = resolvedTheme === 'dark'
  const shape =
    'border-rule-strong text-ink-muted hover:text-ink hover:border-control hover:bg-wash flex size-[2.125rem] shrink-0 items-center justify-center rounded-full border transition-colors duration-[120ms]'

  if (!mounted) {
    // Same footprint, no icon: the row must not reflow when the icon appears.
    return <span aria-hidden className={cn(shape, 'pointer-events-none opacity-0', className)} />
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      // The label says the destination, not the current state — "Switch to
      // dark" is actionable where "Dark mode" is a riddle about which way it
      // goes.
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(shape, className)}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  )
}
