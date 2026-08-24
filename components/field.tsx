import { cn } from '@/lib/utils'

/**
 * One labelled control.
 *
 * Spacing rhythm is deliberate: 6px from label to control, and the caller
 * spaces fields 16px apart inside a band, 28px between bands. Uniform spacing
 * everywhere is what made the first version of this form read as a government
 * form (DESIGN.md).
 *
 * `optional` marks the field in the label row, so the helper line underneath is
 * free to say something useful instead of repeating the word "Optional".
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  optional,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  optional?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-small text-ink font-medium">
          {label}
        </label>
        {optional && <span className="text-ink-faint text-micro">optional</span>}
      </div>

      {children}

      {/* Error replaces hint rather than stacking, so the row never jumps. */}
      {(error || hint) && (
        <p className={cn('text-micro', error ? 'text-danger' : 'text-ink-muted')}>
          {error || hint}
        </p>
      )}
    </div>
  )
}

/**
 * A band of related fields with a quiet heading.
 *
 * This is what turns ten identical stacked inputs into three glanceable
 * decisions: who it is for, what shipped, when and who.
 */
export function Band({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('grid gap-x-6 gap-y-4 sm:grid-cols-[9rem_1fr]', className)}>
      {/*
        A brand eyebrow rather than a grey sub-heading: uppercase, tracked, with
        a lime mark beside it. Lime is WorkinX's identity colour and its stated
        job is exactly this — eyebrows and marks — while being useless as text
        on paper, where it has almost no contrast. So it fills a shape and the
        label stays ink.
      */}
      <h2 className="flex items-center gap-2 pt-1.5">
        <span aria-hidden className="bg-lime h-3 w-1 shrink-0 rounded-full" />
        <span className="text-micro text-ink-muted font-medium tracking-[0.08em] uppercase">
          {title}
        </span>
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
