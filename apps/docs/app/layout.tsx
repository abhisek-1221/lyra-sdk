import { RootProvider } from 'fumadocs-ui/provider/next'
import './global.css'
import { Geist, Geist_Mono } from 'next/font/google'
import { appName } from '@/lib/shared'

const geist = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata = {
  metadataBase: new URL(process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'),
  title: {
    template: `%s - lyra sdk docs`,
    default: 'lyra sdk docs',
  },
  description: 'Documentation for your project',
  icons: {
    icon: '/logo.svg',
  },
}

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang='en'
      className={`${geist.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <body className='relative flex min-h-screen flex-col'>
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  )
}