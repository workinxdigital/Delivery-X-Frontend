'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

/**
 * A password field you can read back.
 *
 * Typing a password blind is where sign-in goes wrong for people who have one
 * and are certain of it — a stray capital, a keyboard layout, the trailing
 * space a paste brings with it. The toggle costs nothing and turns "wrong
 * password" into something a person can see for themselves.
 *
 * The button is `type="button"`: inside a form, a bare <button> submits, so a
 * click meant to reveal the password would have posted the form instead.
 *
 * It never changes the value, only how it is drawn, and it starts hidden every
 * time — nothing remembers it, since the next person at this keyboard should
 * not inherit a decision the last one made.
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'type'>) {
  const [shown, setShown] = useState(false)

  return (
    <div className="relative">
      <Input
        {...props}
        type={shown ? 'text' : 'password'}
        /* Room for the button, so a long password does not run under it. */
        className={cn('pr-10', className)}
      />

      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        aria-pressed={shown}
        aria-label={shown ? 'Hide password' : 'Show password'}
        title={shown ? 'Hide password' : 'Show password'}
        /*
          -translate-y-1/2 off the midpoint rather than a fixed offset, so it
          stays centred if the field's height ever changes.
        */
        className="text-ink-faint hover:text-ink absolute top-1/2 right-1 flex size-8 -translate-y-1/2 items-center justify-center rounded-md transition-colors duration-[120ms]"
      >
        {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}
