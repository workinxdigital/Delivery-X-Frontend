import { LogDeliveryForm } from './log-delivery-form'

export const metadata = { title: 'Log a delivery — DeliverX' }

export default function LogPage() {
  return (
    <div className="mx-auto max-w-[52rem]">
      <div className="border-rule mb-8 border-b pb-5">
        <h1 className="display text-[1.5rem] font-semibold">Log a delivery</h1>
        <p className="text-ink-muted mt-1 text-dense">
          Recorded at the moment work ships. Agency and brand stay put after saving.
        </p>
      </div>
      <LogDeliveryForm />
    </div>
  )
}
