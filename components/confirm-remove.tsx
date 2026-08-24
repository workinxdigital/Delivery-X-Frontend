'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'

/**
 * Confirmation for removing a delivery.
 *
 * A dialog rather than a two-step button, because this is destructive enough to
 * deserve the task code spelled out before it happens. The reason is optional
 * and goes onto the audit entry, so a removal can be explained later.
 *
 * Says plainly that nothing is erased: the ledger is append-first, so this only
 * stops the row appearing (§4.2). Overstating it would make people afraid of a
 * reversible action.
 */
export function ConfirmRemove({
  taskCode,
  pending,
  onCancel,
  onConfirm,
}: {
  taskCode: string
  pending: boolean
  onCancel: () => void
  onConfirm: (reason: string | null) => void
}) {
  const [reason, setReason] = useState('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Remove ${taskCode}`}
    >
      <button
        type="button"
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 bg-ink/25"
      />

      <div className="bg-surface border-rule-strong relative w-full max-w-sm rounded-lg border p-5 shadow-[0_16px_48px_-12px_oklch(0.22_0.012_60_/_28%)]">
        <h2 className="text-dense font-medium">
          Remove <span className="code">{taskCode}</span>?
        </h2>
        <p className="text-ink-muted mt-1.5 text-micro">
          It stops appearing in the ledger, the counts and the export. Nothing is
          erased: the record, its variations and its history are kept, and the removal
          is itself logged.
        </p>

        <div className="mt-4 space-y-1.5">
          <label htmlFor="remove-reason" className="text-ink-muted text-micro">
            Reason, optional
          </label>
          <Input
            id="remove-reason"
            autoFocus
            value={reason}
            placeholder="Why is it being removed"
            onChange={(e) => setReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onConfirm(reason.trim() || null)
              if (e.key === 'Escape') onCancel()
            }}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => onConfirm(reason.trim() || null)}
            className="bg-danger text-dense rounded-md px-3 py-1.5 font-medium text-white transition-opacity duration-[120ms] hover:opacity-90 disabled:opacity-50"
          >
            {pending ? 'Removing' : 'Remove'}
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
