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
  className,
}: {
  children?: React.ReactNode
  align?: 'right'
  className?: string
}) {
  return (
    <td
      className={cn('px-2 py-2.5 align-middle', align === 'right' && 'text-right', className)}
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
}: {
  children: React.ReactNode
  onClick?: () => void
  danger?: boolean
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit'
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
      )}
    >
      {children}
    </button>
  )
}

export function PrimaryButton({
  children,
  disabled,
  type = 'submit',
  onClick,
}: {
  children: React.ReactNode
  disabled?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="bg-action hover:bg-action-soft text-ink text-dense rounded-md px-3 py-1.5 font-medium transition-colors duration-[120ms] disabled:opacity-50"
    >
      {children}
    </button>
  )
}
