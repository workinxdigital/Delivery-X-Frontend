import { LedgerTable } from './ledger-table'

export const metadata = { title: 'Ledger — DeliverX' }

export default function LedgerPage() {
  return (
    /*
      The ledger asks for more width than the rest of the app.

      Eleven columns of dense data do not fit the 1240px reading measure, and
      capping them there put a horizontal scrollbar under the table at every
      screen size — including monitors with 400px going spare either side.

      The flag is read by a `main:has()` rule in globals.css. A custom property
      set here could not do it: properties inherit downward, and the element
      that needs widening is this one's parent. `:has()` is how the statement
      page already neutralises the same shell.
    */
    <div data-measure="wide">
      <div className="border-rule mb-6 border-b pb-5">
        <h1 className="display text-[1.5rem] font-semibold">Ledger</h1>
        <p className="text-ink-muted mt-1 text-dense">
          Everything logged. The export carries whatever the filters show.
        </p>
      </div>
      <LedgerTable />
    </div>
  )
}
