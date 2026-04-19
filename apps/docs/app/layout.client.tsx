'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Body({ children, mode }: { children: ReactNode; mode?: string }) {
  return (
    <body className={cn(mode, 'relative flex min-h-screen flex-col')}>
      {children}
    </body>
  )
}

export function useMode(): string | undefined {
  const pathname = usePathname()

  if (pathname.startsWith('/docs/api-reference')) return 'api-reference'
  if (pathname.startsWith('/docs/changelog')) return 'changelog'
  return '(index)'
}