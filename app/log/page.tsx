import { LogDeliveryForm } from './log-delivery-form'

export const metadata = { title: 'Log a Delivery — DeliverX' }

export default function LogPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Log a Delivery</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Recorded at the moment work ships. Agency and brand stay put after saving, so
          several deliveries for the same brand go in quickly.
        </p>
      </div>
      <LogDeliveryForm />
    </div>
  )
}
