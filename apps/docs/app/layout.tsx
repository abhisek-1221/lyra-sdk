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
  title: {
    template: `%s - ${appName}`,
    default: appName,
  },
  description: 'Documentation for your project',
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