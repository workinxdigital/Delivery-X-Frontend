/**
 * The primary call to action, in one place.
 *
 * Every confirming action in the app — save a delivery, add a round, add an
 * agency, change a password, sign in — renders through this. They used to be
 * five separate copies of the same class string, which is how Sign in ended up
 * black while the rest stayed pink.
 *
 * Black, not the brand pink: the owner's call. Worth recording why it also
 * holds up — this is a data-entry tool where the CTA sits beside dense tabular
 * text all day, and ink carries far more contrast against paper (16.4:1) than
 * pink did (3.4:1, which failed on white lettering and needed dark text to
 * pass at all). The pink stays available in the palette for accents; it is no
 * longer what a button is made of.
 */
import { cn } from '@/lib/utils'

type Props = React.ComponentProps<'button'> & {
  /** `md` is the form-level action; `sm` sits inside a panel or a row. */
  size?: 'sm' | 'md'
  /** Shown in place of the label while a mutation is in flight. */
  pending?: boolean
  pendingLabel?: string
}

export function PrimaryButton({
  size = 'sm',
  pending = false,
  pendingLabel,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || pending}
      // aria-busy so a screen reader hears that the action is in flight,
      // rather than only seeing the label change.
      aria-busy={pending || undefined}
      className={cn(
        'bg-ink text-paper text-dense rounded-md font-medium',
        'transition-colors duration-[120ms]',
        'hover:bg-ink/90',
        // The focus ring is offset onto the paper so it reads against the
        // button's own black rather than disappearing into it.
        'focus-visible:ring-ink focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] focus-visible:outline-none',
        // Disabled is a real style rather than the whole button faded out.
        // Fading black to 40% lands on a mid grey that left the white label at
        // about 2.6:1 — legible only if you already know what it says. Muted
        // ink on the wash measures 5.1:1, so a disabled button still reads as
        // a button with a label, not as a smudge.
        'disabled:bg-wash disabled:text-ink-muted disabled:cursor-not-allowed disabled:hover:bg-wash',
        size === 'md' ? 'px-4 py-2' : 'px-3 py-1.5',
        className,
      )}
    >
      {pending ? (pendingLabel ?? children) : children}
    </button>
  )
}
