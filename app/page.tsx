import { redirect } from 'next/navigation'

/**
 * The root goes straight to the logging form.
 *
 * This used to be a build-status screen — web app / API / database / sign-in,
 * each with a health line. That was scaffolding for a half-built system, and it
 * is neither what anyone opening this app wants to see nor something to hand a
 * client the URL of. The health endpoint it read from is still there for
 * checking the API directly.
 *
 * Logging a delivery is what people are here to do many times a day, so that is
 * where the root lands. Anyone not signed in is bounced to /login from there.
 */
export default function Home() {
  redirect('/log')
}
