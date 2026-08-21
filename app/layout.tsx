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
      <body className="bg-background text-foreground min-h-screen antialiased">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
          <Toaster position="top-center" richColors />
        </Providers>
      </body>
    </html>
  )
}
