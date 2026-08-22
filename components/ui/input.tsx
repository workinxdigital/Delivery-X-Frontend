import * as React from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'

import { cn } from '@/lib/utils'

/**
 * Text input, tuned to the ledger vocabulary.
 *
 * Deliberately matches the combobox trigger: same 36px height, same border,
 * same radius, same surface. A form where the select and the text field are
 * different heights reads as broken, and this form has both side by side.
 *
 * No focus ring here: focus is a 2px ink outline applied globally in
 * globals.css, so every focusable thing in the product looks the same.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'border-control bg-surface text-dense h-9 w-full min-w-0 rounded-md border px-2.5 transition-colors duration-[120ms] outline-none',
        'placeholder:text-ink-muted hover:border-ink-muted',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
