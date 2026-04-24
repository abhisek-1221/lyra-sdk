import type { InlineCodeUsageGenerator } from 'fumadocs-openapi/requests/generators'
import type { MethodInformation } from 'fumadocs-openapi'

function expressRoute(method: string, path: string, body: string): string {
  const handler = method.toLowerCase()
  return `import { Router } from 'express'
import { client } from '../lib.js'

const router = Router()

router.${handler}('${path}', async (req, res) => {
${body}
})

export const routes = router`
}

function honoRoute(method: string, path: string, body: string): string {
  const handler = method.toLowerCase()
  return `import { Hono } from 'hono'
import { client } from '../lib.js'

const app = new Hono()

app.${handler}('${path}', async (c) => {
${body}
})

export const routes = app`
}

function nextjsRoute(
  method: string,
  _path: string,
  body: string,
  hasBody?: boolean,
): string {
  const exportName = method === 'POST' ? 'POST' : 'GET'
  return `import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/lib/youtube.js'

export async function ${exportName}(req: NextRequest${hasBody ? '' : ', { params }: { params: { id: string } }'}) {
${body}
}`
}

function indent(code: string, spaces = 2): string {
  return code
    .split('\n')
    .map((line) => (line ? ' '.repeat(spaces) + line : line))
    .join('\n')
}

const samples: Record<
  string,
  { express: string; hono: string; nextjs: string }
> = {
  getVideo: {
    express: expressRoute(
      'GET',
      '/video/:id',
      indent(`const { id } = req.params
const video = await client!.video(id)
res.json(video)`),
    ),
    hono: honoRoute(
      'GET',
      '/video/:id',
      indent(`const id = c.req.param('id')
const video = await client!.video(id)
return c.json(video)`),
    ),
    nextjs: nextjsRoute(
      'GET',
      '/api/video/:id',
      indent(`const id = params.id
const video = await client!.video(id)
return NextResponse.json(video)`),
    ),
  },
  getVideos: {
    express: expressRoute(
      'GET',
      '/videos',
      indent(`const ids = (req.query.ids as string)?.split(',').map(s => s.trim()) ?? []
const videos = await client!.videos(ids)
res.json(videos)`),
    ),
    hono: honoRoute(
      'GET',
      '/videos',
      indent(`const ids = c.req.query('ids')?.split(',').map(s => s.trim()) ?? []
const videos = await client!.videos(ids)
return c.json(videos)`),
    ),
    nextjs: nextjsRoute(
      'GET',
      '/api/videos',
      indent(`const { searchParams } = new URL(req.url)
const ids = searchParams.get('ids')?.split(',').map(s => s.trim()) ?? []
const videos = await client!.videos(ids)
return NextResponse.json(videos)`),
    ),
  },
  getVideoTitle: {
    express: expressRoute(
      'GET',
      '/video/:id/title',
      indent(`const { id } = req.params
const result = await client!.videoTitle(id)
res.json(result)`),
    ),
    hono: honoRoute(
      'GET',
      '/video/:id/title',
      indent(`const id = c.req.param('id')
const result = await client!.videoTitle(id)
return c.json(result)`),
    ),
    nextjs: nextjsRoute(
      'GET',
      '/api/video/:id/title',
      indent(`const id = params.id
const result = await client!.videoTitle(id)
return NextResponse.json(result)`),
    ),
  },
  getChannel: {
    express: expressRoute(
      'GET',
      '/channel/:id',
      indent(`const { id } = req.params
const channel = await client!.channel(id)
res.json(channel)`),
    ),
    hono: honoRoute(
      'GET',
      '/channel/:id',
      indent(`const id = c.req.param('id')
const channel = await client!.channel(id)
return c.json(channel)`),
    ),
    nextjs: nextjsRoute(
      'GET',
      '/api/channel/:id',
      indent(`const id = params.id
const channel = await client!.channel(id)
return NextResponse.json(channel)`),
    ),
  },
  getChannelVideos: {
    express: expressRoute(
      'GET',
      '/channel/:id/videos',
      indent(`const { id } = req.params
const limit = req.query.limit ? Number(req.query.limit) : 5
const videos = await client!.channelVideos(id, { limit })
res.json(videos)`),
    ),
    hono: honoRoute(
      'GET',
      '/channel/:id/videos',
      indent(`const id = c.req.param('id')
const limit = Number(c.req.query('limit')) || 5
const videos = await client!.channelVideos(id, { limit })
return c.json(videos)`),
    ),
    nextjs: nextjsRoute(
      'GET',
      '/api/channel/:id/videos',
      indent(`const id = params.id
const { searchParams } = new URL(req.url)
const limit = Number(searchParams.get('limit')) || 5
const videos = await client!.channelVideos(id, { limit })
return NextResponse.json(videos)`),
    ),
  },
  getPlaylist: {
    express: expressRoute(
      'GET',
      '/playlist/:id',
      indent(`const { id } = req.params
const playlist = await client!.playlist(id)
res.json(playlist)`),
    ),
    hono: honoRoute(
      'GET',
      '/playlist/:id',
      indent(`const id = c.req.param('id')
const playlist = await client!.playlist(id)
return c.json(playlist)`),
    ),
    nextjs: nextjsRoute(
      'GET',
      '/api/playlist/:id',
      indent(`const id = params.id
const playlist = await client!.playlist(id)
return NextResponse.json(playlist)`),
    ),
  },
  getPlaylistInfo: {
    express: expressRoute(
      'GET',
      '/playlist/:id/info',
      indent(`const { id } = req.params
const info = await client!.playlistInfo(id)
res.json(info)`),
    ),
    hono: honoRoute(
      'GET',
      '/playlist/:id/info',
      indent(`const id = c.req.param('id')
const info = await client!.playlistInfo(id)
return c.json(info)`),
    ),
    nextjs: nextjsRoute(
      'GET',
      '/api/playlist/:id/info',
      indent(`const id = params.id
const info = await client!.playlistInfo(id)
return NextResponse.json(info)`),
    ),
  },
  getPlaylistIds: {
    express: expressRoute(
      'GET',
      '/playlist/:id/ids',
      indent(`const { id } = req.params
const ids = await client!.playlistVideoIds(id)
res.json({ id, videoIds: ids, count: ids.length })`),
    ),
    hono: honoRoute(
      'GET',
      '/playlist/:id/ids',
      indent(`const id = c.req.param('id')
const ids = await client!.playlistVideoIds(id)
return c.json({ id, videoIds: ids, count: ids.length })`),
    ),
    nextjs: nextjsRoute(
      'GET',
      '/api/playlist/:id/ids',
      indent(`const id = params.id
const ids = await client!.playlistVideoIds(id)
return NextResponse.json({ id, videoIds: ids, count: ids.length })`),
    ),
  },
  queryPlaylist: {
    express: `import { Router } from 'express'
import { client } from '../lib.js'

const router = Router()

router.post('/playlist/:id/query', async (req, res) => {
  const { id } = req.params
  const body = req.body

  let query = client!.playlistQuery(id)

  if (body.filter?.duration) query = query.filterByDuration(body.filter.duration)
  if (body.filter?.views) query = query.filterByViews(body.filter.views)
  if (body.filter?.likes) query = query.filterByLikes(body.filter.likes)
  if (body.sort) query = query.sortBy(body.sort.field, body.sort.order)
  if (body.range) query = query.between(body.range.start, body.range.end)

  const result = await query.execute()
  res.json(result)
})

export const routes = router`,
    hono: `import { Hono } from 'hono'
import { client } from '../lib.js'

const app = new Hono()

app.post('/playlist/:id/query', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()

  let query = client!.playlistQuery(id)

  if (body.filter?.duration) query = query.filterByDuration(body.filter.duration)
  if (body.filter?.views) query = query.filterByViews(body.filter.views)
  if (body.filter?.likes) query = query.filterByLikes(body.filter.likes)
  if (body.sort) query = query.sortBy(body.sort.field, body.sort.order)
  if (body.range) query = query.between(body.range.start, body.range.end)

  const result = await query.execute()
  return c.json(result)
})

export const routes = app`,
    nextjs: `import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/lib/youtube.js'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const body = await req.json()

  let query = client!.playlistQuery(id)

  if (body.filter?.duration) query = query.filterByDuration(body.filter.duration)
  if (body.filter?.views) query = query.filterByViews(body.filter.views)
  if (body.filter?.likes) query = query.filterByLikes(body.filter.likes)
  if (body.sort) query = query.sortBy(body.sort.field, body.sort.order)
  if (body.range) query = query.between(body.range.start, body.range.end)

  const result = await query.execute()
  return NextResponse.json(result)
}`,
  },
  getComments: {
    express: expressRoute(
      'GET',
      '/comments/:videoId',
      indent(`const { videoId } = req.params
const maxResults = req.query.maxResults ? Number(req.query.maxResults) : 100
const threads = await client!.comments(videoId, {
  order: req.query.order as any,
  searchTerms: req.query.search as string,
  maxResults,
})
res.json(threads)`),
    ),
    hono: honoRoute(
      'GET',
      '/comments/:videoId',
      indent(`const videoId = c.req.param('videoId')
const maxResults = c.req.query('maxResults') ? Number(c.req.query('maxResults')) : 100
const threads = await client!.comments(videoId, {
  order: c.req.query('order') as any,
  searchTerms: c.req.query('search'),
  maxResults,
})
return c.json(threads)`),
    ),
    nextjs: nextjsRoute(
      'GET',
      '/api/comments/:videoId',
      indent(`const videoId = params.id
const { searchParams } = new URL(req.url)
const maxResults = searchParams.get('maxResults') ? Number(searchParams.get('maxResults')) : 100
const threads = await client!.comments(videoId, {
  order: searchParams.get('order') as any,
  searchTerms: searchParams.get('search') || undefined,
  maxResults,
})
return NextResponse.json(threads)`),
    ),
  },
  getTopComments: {
    express: expressRoute(
      'GET',
      '/comments/:videoId/top',
      indent(`const { videoId } = req.params
const limit = req.query.limit ? Number(req.query.limit) : 10
const threads = await client!.topComments(videoId, limit)
res.json(threads)`),
    ),
    hono: honoRoute(
      'GET',
      '/comments/:videoId/top',
      indent(`const videoId = c.req.param('videoId')
const limit = c.req.query('limit') ? Number(c.req.query('limit')) : 10
const threads = await client!.topComments(videoId, limit)
return c.json(threads)`),
    ),
    nextjs: nextjsRoute(
      'GET',
      '/api/comments/:videoId/top',
      indent(`const videoId = params.id
const { searchParams } = new URL(req.url)
const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 10
const threads = await client!.topComments(videoId, limit)
return NextResponse.json(threads)`),
    ),
  },
  getCommentReplies: {
    express: expressRoute(
      'GET',
      '/comment-replies/:id',
      indent(`const { id } = req.params
const replies = await client!.commentReplies(id)
res.json(replies)`),
    ),
    hono: honoRoute(
      'GET',
      '/comment-replies/:id',
      indent(`const id = c.req.param('id')
const replies = await client!.commentReplies(id)
return c.json(replies)`),
    ),
    nextjs: nextjsRoute(
      'GET',
      '/api/comment-replies/:id',
      indent(`const id = params.id
const replies = await client!.commentReplies(id)
return NextResponse.json(replies)`),
    ),
  },
  getTranscript: {
    express: `import { Router } from 'express'
import { transcribeVideo } from 'lyra-sdk/transcript'

const router = Router()

router.get('/transcript/:id', async (req, res) => {
  const { id } = req.params
  const lang = req.query.lang as string | undefined
  const lines = await transcribeVideo(id, { lang })
  res.json(lines)
})

export const routes = router`,
    hono: `import { Hono } from 'hono'
import { transcribeVideo } from 'lyra-sdk/transcript'

const app = new Hono()

app.get('/transcript/:id', async (c) => {
  const id = c.req.param('id')
  const lang = c.req.query('lang')
  const lines = await transcribeVideo(id, { lang })
  return c.json(lines)
})

export const routes = app`,
    nextjs: `import { NextRequest, NextResponse } from 'next/server'
import { transcribeVideo } from 'lyra-sdk/transcript'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const { searchParams } = new URL(req.url)
  const lang = searchParams.get('lang') || undefined
  const lines = await transcribeVideo(id, { lang })
  return NextResponse.json(lines)
}`,
  },
  batchTranscript: {
    express: `import { Router } from 'express'
import { transcribePlaylist } from 'lyra-sdk/transcript'
import { z } from 'zod'

const router = Router()

const batchSchema = z.object({
  concurrency: z.coerce.number().min(1).max(20).optional().default(3),
  from: z.coerce.number().min(1).optional(),
  to: z.coerce.number().min(1).optional(),
  lang: z.string().optional(),
})

router.post('/playlist/:id/transcript', async (req, res) => {
  const { id } = req.params
  const opts = batchSchema.parse(req.body)

  const result = await transcribePlaylist(id, {
    apiKey: process.env.YOUTUBE_API_KEY!,
    ...opts,
  })

  res.json(result)
})

export const routes = router`,
    hono: `import { Hono } from 'hono'
import { transcribePlaylist } from 'lyra-sdk/transcript'
import { z } from 'zod'

const app = new Hono()

const batchSchema = z.object({
  concurrency: z.coerce.number().min(1).max(20).optional().default(3),
  from: z.coerce.number().min(1).optional(),
  to: z.coerce.number().min(1).optional(),
  lang: z.string().optional(),
})

app.post('/playlist/:id/transcript', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const opts = batchSchema.parse(body)

  const result = await transcribePlaylist(id, {
    apiKey: process.env.YOUTUBE_API_KEY!,
    ...opts,
  })

  return c.json(result)
})

export const routes = app`,
    nextjs: `import { NextRequest, NextResponse } from 'next/server'
import { transcribePlaylist } from 'lyra-sdk/transcript'
import { z } from 'zod'

const batchSchema = z.object({
  concurrency: z.coerce.number().min(1).max(20).optional().default(3),
  from: z.coerce.number().min(1).optional(),
  to: z.coerce.number().min(1).optional(),
  lang: z.string().optional(),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id
  const body = await req.json()
  const opts = batchSchema.parse(body)

  const result = await transcribePlaylist(id, {
    apiKey: process.env.YOUTUBE_API_KEY!,
    ...opts,
  })

  return NextResponse.json(result)
}`,
  },
}

export function generateCodeSamples(
  method: MethodInformation,
): InlineCodeUsageGenerator[] {
  const operationId = method.operationId
  const sample = operationId ? samples[operationId] : undefined

  if (!sample) return []

  return [
    {
      id: 'express',
      lang: 'ts',
      label: 'Express',
      source: sample.express,
    },
    {
      id: 'hono',
      lang: 'ts',
      label: 'Hono',
      source: sample.hono,
    },
    {
      id: 'nextjs',
      lang: 'ts',
      label: 'Next.js',
      source: sample.nextjs,
    },
  ]
}
