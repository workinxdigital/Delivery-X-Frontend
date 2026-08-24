'use client'

import { useState } from 'react'
import { isAdmin, useSession } from '@/components/session'
import { cn } from '@/lib/utils'
import { AgenciesPanel } from './agencies-panel'
import { ServicesPanel } from './services-panel'

/**
 * People is deliberately absent.
 *
 * Accounts are managed outside this screen: everyone changes their own password
 * on /account, and a new account or a reset is done with `npm run set-password`
 * in the API project. The four accounts are fixed and rarely change, so a whole
 * admin panel for them was more surface than the job needed.
 */
const TABS = [
  { key: 'agencies', label: 'Agencies' },
  { key: 'services', label: 'Services' },
] as const

/**
 * Admin screen (§5.5).
 *
 * The role check here is a courtesy so a PM sees an explanation rather than a
 * screen full of 403s. The API refuses these routes on its own; this is not what
 * makes them safe.
 */
export function AdminScreen() {
  const { user, loading } = useSession()
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('agencies')

  if (loading) return null

  if (!isAdmin(user)) {
    return (
      <div className="max-w-[40rem]">
        <h1 className="display text-[1.5rem] font-semibold">Admin</h1>
        <p className="text-ink-muted mt-2 text-dense">
          This section needs admin or owner access. You are signed in as{' '}
          {user?.role.toLowerCase()}, so nothing here is available to you. Ask an admin
          if you need a change to the agencies or the service catalogue.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="border-rule mb-6 border-b pb-5">
        <h1 className="display text-[1.5rem] font-semibold">Admin</h1>
        <p className="text-ink-muted mt-1 text-dense">
          Master data. Everything changed here is written to the audit log.
        </p>
      </div>

      <div className="border-rule mb-6 flex items-stretch gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
            className={cn(
              'relative px-3 pb-2.5 text-dense transition-colors duration-[120ms]',
              tab === t.key
                ? 'text-ink after:bg-ink font-medium after:absolute after:inset-x-3 after:-bottom-px after:h-px'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'agencies' && <AgenciesPanel />}
      {tab === 'services' && <ServicesPanel />}
    </div>
  )
}
