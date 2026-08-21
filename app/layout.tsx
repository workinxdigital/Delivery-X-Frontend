import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'DeliverX — WorkinX Digital',
  description: 'Internal delivery log. Records delivered creative work.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-[var(--color-ink)] antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
