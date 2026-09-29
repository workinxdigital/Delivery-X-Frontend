/**
 * Where a client-side error goes.
 *
 * Deliberately thin: it writes to the console today, and exists so there is one
 * place to point at a reporting service later rather than a scatter of
 * `console.error` calls to find and change.
 */
export const logger = {
  error(message: string, error: unknown) {
    // eslint-disable-next-line no-console
    console.error(`[deliverx] ${message}`, error)
  },
}
