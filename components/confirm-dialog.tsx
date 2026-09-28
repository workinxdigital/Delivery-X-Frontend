'use client'

import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'

/**
 * The confirmation for anything destructive.
 *
 * One dialog for every remove and delete in the product (owner, 2026-08-29).
 * The admin screens used a two-step button — the action turned into
 * "Confirm / Cancel" in place — which is cheap to build and wrong for this:
 * the second click lands where the first one was, so a double click removes a
 * thing, and a row of small text buttons is a poor place to explain what a
 * deletion takes with it. A dialog stops the hand, names the thing, and has
 * room for the consequence.
 *
 * `consequence` is for what else goes: an agency's deliveries, the name a
 * delivery keeps. `reason` adds an optional note that reaches the audit entry,
 * for the removals where explaining it later matters.
 */
export function ConfirmDialog({
  title,
  description,
  consequence,
  confirmLabel = 'Remove',
  pendingLabel = 'Removing',
  reason: wantsReason,
  pending,
  onCancel,
  onConfirm,
}: {
  /** Names the thing, so the dialog cannot be answered without reading it. */
  title: React.ReactNode
  description: React.ReactNode
  /** What else this takes with it, when it takes anything. */
  consequence?: React.ReactNode
  confirmLabel?: string
  pendingLabel?: string
  reason?: boolean
  pending: boolean
  onCancel: () => void
  onConfirm: (reason: string | null) => void
}) {
  const [reason, setReason] = useState('')
  const confirmRef = useRef<HTMLButtonElement>(null)

  /*
   * Escape closes, and focus starts on the dialog rather than wherever the
   * page left it — otherwise a keyboard user is confirming something they have
   * not been moved to.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    if (!wantsReason) confirmRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel, wantsReason])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* The scrim is a button so a click anywhere outside cancels, and so it
          is reachable and labelled rather than being a silent div. */}
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="bg-ink/25 absolute inset-0"
      />

      <div className="glass bg-surface border-rule-strong relative w-full max-w-sm rounded-lg border p-5 shadow-[0_16px_48px_-12px_oklch(0.22_0.012_60_/_28%)]">
        <h2 className="text-dense font-medium">{title}</h2>
        <p className="text-ink-muted mt-1.5 text-micro">{description}</p>

        {/* Coloured, because it is the part that is easy to skip and the part
            that cannot be undone by clicking again. */}
        {consequence && <p className="text-beyond mt-2 text-micro">{consequence}</p>}

        {wantsReason && (
          <div className="mt-4 space-y-1.5">
            <label htmlFor="confirm-reason" className="text-ink-muted text-micro">
              Reason, optional
            </label>
            <Input
              id="confirm-reason"
              autoFocus
              value={reason}
              placeholder="Why is it being removed"
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onConfirm(reason.trim() || null)
              }}
            />
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button
            ref={confirmRef}
            type="button"
            disabled={pending}
            onClick={() => onConfirm(reason.trim() || null)}
            className="bg-danger text-dense rounded-md px-3 py-1.5 font-medium text-white transition-opacity duration-[120ms] hover:opacity-90 disabled:opacity-50"
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-ink-muted hover:text-ink text-dense transition-colors duration-[120ms]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
