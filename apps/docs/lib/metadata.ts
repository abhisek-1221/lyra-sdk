import type { Metadata } from 'next'
import { appName } from '@/lib/shared'
import type { Page } from './source'

export function createMetadata(override: Metadata): Metadata {
  return {
    ...override,
    openGraph: {
      title: typeof override.title === 'string' ? override.title : undefined,
      description: typeof override.description === 'string' ? override.description : undefined,
      url: '/',
      siteName: appName,
      ...override.openGraph,
    },
    twitter: {
      card: 'summary_large_image',
      title: typeof override.title === 'string' ? override.title : undefined,
      description: typeof override.description === 'string' ? override.description : undefined,
      ...override.twitter,
    },
  }
}

export function getPageImage(page: Page) {
  const segments = [...page.slugs, 'image.png']
  return {
    segments,
    url: `/og/docs/${segments.join('/')}`,
  }
}

export const baseUrl =
  process.env.NODE_ENV === 'development' || !process.env.NEXT_PUBLIC_BASE_URL
    ? new URL('http://localhost:3000')
    : new URL(process.env.NEXT_PUBLIC_BASE_URL)