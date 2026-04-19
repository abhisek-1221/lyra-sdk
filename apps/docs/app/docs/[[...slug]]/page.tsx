import { getPageImage, getPageMarkdownUrl, source } from '@/lib/source'
import * as Twoslash from 'fumadocs-twoslash/ui'
import {
  DocsPage,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/notebook/page'
import { notFound } from 'next/navigation'
import { getMDXComponents } from '@/mdx-components'
import type { Metadata } from 'next'
import { createRelativeLink } from 'fumadocs-ui/mdx'
import { gitConfig } from '@/lib/shared'

export const revalidate = false

export default async function Page(
  props: PageProps<'/docs/[[...slug]]'>
) {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()

  const MDX = page.data.body
  const markdownUrl = getPageMarkdownUrl(page).url

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <h1 className='break-all font-semibold text-[1.75em]'>
        {page.data.title}
      </h1>
      <p className='mb-2 text-fd-muted-foreground text-lg'>
        {page.data.description}
      </p>
      <div className='flex flex-row gap-2 items-center border-b pb-6'>
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`https://github.com/${gitConfig.user}/${gitConfig.repo}/blob/${gitConfig.branch}/content/docs/${page.path}`}
        />
      </div>
      <div className='prose flex-1 text-fd-foreground/90'>
        <MDX
          components={getMDXComponents({
            ...Twoslash,
            a: createRelativeLink(source, page),
          })}
        />
      </div>
    </DocsPage>
  )
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params
  const page = source.getPage(params.slug)
  if (!page) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: getPageImage(page).url,
    },
  }
}

export function generateStaticParams() {
  return source.generateParams()
}