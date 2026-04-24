import { createAPIPage } from 'fumadocs-openapi/ui'
import { createCodeUsageGeneratorRegistry } from 'fumadocs-openapi/requests/generators'
import client from '@/components/api-page.client'
import { openapi } from '@/lib/openapi'
import { defaultShikiOptions } from '@/lib/shiki'
import { generateCodeSamples } from '@/lib/api-samples'

export const APIPage = createAPIPage(openapi, {
  shikiOptions: defaultShikiOptions,
  client,
  codeUsages: createCodeUsageGeneratorRegistry(),
  generateCodeSamples,
})
