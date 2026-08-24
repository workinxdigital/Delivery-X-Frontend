'use client'

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
        'text-ink-muted px-2 pb-2 text-micro font-medium whitespace-nowrap',
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
}) {
  return (
    <td
      className={cn(
        'px-2 py-2.5 align-middle',
        align === 'right' ? 'text-right' : 'text-left',
        control && (align === 'right' ? 'pr-0' : 'pl-0'),
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
  className,
}: {
  children: React.ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit'
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
