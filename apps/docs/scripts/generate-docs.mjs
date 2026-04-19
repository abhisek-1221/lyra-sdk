import { generateFiles } from 'fumadocs-openapi'
import { createOpenAPI } from 'fumadocs-openapi/server'
import { rimraf } from 'rimraf'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const openapi = createOpenAPI({
  input: [path.resolve(__dirname, '../content/docs/api-reference/openapi.yml')],
  proxyUrl: '/api/proxy',
})

const out = path.resolve(__dirname, '../content/docs/api-reference/(generated)')

await rimraf(out, {
  filter(v) {
    const basename = path.basename(v)
    return basename !== 'meta.json'
  },
})

await generateFiles({
  input: openapi,
  output: out,
  per: 'operation',
  includeDescription: true,
  groupBy: 'tag',
})

console.log('OpenAPI docs generated successfully')