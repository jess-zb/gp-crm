import type { Metadata, Viewport } from 'next'
import { Barlow } from 'next/font/google'
import { SonnerToaster } from '@/app/components/SonnerToaster'
import { ThemeInit } from '@/app/components/ThemeInit'
import * as Sentry from '@sentry/nextjs'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A2540',
};

export function generateMetadata(): Metadata {
  return {
    title: 'DebtSupportPros CRM',
    description: 'Case management for DebtSupportPros, LLC',
    manifest: '/manifest.json',
    icons: {
      icon: '/favicon.png',
      shortcut: '/favicon.png',
      apple: '/favicon.png',
    },
    appleWebApp: {
      capable: true,
      statusBarStyle: 'black-translucent',
      title: 'DSP CRM',
    },
    other: {
      'mobile-web-app-capable': 'yes',
      ...Sentry.getTraceData(),
    },
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${barlow.className} min-h-screen antialiased`}>
        <ThemeInit />
        {children}
        <SonnerToaster />
        <SpeedInsights />
      </body>
    </html>
  )
}