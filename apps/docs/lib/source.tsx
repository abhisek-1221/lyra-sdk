import { docs } from 'collections/server'
import {
  type InferMetaType,
  type InferPageType,
  type LoaderPlugin,
  loader,
} from 'fumadocs-core/source'
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons'
import { openapiPlugin } from 'fumadocs-openapi/server'
import { docsContentRoute, docsImageRoute, docsRoute } from './shared'

const CODE_TAG_NAME = /^<\w+ \/>$/

export const source = loader({
  baseUrl: docsRoute,
  plugins: [pageTreeCodeTitles(), lucideIconsPlugin(), openapiPlugin()],
  source: docs.toFumadocsSource(),
})

function pageTreeCodeTitles(): LoaderPlugin {
  return {
    transformPageTree: {
      file(node) {
        if (
          typeof node.name === 'string' &&
          (node.name.endsWith('()') || node.name.match(CODE_TAG_NAME))
        ) {
          return {
            ...node,
            name: <code className='text-[0.8125rem]'>{node.name}</code>,
          }
        }
        return node
      },
    },
  }
}

export function getPageImage(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'image.png']

  return {
    segments,
    url: `${docsImageRoute}/${segments.join('/')}`,
  }
}

export function getPageMarkdownUrl(page: InferPageType<typeof source>) {
  const segments = [...page.slugs, 'content.md']

  return {
    segments,
    url: `${docsContentRoute}/${segments.join('/')}`,
  }
}

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText('processed')

  return `# ${page.data.title} (${page.url})

${processed}`
}

export type Page = InferPageType<typeof source>
export type Meta = InferMetaType<typeof source>