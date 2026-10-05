/**
 * Previews of what the server will do when an admin adds a colleague.
 *
 * Deliberately PREVIEWS. The server derives both the address and the password
 * (`src/domain/default-password.ts` in the API) and returns them on creation,
 * and those returned values are what the confirmation reports — so if these
 * rules ever drift, the admin is told the truth rather than what this file
 * guessed. These exist only so the form can say what is about to happen.
 */

/** The one line to change if the company's mail domain ever does. */
export const WORK_EMAIL_DOMAIN = 'workinxdigital.us'

/**
 * The domain client logins are issued on (owner, 2026-10-01).
 *
 * Separate from the staff domain and deliberately not the client's own: a
 * credential WorkinX issues belongs on a domain WorkinX owns. Mirrors the
 * server constant, which is what actually gets appended.
 */
export const CLIENT_EMAIL_DOMAIN = 'workinxbilling.com'

/**
 * The work address, derived from the name.
 *
 * Dots, because that is how a mail system is conventionally addressed. The
 * password below uses hyphens because it reads better; they are separate rules
 * on purpose, so neither drifts to match the other.
 */
export function workEmail(name: string): string {
  return `${emailLocal(name)}@${WORK_EMAIL_DOMAIN}`
}

/**
 * The mailbox suggested from a name — the part before the @.
 *
 * A suggestion, not a rule: a colleague on the Team list as "Sam" may well be
 * `samantha@`, so the form starts here and the admin can change it. Only the
 * domain is fixed, and the server appends that itself.
 */
export function emailLocal(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'user'
  )
}

/** The starting password. Weak and temporary by design — see the API's copy. */
export function defaultPassword(name: string): string {
  const slug =
    name
      .toLowerCase()
      .trim()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'user'

  return `${slug}-password-for-testing`
}
