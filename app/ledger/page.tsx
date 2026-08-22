import { LedgerTable } from './ledger-table'

export const metadata = { title: 'Ledger — DeliverX' }

export default function LedgerPage() {
  return (
    <div>
      <div className="border-rule mb-6 border-b pb-5">
        <h1 className="text-[1.375rem] font-semibold tracking-tight">Ledger</h1>
        <p className="text-ink-muted mt-1 text-dense">
          Everything logged. The export carries whatever the filters show.
        </p>
      </div>
      <LedgerTable />
    </div>
  )
}
