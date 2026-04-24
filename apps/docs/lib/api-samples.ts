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
  parseUrl: {
    express: `import { Router } from 'express'
import { client } from '../lib.js'

const router = Router()

router.post('/url/parse', async (req, res) => {
  const { url } = req.body
  const result = client!.url.parse(url)
  res.json(result)
})

export const routes = router`,
    hono: `import { Hono } from 'hono'
import { client } from '../lib.js'

const app = new Hono()

app.post('/url/parse', async (c) => {
  const { url } = await c.req.json()
  const result = client!.url.parse(url)
  return c.json(result)
})

export const routes = app`,
    nextjs: `import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/lib/youtube.js'

export async function POST(req: NextRequest) {
  const { url } = await req.json()
  const result = client!.url.parse(url)
  return NextResponse.json(result)
}`,
  },
  extractUrl: {
    express: `import { Router } from 'express'
import { client } from '../lib.js'

const router = Router()

router.post('/url/extract', async (req, res) => {
  const { url, type } = req.body

  if (type === 'video' || (!type && client!.url.isVideo(url))) {
    return res.json({ type: 'video', videoId: client!.url.extractVideoId(url) })
  }
  if (type === 'playlist' || (!type && client!.url.isPlaylist(url))) {
    return res.json({ type: 'playlist', playlistId: client!.url.extractPlaylistId(url) })
  }
  const channelId = client!.url.extractChannelId(url)
  if (channelId) return res.json({ type: 'channel', channelId })

  return res.json({ type: 'unknown', id: null })
})

export const routes = router`,
    hono: `import { Hono } from 'hono'
import { client } from '../lib.js'

const app = new Hono()

app.post('/url/extract', async (c) => {
  const { url, type } = await c.req.json()

  if (type === 'video' || (!type && client!.url.isVideo(url))) {
    return c.json({ type: 'video', videoId: client!.url.extractVideoId(url) })
  }
  if (type === 'playlist' || (!type && client!.url.isPlaylist(url))) {
    return c.json({ type: 'playlist', playlistId: client!.url.extractPlaylistId(url) })
  }
  const channelId = client!.url.extractChannelId(url)
  if (channelId) return c.json({ type: 'channel', channelId })

  return c.json({ type: 'unknown', id: null })
})

export const routes = app`,
    nextjs: `import { NextRequest, NextResponse } from 'next/server'
import { client } from '@/lib/youtube.js'

export async function POST(req: NextRequest) {
  const { url, type } = await req.json()

  if (type === 'video' || (!type && client!.url.isVideo(url))) {
    return NextResponse.json({ type: 'video', videoId: client!.url.extractVideoId(url) })
  }
  if (type === 'playlist' || (!type && client!.url.isPlaylist(url))) {
    return NextResponse.json({ type: 'playlist', playlistId: client!.url.extractPlaylistId(url) })
  }
  const channelId = client!.url.extractChannelId(url)
  if (channelId) return NextResponse.json({ type: 'channel', channelId })

  return NextResponse.json({ type: 'unknown', id: null })
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
