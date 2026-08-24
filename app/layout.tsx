import type { Metadata } from 'next'
import { Bricolage_Grotesque, Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Nav } from '@/components/nav'
import { Providers } from './providers'
import { Toaster } from '@/components/ui/sonner'

/**
 * The three WorkinX fonts, three jobs (brand type system).
 *
 * Loaded through next/font so they are self-hosted at build time: no request to
 * Google at runtime, and no layout shift while they arrive.
 */
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['600', '700'],
  display: 'swap',
})

const body = Geist({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono-brand',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'DeliverX — WorkinX Digital',
  description: 'Internal delivery log. Records delivered creative work.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="min-h-screen">
        <Providers>
          <Nav />
          <main className="mx-auto w-full max-w-[1240px] px-6 py-10">{children}</main>
          {/*
            No richColors: a saved delivery is "recorded", not "well done", and
            success green is not in the brand palette anyway.
          */}
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  )
}
