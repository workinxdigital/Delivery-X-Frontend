import { LedgerTable } from './ledger-table'

export const metadata = { title: 'Task Ledger — DeliverX' }

export default function LedgerPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Task Ledger</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Everything logged. Filters apply to the CSV export too, so the numbers you see
          are the numbers you get.
        </p>
      </div>
      <LedgerTable />
    </div>
  )
}
