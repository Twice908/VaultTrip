import type { Metadata, Viewport } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import { Inter } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'VaultTrip — Travel Document Vault',
  description: 'Every document. Every trip. Always ready.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'VaultTrip' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#3B7FEB',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <body className="bg-surface-base text-text-primary antialiased">
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#0F1B2D',
                color: '#F0F4FA',
                border: '1px solid #1E3352',
              },
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  )
}
