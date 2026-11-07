
<div align="center">

<h1 style="font-size: 3em; line-height: 1">
  <img src="https://raw.githubusercontent.com/abhisek-1221/lyra-sdk/main/apps/docs/public/logo.svg" width="42" style="vertical-align: middle" />
  Lyra SDK
</h1>

[![npm version](https://img.shields.io/npm/v/lyra-sdk.svg)](https://www.npmjs.com/package/lyra-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A powerful TypeScript SDK for working with YouTube data. Fetch videos, channels, playlists, comments, and transcripts — all with full type safety and zero dependencies.

**🌐 [Website](https://uselyra.xyz)** · **📚 [Docs](https://docs.uselyra.xyz)**

</div>

---

## Installation

```bash
npm install lyra-sdk
```

Requires Node.js 22+ and a [YouTube Data API v3 key](https://console.cloud.google.com/apis/credentials).

---

## Quick Start

```typescript
import { yt } from 'lyra-sdk'

const client = yt(process.env.YOUTUBE_API_KEY!)

// Fetch a video
const video = await client.video(videoUrl)
console.log(video.title, video.viewsFmt)

// Fetch a channel by handle
const channelHandle = '@MrBeast'
const channel = await client.channel(channelHandle)
console.log(channel.name, channel.subscribersFmt)

// Fetch a full playlist
const playlist = await client.playlist(playlistUrl)
console.log(playlist.title, playlist.videoCount)
```

---

## Fetch Video Transcript (No API Key)

```typescript
import { transcribeVideo, toPlainText } from 'lyra-sdk/transcript'

const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const lines = await transcribeVideo(videoUrl)
console.log(toPlainText(lines)) // Full transcript as plain text
```

The transcript module uses YouTube's internal Innertube API — **no quota consumption, no API key**.

---

## Production Deployments & Proxy Support

YouTube may block requests from datacenter or serverless IPs (Vercel, Cloudflare Workers, AWS Lambda, etc.) when fetching transcripts. Route requests through a residential proxy using the `customFetch` option.

**Node.js (https-proxy-agent):**

```ts
import { transcribeVideo } from 'lyra-sdk/transcript'
import { HttpsProxyAgent } from 'https-proxy-agent'

const agent = new HttpsProxyAgent('http://user:pass@proxy.webshare.io:8080')
const lines = await transcribeVideo(videoUrl, {
  customFetch: (url, init) => fetch(url, { ...init, agent }),
})
```

**Node.js 20+ (undici — no extra deps):**

```ts
import { transcribeVideo } from 'lyra-sdk/transcript'
import { ProxyAgent } from 'undici'

const agent = new ProxyAgent('http://user:pass@proxy.webshare.io:8080')
const lines = await transcribeVideo(videoUrl, {
  customFetch: (url, init) => fetch(url, { ...init, dispatcher: agent }),
})
```

Works with providers like Webshare, Bright Data, Oxylabs, Smartproxy, and any HTTP/HTTPS proxy.

---

## Transcribe Playlist (Batch)

```typescript
import { transcribePlaylist, InMemoryCache } from 'lyra-sdk'

const result = await transcribePlaylist(playlistUrl, {
  apiKey: process.env.YOUTUBE_API_KEY!,
  concurrency: 5,
  cache: new InMemoryCache(),
  onProgress(done, total, videoId, status) {
    console.log(`[${status}] ${done}/${total} — ${videoId}`)
  },
})

console.log(`Succeeded: ${result.succeeded}, Failed: ${result.failed}`)
```

**Features:** concurrency control, smart caching, partial failure handling, range filtering.

---

## Comments & Comment Threads

```typescript
// Fetch all comment threads
const threads = await client.comments(videoUrl)

// Top comments by relevance
const top5 = await client.topComments(videoUrl, 5)

// All replies to a specific comment
const replies = await client.commentReplies(commentId)

// Search comments by keyword
const results = await client.searchComments(videoUrl, 'great song')

// Compute aggregate stats
const stats = client.commentStats(videoUrl, threads)
console.log(`Unique authors: ${stats.uniqueAuthors}`)
```

---

## Playlist Query Builder

```typescript
const result = await client
  .playlistQuery(playlistUrl)
  .filterByDuration({ min: 300 })
  .filterByViews({ min: 100_000 })
  .sortBy('views', 'desc')
  .between(1, 10)
  .execute()
```

---

## URL Utilities & Formatting (No API Key)

```typescript
import { parseURL, extractVideoId } from 'lyra-sdk/url'
import { formatNumber, formatDurationClock } from 'lyra-sdk/fmt'

parseURL(videoUrl)
formatNumber(1_763_613_349) // '1.8B'
formatDurationClock(214)    // '3:34'
```

---

## Error Handling

```typescript
import { NotFoundError, QuotaError } from 'lyra-sdk'

try {
  const video = await client.video('invalid-id')
} catch (err) {
  if (err instanceof NotFoundError) console.log('Video not found')
  if (err instanceof QuotaError) console.log('API quota exceeded')
}
```

---

## Packages

### Core SDK (`lyra-sdk`)

| Package | Description |
|---------|-------------|
| `lyra-sdk` | Core SDK — videos, channels, playlists, comments, and utilities |
| `lyra-sdk/url` | Standalone URL utilities (no API key needed) |
| `lyra-sdk/fmt` | Standalone formatters (no API key needed) |
| `lyra-sdk/transcript` | Transcript and caption fetching (no API key needed for single videos) |
| `lyra-sdk/ai-tools` | Pre-built tools for Vercel AI SDK and agent workflows |

### Context Layer (`@lyra-sdk/*`)

Separate packages from `lyra-sdk`. Composable pieces for turning YouTube transcripts into searchable, citeable context for LLM workflows. The Go SDK does not include this layer yet.

| Package | Layer | Description |
|---------|-------|-------------|
| `@lyra-sdk/kernel` | Foundation | Branded ids, `TextSpan`, and the shared error hierarchy |
| `@lyra-sdk/storage` | Persistence | Document and chunk repositories, including `listByDocument` for neighbor expansion |
| `@lyra-sdk/ingestion` | Ingestion | Parsers, chunking, YouTube loading, and caption timestamps copied onto chunks |
| `@lyra-sdk/embedding` | Embedding | Provider-agnostic embedders (OpenAI, Ollama, Jina, Voyage, …) |
| `@lyra-sdk/index` | Index | Vector index contracts, similarity metrics, and `BruteForceIndex` |
| `@lyra-sdk/retrieval` | Retrieval | Dense, BM25, hybrid, parent-document, and multi-query retrievers |
| `@lyra-sdk/reranking` | Reranking | MMR, cross-encoder, and cascade rerankers |
| `@lyra-sdk/context` | Context | Score-based token budget, span merge, transcript expansion, and citation markers |
| `@lyra-sdk/prompt` | Prompt | Provider-independent prompt construction, including the `Sources` footer |
| `@lyra-sdk/generation` | Generation | LLM providers (OpenAI, Anthropic, Gemini, OpenRouter, Ollama) |
| `@lyra-sdk/pipeline` | Orchestration | `ingest` a URL or transcript, then `query` or `ask` |
| `@lyra-sdk/evaluation` | Evaluation | Recall@K, MRR, NDCG, and benchmark runners |

### Context Layer usage

**YouTube URL → ingest → semantic search (`query`)**

`ingest` accepts a YouTube URL string, `{ url }`, `{ videoId }`, or a transcript object (`meta` + `lines`). URL and video-id inputs are loaded with `CoreYouTubeTranscriptLoader` before parsing, which needs the `lyra-sdk` peer. A transcript object skips that load.

Parsing stores each caption's offset in seconds and a watch URL on the document. Chunking copies the earliest overlapping caption's offset onto `chunk.metadata.timestamp`.

`query` returns the retriever's hits. With no context builder, `context` is empty even when retrieval found chunks. `ask` throws in that case.

```typescript
import { RetrievalPipeline } from '@lyra-sdk/pipeline'
import { TranscriptParser, RecursiveChunkStrategy, SpanChunkContentResolver } from '@lyra-sdk/ingestion'
import { OpenAIEmbedder } from '@lyra-sdk/embedding'
import { BruteForceIndex, CosineSimilarity } from '@lyra-sdk/index'
import { DenseRetriever } from '@lyra-sdk/retrieval'
import { InMemoryChunkRepository, InMemoryDocumentRepository } from '@lyra-sdk/storage'

const documents = new InMemoryDocumentRepository()
const chunks = new InMemoryChunkRepository()
const index = new BruteForceIndex(new CosineSimilarity())
const embedder = new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY! })
const retriever = new DenseRetriever({ index, embedder, chunks })
const resolver = new SpanChunkContentResolver(documents)

const pipeline = new RetrievalPipeline({
  sourceParser: new TranscriptParser(),
  segmenter: new RecursiveChunkStrategy(),
  embedder,
  chunks,
  documents,
  index,
  contentResolver: resolver,
  retriever,
})

await pipeline.ingest('https://youtu.be/dQw4w9WgXcQ')
const result = await pipeline.query('What did they say about love?', 5)
console.log(result.retrieval.results.map((r) => r.score))
pipeline.dispose()
```

**Grounded answers (`ask`)**

`ask` retrieves, builds a prompt, and generates. `DefaultContextBuilder` resolves chunk text, pulls same-document neighbors inside `windowSeconds`, drops duplicates, and merges overlapping spans by slicing the source once. It keeps the highest-scoring chunks that fit `tokenBudget`, then orders those survivors (transcript time first). `ask` subtracts the system prompt, history, query, and wrapper from that budget. Share one `CharHeuristicTokenCounter` with the prompt builder so the estimate matches the rendered chunks.

Pass the same `documents` and `chunks` stores the pipeline ingested into. The builder reads titles and watch URLs from the documents and loads neighbors from the chunk repository.

The prompt prefixes each chunk with `[n]` and repeats those markers under `Sources`. A citation's label is the video title, and its URL is the watch link with `t=` set from the chunk timestamp. `generation.citations` is that list.

```typescript
import { CharHeuristicTokenCounter, DefaultContextBuilder, TranscriptOrdering, TranscriptExpander } from '@lyra-sdk/context'
import { DefaultPromptBuilder } from '@lyra-sdk/prompt'
import { OpenAIGenerator } from '@lyra-sdk/generation'

const generator = new OpenAIGenerator({ apiKey: process.env.OPENAI_API_KEY! })
const counter = new CharHeuristicTokenCounter()
const promptBuilder = new DefaultPromptBuilder({ tokenCounter: counter })

const pipeline = new RetrievalPipeline({
  // ...same wiring as above
  contextBuilder: new DefaultContextBuilder({
    tokenBudget: 4000,
    resolver,
    documents,
    chunkRepository: chunks,
    ordering: new TranscriptOrdering(),
    expander: new TranscriptExpander({ windowSeconds: 30 }),
    tokenCounter: counter,
  }),
  promptBuilder,
  generator,
})

const out = await pipeline.ask({ query: 'Summarize the key points.' })
console.log(out.generation.text)
console.log(out.generation.citations[0]?.marker, out.generation.citations[0]?.label, out.generation.citations[0]?.url)
```

---

## Agent Skills

Add Lyra SDK agent skills to your project:

```bash
npx skills add abhisek-1221/lyra-skills
```

Works with Claude Code, Codex, OpenCode etc.

---

## Vercel AI SDK

Use Lyra SDK with the Vercel AI SDK for agent-powered YouTube research:

```ts
import { createAITools } from 'lyra-sdk/ai-tools'
import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'

const ai = createAITools({ apiKey: process.env.YOUTUBE_API_KEY! })

const result = await generateText({
  model: openai('gpt-4o-mini'),
  tools: {
    getVideo:    tool(ai.getVideo),
    getChannel:  tool(ai.getChannel),
    transcribeVideo: tool(ai.transcribeVideo),
    getComments: tool(ai.getComments),
  },
  prompt: 'How many subscribers does @MrBeast have, and what is the title of his latest video?',
})

console.log(result.text)
```

Also integrates with all [Vercel AI SDK providers](https://sdk.vercel.ai/providers) — Google Gemini, Anthropic Claude, Groq, Mistral, and more.

---

## What's Coming

- **Lyra CLI** — Command-line tool for batch operations and pipeline automation
- **OpenClaw integration** — Structured data extraction powered by LLMs
- **Ollama support** — Local LLM inference for content analysis
- **Hermes Agent** — Autonomous agent for YouTube research and monitoring

**Agent framework integrations**

| Integration | Status |
|-------------|--------|
| Vercel AI SDK | Done |
| Mastra | In Progress |
| CrewAI | In Pipeline |
| LangChain | In Pipeline |

---

## Documentation

Full docs, API reference, and examples: **[docs.uselyra.xyz](https://docs.uselyra.xyz)**

---

## License

MIT

---

<div align="center">

**If you find Lyra useful, please consider giving it a ⭐ on [GitHub](https://github.com/abhisek-1221/lyra-sdk)!**

</div>
