import { Analytics } from '@vercel/analytics/react'
import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import { LanguageProvider } from '@/lib/language'
import { ViewModeProvider } from '@/lib/view-mode'
import { LiveChatWidget } from '@/components/site/live-chat'
import { GlobalCyberBackground } from '@/components/site/global-cyber-background'
import { Toaster } from 'sonner'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://www.acescrims.online'),
  alternates: {
    canonical: 'https://www.acescrims.online',
  },
  title: {
    default: 'Ace Scrims — Free Fire Esports Scrims in Bangladesh',
    template: '%s | Ace Scrims',
  },
  description:
    'Book competitive Free Fire scrims daily from 7 PM to 12 AM. 12-team lobbies, instant room details, automatic gateway payments, and real prize pools.',
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/icon', type: 'image/png' },
    ],
    shortcut: '/icon.svg',
    apple: [
      { url: '/apple-icon', type: 'image/png' },
    ],
  },
  openGraph: {
    title: 'Ace Scrims — Free Fire Esports Scrims',
    description: 'Daily competitive Free Fire scrims. Book your squad slot for ৳35.',
    url: 'https://www.acescrims.online',
    siteName: 'Ace Scrims',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark bg-[#030407] overflow-x-hidden max-w-full w-full ${manrope.variable}`}>
      <body className="antialiased font-sans font-semibold relative min-h-screen bg-transparent text-foreground overflow-x-hidden max-w-full w-full">
        <LanguageProvider>
          <ViewModeProvider>
            <GlobalCyberBackground />
            <div className="relative z-10 min-h-screen flex flex-col w-full max-w-full overflow-x-hidden">
              {children}
            </div>
            <LiveChatWidget />
            <Toaster position="top-right" theme="dark" richColors />
          </ViewModeProvider>
        </LanguageProvider>
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
