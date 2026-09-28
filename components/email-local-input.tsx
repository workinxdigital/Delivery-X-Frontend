'use client'

import { WORK_EMAIL_DOMAIN } from '@/lib/default-password'

/**
 * A mailbox field with the company domain fixed beside it.
 *
 * The domain is rendered as text inside the control rather than as part of the
 * value, which is the point: there is nothing to select, edit or paste over, so
 * an account cannot be created on a domain the company does not own. The server
 * appends the same constant and ignores anything after an `@` (§5.5), so this
 * is a convenience rather than the guard — but a control that cannot express
 * the wrong thing is better than one that can and is checked afterwards.
 */
export function EmailLocalInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  return (
    /*
      The wrapper carries the border and the focus ring so the input and the
      suffix read as one control. `focus-within` rather than a JS focus flag —
      the browser already knows.
    */
    <div
      /*
        Marks this as a CONTROL, not a panel.

        The dark theme frosts every container carrying `bg-surface` (§5.9), and
        this wrapper is a div, so it was picking that up: transparent border,
        inset glass rings, and an email field that no longer looked like a field
        beside the password input next to it. The stylesheet excludes anything
        flagged this way, which is the same distinction the tag-based rule was
        already trying to draw.
      */
      data-slot="control"
      /*
        No focus ring of its own: `[data-slot='control']:focus-within` in
        globals.css draws the same one every input gets, so the two can never
        disagree about what focus looks like.
      */
      className={`bg-surface border-control hover:border-ink-muted flex h-10 w-full items-center rounded-lg border pr-3 text-dense transition-colors duration-[120ms] ${
        invalid ? 'border-danger' : ''
      }`}
    >
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        placeholder="name"
        className="text-ink placeholder:text-ink-faint h-full min-w-0 flex-1 bg-transparent px-3 outline-none"
      />
      {/*
        Not focusable and not selectable: it is a label for the field, not a
        value in it. `shrink-0` so a long mailbox scrolls the input rather than
        squeezing the domain into an ellipsis.
      */}
      <span aria-hidden className="text-ink-muted shrink-0 select-none text-micro">
        @{WORK_EMAIL_DOMAIN}
      </span>
    </div>
  )
}
