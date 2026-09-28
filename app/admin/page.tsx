import { Suspense } from 'react'
import { AdminScreen } from './admin-screen'

export const metadata = { title: 'Admin — DeliverX' }

export default function AdminPage() {
  return (
    /*
      The screen reads the open tab from the URL (so back returns you to the tab
      you left from), and `useSearchParams` makes it client-rendered. Next needs
      a boundary at that seam or it refuses to prerender the route.

      The fallback is deliberately nothing: this screen is behind an admin check
      that resolves in the same tick, so a skeleton here would flash for one
      frame and read as a slower page than it is.
    */
    <Suspense fallback={null}>
      <AdminScreen />
    </Suspense>
  )
}
