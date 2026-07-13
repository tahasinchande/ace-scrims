import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Rajdhani, Inter, Noto_Sans_Bengali } from 'next/font/google'
import './globals.css'

const heading = Rajdhani({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-heading',
})

const body = Inter({
  subsets: ['latin'],
  variable: '--font-body',
})

// Fallback for the Bengali Taka sign (৳) which Rajdhani/Inter lack
const bengali = Noto_Sans_Bengali({
  subsets: ['bengali'],
  weight: ['400', '700'],
  variable: '--font-bengali',
})

export const metadata: Metadata = {
  title: {
    default: 'Ace Scrims — Free Fire Esports Scrims in Bangladesh',
    template: '%s | Ace Scrims',
  },
  description:
    'Book competitive Free Fire scrims daily from 7 PM to 12 AM. 12-team lobbies, instant room details, automatic bKash/Nagad/Rocket payments, and real prize pools.',
  generator: 'v0.app',
  keywords: ['Free Fire', 'scrims', 'esports', 'Bangladesh', 'tournament', 'FF scrim'],
  openGraph: {
    title: 'Ace Scrims — Free Fire Esports Scrims',
    description: 'Daily competitive Free Fire scrims. Book your squad slot for \u09F350.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#12121c',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark bg-background ${heading.variable} ${body.variable} ${bengali.variable}`}>
      <body className="antialiased font-sans">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
