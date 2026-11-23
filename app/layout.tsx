import { Analytics } from '@vercel/analytics/react'
import type { Metadata, Viewport } from 'next'
import { Rajdhani, Plus_Jakarta_Sans } from 'next/font/google'
import { LanguageProvider } from '@/lib/language'
import { ViewModeProvider } from '@/lib/view-mode'
import { LiveChatWidget } from '@/components/site/live-chat'
import { GlobalCyberBackground } from '@/components/site/global-cyber-background'
import { Toaster } from 'sonner'
import { BRAND } from '@/lib/brand'
import './globals.css'

const heading = Rajdhani({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
})

const body = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

export const viewport: Viewport = {
  themeColor: '#050811',
  colorScheme: 'dark',
}

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  alternates: {
    canonical: BRAND.url,
  },
  title: {
    default: `${BRAND.name} — Free Fire Esports Scrims in Bangladesh`,
    template: `%s | ${BRAND.name}`,
  },
  description:
    'Book competitive Free Fire scrims daily from 7 PM to 12 AM with RushX Organization. 12-team lobbies, instant room details, automated gateway payments, and real cash prize pools.',
  applicationName: BRAND.name,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: BRAND.assets.favicon64, sizes: '64x64', type: 'image/png' },
      { url: BRAND.assets.favicon192, sizes: '192x192', type: 'image/png' },
      { url: BRAND.assets.symbol, sizes: '512x512', type: 'image/png' },
    ],
    shortcut: BRAND.assets.favicon64,
    apple: [
      { url: BRAND.assets.appleIcon180, sizes: '180x180', type: 'image/png' },
      { url: BRAND.assets.symbol, sizes: '512x512', type: 'image/png' },
    ],
  },
  openGraph: {
    title: `${BRAND.name} — Free Fire Esports Scrims`,
    description:
      'Daily competitive Free Fire scrims organized by RushX Organization. Instant booking, verified lobbies, and real cash prize pools.',
    url: BRAND.url,
    siteName: BRAND.name,
    type: 'website',
    images: [
      {
        url: BRAND.assets.fullWordmark,
        width: 1280,
        height: 720,
        alt: BRAND.name,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${BRAND.name} — Free Fire Esports Scrims`,
    description:
      'Daily competitive Free Fire scrims organized by RushX Organization.',
    images: [BRAND.assets.fullWordmark],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`dark bg-[#04060d] overflow-x-hidden max-w-full w-full ${heading.variable} ${body.variable}`}
    >
      <body className="antialiased font-sans relative min-h-screen bg-transparent text-foreground overflow-x-hidden max-w-full w-full selection:bg-primary/30 selection:text-foreground">
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
