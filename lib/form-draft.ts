/**
 * Keeping an unfinished delivery alive across tabs and reloads (owner, 2026-10-09).
 *
 * A PM part-way through logging a delivery would open the app in another tab,
 * come back, and find an empty form: the state lived in React and nothing
 * outlived the component. Half-typed work disappearing is the one failure this
 * screen cannot afford — §5.1 asks for under thirty seconds an entry, and
 * retyping a card of services is the opposite of that.
 *
 * Deliberately `localStorage` rather than `sessionStorage`: the complaint was
 * about ANOTHER TAB, and session storage is per tab, so it would have restored
 * nothing in exactly the case being reported.
 *
 * Three rules this file exists to keep:
 *
 *  - **Per person.** The key carries the user id, so two colleagues sharing a
 *    machine never inherit each other's half-written delivery.
 *  - **Versioned.** A draft written by an older build is discarded rather than
 *    restored into a form whose shape has moved on. The alternative is a
 *    crash on a screen somebody is mid-sentence in.
 *  - **Never fatal.** Every read and write is wrapped: storage throws in a
 *    private window and when a quota is full, and a form that will not render
 *    because it could not save a draft is worse than one that forgets.
 */

const VERSION = 1

export function draftKey(scope: string, userId: string | null | undefined): string | null {
  return userId ? `deliverx:draft:${scope}:v${VERSION}:${userId}` : null
}

/** Read a draft, or null if there is none, it is unreadable, or it is stale. */
export function readDraft<T>(key: string | null): T | null {
  if (!key || typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { v?: number; form?: T }
    if (parsed?.v !== VERSION || !parsed.form) return null
    return parsed.form
  } catch {
    return null
  }
}

/** Write a draft, or clear it when there is nothing worth keeping. */
export function writeDraft<T>(key: string | null, form: T | null): void {
  if (!key || typeof window === 'undefined') return
  try {
    if (form === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, JSON.stringify({ v: VERSION, form }))
  } catch {
    /* Private windows and full quotas both throw here. Losing the draft is the
       cost; taking the form down with it is not. */
  }
}
