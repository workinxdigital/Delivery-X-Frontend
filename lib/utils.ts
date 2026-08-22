import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge has to be told about our custom font sizes.
 *
 * Without this it cannot tell `text-micro` (a size) from `text-ink-muted` (a
 * colour), decides they conflict, and silently drops the first one. The symptom
 * is helper text rendering at the inherited base size while every literal
 * className elsewhere looks fine, which is a genuinely confusing bug to chase.
 *
 * Colours are listed too, so a size and a colour can coexist in one cn() call.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['micro', 'small', 'dense'] }],
      'text-color': [
        {
          text: [
            'ink',
            'ink-muted',
            'ink-faint',
            'beyond',
            'danger',
            'paper',
            'surface',
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
