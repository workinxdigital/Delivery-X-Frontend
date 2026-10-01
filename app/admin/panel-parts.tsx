'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/** Shared chrome for the admin panels, so the three read as one screen. */
export function PanelHeader({
  title,
  note,
  action,
}: {
  title: string
  note: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-dense font-medium">{title}</h2>
        <p className="text-ink-muted mt-0.5 text-micro">{note}</p>
      </div>
      {action}
    </div>
  )
}

export function Th({
  children,
  align,
}: {
  children?: React.ReactNode
  align?: 'right'
}) {
  return (
    <th
      scope="col"
      className={cn(
        /*
          Headings in the mono label voice used everywhere else, and with room
          to breathe. They were 12px sentence case at 8px padding, which read as
          another row of data rather than as the thing naming the columns.

          first/last padding matches the cells below, so the first column starts
          on the card's inner margin and the last one does not run into its edge
          — which is what was clipping the PDF link out of view.
        */
        'th-cell text-ink-muted px-3 pt-3 pb-2.5 text-micro font-medium tracking-[0.06em] whitespace-nowrap uppercase first:pl-4 last:pr-4',
        align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  align,
  control,
  className,
  title,
}: {
  children?: React.ReactNode
  align?: 'right'
  /**
   * Set when the cell's content is an inline button rather than plain text.
   *
   * The cell already pads by 8px, and the buttons inside these tables pad again
   * by their own 8px, so their label started 8px further in than the column
   * heading directly above it — every interactive column sat a few pixels off
   * its own header while the plain-text columns lined up. Pulling the cell's
   * padding back on the side the content is aligned to puts the label's edge
   * where the heading's edge is, without making the button's click target any
   * smaller.
   */
  control?: boolean
  className?: string
  /** Tooltip for a cell whose content is truncated or needs its basis stated. */
  title?: string
}) {
  return (
    <td
      title={title}
      className={cn(
        // Taller rows. At 10px vertical padding a table of eight rows was a
        // block of text; the extra height is what lets the eye track across a
        // row without a finger.
        'px-3 py-3.5 align-middle first:pl-4 last:pr-4',
        align === 'right' ? 'text-right' : 'text-left',
        control && (align === 'right' ? 'pr-1' : 'pl-1'),
        className,
      )}
    >
      {children}
    </td>
  )
}

export function GhostButton({
  children,
  onClick,
  danger,
  disabled,
  title,
  type = 'button',
  outlined,
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit'
  /**
   * Draw a border.
   *
   * A ghost button is text with a hover state, which reads as a control when it
   * sits in a strip of them — the row actions on the Agencies table say
   * "Brands Clients Money Rates Delete" and nobody mistakes those for labels.
   * On its own in a panel it has nothing to be read against, and "Record a
   * deposit" looked like a heading (owner, 2026-09-30). An outline is the
   * cheapest thing that says "this is a thing you press".
   */
  outlined?: boolean
  className?: string
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'text-micro rounded-md px-2 py-1 transition-colors duration-[120ms] disabled:cursor-not-allowed disabled:opacity-40',
        outlined && 'border-control border px-2.5',
        danger
          ? 'text-ink-muted hover:text-danger hover:bg-wash'
          : 'text-ink-muted hover:text-ink hover:bg-wash',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * Re-exported so the admin panels keep importing PrimaryButton from here.
 * The button itself now lives in one place for the whole app — this file used
 * to hold a second copy, which is how the admin CTAs stayed pink after the
 * sign-in button went black.
 */
export { PrimaryButton } from '@/components/primary-button'

/**
 * A panel that brings itself into view when it opens (owner, 2026-10-01).
 *
 * The agency panels — rates, money, brands, client logins — all render ABOVE
 * the agencies table, so opening one for a row far down the list inserted it
 * off the top of the screen: measured at 1036px above the viewport for an
 * agency halfway down the list. The browser's scroll anchoring held the ROW
 * still, which is the opposite of what is wanted — the thing just asked for is
 * the thing to look at. Nothing said the panel had opened, so it read as a
 * dead button until you happened to scroll up and find it.
 *
 * Scrolls on mount rather than on a state change, because mounting IS opening
 * here; closing and reopening the same panel scrolls again, which is right.
 * `scroll-mt` clears the sticky header.
 *
 * **The scroll anchoring has to be switched off, not out-raced.** Inserting a
 * panel above the viewport makes the browser hold the row you were looking at
 * still by pushing the scroll position down by the inserted height — and it
 * does that after every layout, so each of these panels, which fetch their
 * contents and therefore grow a moment after they mount, got shoved off the
 * top again as they filled in. Two earlier attempts lost that race: scrolling
 * on mount was undone at once, and scrolling again on a ResizeObserver was
 * undone by the next adjustment. Measured on staging: the rates panel 1036px
 * above the viewport, the money panel 476px.
 *
 * So `overflow-anchor: none` goes on the scroller for as long as a panel is
 * open, which is the one thing the browser offers for "I am moving this
 * viewport deliberately, stop helping". Scoped in TIME rather than shipped in
 * the stylesheet: anchoring is good behaviour everywhere else on the page, and
 * a counter keeps it off while any panel is open, since more than one can be.
 *
 * The scroll itself waits two frames and lands instantly. Instant because the
 * anchoring jump used to be followed by a smooth animation crawling back,
 * which in a throttled tab took seconds and read as a lurch; one step to the
 * thing just asked for is also what `prefers-reduced-motion` would want.
 */
let panelsOpen = 0

function holdScrollAnchoring() {
  panelsOpen += 1
  if (panelsOpen === 1) {
    document.documentElement.style.overflowAnchor = 'none'
    document.body.style.overflowAnchor = 'none'
  }
  return () => {
    panelsOpen = Math.max(0, panelsOpen - 1)
    if (panelsOpen === 0) {
      document.documentElement.style.removeProperty('overflow-anchor')
      document.body.style.removeProperty('overflow-anchor')
    }
  }
}

export function RevealOnOpen({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const release = holdScrollAnchoring()
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => el.scrollIntoView({ block: 'start', behavior: 'auto' })),
    )

    return () => {
      cancelAnimationFrame(frame)
      release()
    }
  }, [])

  return (
    <div ref={ref} className="scroll-mt-24">
      {children}
    </div>
  )
}
