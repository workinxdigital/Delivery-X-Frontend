import { Suspense } from 'react'
import { Statement } from './statement'
import './statement.css'

export const metadata = { title: 'Delivery statement — DeliverX' }

/**
 * Opened in its own tab from the Pricing screen, so the print dialog gets a
 * page with nothing else on it. Suspense because the statement reads its scope
 * from the query string.
 */
export default function StatementPage() {
  return (
    <Suspense fallback={null}>
      <Statement />
    </Suspense>
  )
}
