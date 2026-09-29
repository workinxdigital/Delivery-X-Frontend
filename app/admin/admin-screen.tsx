'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { isAdmin, useSession } from '@/components/session'
import { cn } from '@/lib/utils'
import { AgenciesPanel } from './agencies-panel'
import { DisputesPanel } from './disputes-panel'
import { PeriodsPanel } from './periods-panel'
import { PricingPanel } from './pricing-panel'
import { ServicesPanel } from './services-panel'
import { TeamPanel } from './team-panel'

/**
 * Team is the people who deliver work, not the accounts that can sign in.
 *
 * Login accounts are still managed outside this screen — everyone changes their
 * own password on /account, and creating one or resetting it is
 * `npm run set-password` in the API project. Those are fixed and rarely change.
 * The team list is neither: it grows as colleagues get named on deliveries.
 */
/*
 * No Brands tab.
 *
 * It was removed on 2026-08-29 at the owner's request. Brands were never master
 * data (§2.2) — a PM types one while logging and it is created on save — so the
 * tab existed only to correct the list after the fact: rename a misspelling,
 * remove a stray. In practice nobody went there, and a tab nobody opens is a
 * tab that misleads about where brands come from.
 *
 * The brand ENTITY is untouched. Deliveries still point at a brand row, the
 * ledger and the statement still name it, and the logging form still creates
 * one. See below for what this costs.
 */
const TABS = [
  { key: 'agencies', label: 'Agencies' },
  { key: 'services', label: 'Services' },
  { key: 'team', label: 'Team' },
  /*
     Labelled Billing, keyed pricing (owner, 2026-08-29).

     "Billing" is what the tab is for — what a partner owes for the month — and
     "Pricing" described the rate card, which lives on the agency and not here.
     The key stays `pricing` because it is what the API route, the query keys
     and the statement's own path are called; renaming those would be a churn of
     identifiers for a word nobody sees.
  */
  { key: 'pricing', label: 'Billing' },
  /*
    Closing a month is its own tab rather than a panel on Billing. Billing
    answers "what is this worth" and is read every day; closing a month happens
    once a month and freezes what Billing reports, so it does not belong beside
    a screen people skim (§5.6).
  */
  { key: 'periods', label: 'Months' },
  { key: 'disputes', label: 'Queries' },
] as const

/**
 * Admin screen (§5.5).
 *
 * The role check here is a courtesy so a PM sees an explanation rather than a
 * screen full of 403s. The API refuses these routes on its own; this is not what
 * makes them safe.
 */
type TabKey = (typeof TABS)[number]['key']

export function AdminScreen() {
  const { user, loading } = useSession()
  const router = useRouter()
  const params = useSearchParams()

  /**
   * The open tab lives in the URL, not in React state (owner, 2026-08-31).
   *
   * It was `useState`, so opening a delivery from Billing and pressing back
   * remounted this screen on its default tab — you left from Billing and
   * arrived at Agencies. The address is what the back button restores, so the
   * address has to know which tab you were on.
   *
   * Switching tabs REPLACES rather than pushes: a tab is a view of one screen,
   * not a place you travelled to, and pushing would make back walk through
   * every tab you had glanced at before leaving the screen.
   */
  const requested = params.get('tab')
  const tab: TabKey =
    (TABS.find((t) => t.key === requested)?.key as TabKey | undefined) ?? 'agencies'

  const setTab = (next: TabKey) =>
    router.replace(next === 'agencies' ? '/admin' : `/admin?tab=${next}`, { scroll: false })

  if (loading) return null

  if (!isAdmin(user)) {
    return (
      <div className="max-w-[40rem]">
        <h1 className="display text-[1.5rem] font-semibold">Admin</h1>
        <p className="text-ink-muted mt-2 text-dense">
          This section needs admin access. You are signed in as{' '}
          {user?.role.toLowerCase()}, so nothing here is available to you. Ask an admin
          if you need a change to the agencies or the service catalogue.
        </p>
      </div>
    )
  }

  return (
    /*
      The wider measure, like the ledger (§5.11).

      The Billing tab's priced table is twelve columns; at the 1240px reading
      measure it overflowed, and what fell off the right edge was the Total and
      the chevron — so the one affordance saying a row opens was invisible, and
      the controls behind it unreachable.
    */
    <div data-measure="wide">
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
      {tab === 'team' && <TeamPanel />}
      {tab === 'pricing' && <PricingPanel />}
      {tab === 'periods' && <PeriodsPanel />}
      {tab === 'disputes' && <DisputesPanel />}
    </div>
  )
}
