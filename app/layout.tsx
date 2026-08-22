import type { Metadata } from 'next'
import './globals.css'
import { Nav } from '@/components/nav'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'

export const metadata: Metadata = {
  title: 'DeliverX — WorkinX Digital',
  description: 'Internal delivery log. Records delivered creative work.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-[1240px] px-6 py-10">{children}</main>
          {/*
            No richColors: success feedback is ink, not green. The tone is
            "recorded", not "well done" (PRODUCT.md).
          */}
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  )
}
