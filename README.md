
<div align="center">

<h1 style="font-size: 3em; line-height: 2">
  <img src="https://raw.githubusercontent.com/abhisek-1221/lyra-sdk/main/apps/docs/public/logo.svg" width="28" style="vertical-align: middle" />
  Lyra SDK
</h1>

[![npm version](https://img.shields.io/npm/v/lyra-sdk.svg)](https://www.npmjs.com/package/lyra-sdk)
[![npm downloads](https://img.shields.io/npm/dt/lyra-sdk)](https://www.npmjs.com/package/lyra-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A powerful TypeScript SDK for working with YouTube data. Fetch videos, channels, playlists, comments, and transcripts — all with full type safety and zero dependencies.

**🌐 [Website](https://uselyra.xyz)** · **📚 [Docs](https://docs.uselyra.xyz)**
<img width="1302" height="850" alt="LYRA-HEADER" src="https://github.com/user-attachments/assets/84be664e-2fec-424b-ac95-9175671d64b5" />
</div>

---

## Installation

```bash
npm install lyra-sdk
```

Requires Node.js 18+ and a [YouTube Data API v3 key](https://console.cloud.google.com/apis/credentials).

---

## Quick Start

```typescript
import { yt } from 'lyra-sdk'

const client = yt(process.env.YOUTUBE_API_KEY!)

// Fetch a video
const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const video = await client.video(videoUrl)
console.log(video.title, video.viewsFmt) // "Rick Astley - Never Gonna Give You Up", "1.8B"

// Fetch a channel by handle
const channelHandle = '@MrBeast'
const channel = await client.channel(channelHandle)
console.log(channel.name, channel.subscribersFmt) // "MrBeast", "478M"

// Fetch a full playlist
const playlistUrl = 'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'
const playlist = await client.playlist(playlistUrl)
console.log(playlist.title, playlist.videoCount)
```

---

## Fetch Video Transcript (No API Key)

```typescript
import { transcribeVideo, toPlainText } from 'lyra-sdk/transcript'

const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const lines = await transcribeVideo(videoUrl)
console.log(lines[0].text) // "♪ We're no strangers to love ♪"
console.log(toPlainText(lines)) // Full transcript as plain text
```

The transcript module uses YouTube's internal Innertube API — **no quota consumption, no API key**.

---

## Transcribe Playlist (Batch)

Fetch transcripts for every video in a playlist with concurrency control and progress tracking:

```typescript
import { transcribePlaylist, InMemoryCache } from 'lyra-sdk'

const cache = new InMemoryCache()

const playlistUrl = 'https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'
const result = await transcribePlaylist(playlistUrl, {
  apiKey: process.env.YOUTUBE_API_KEY!,
  concurrency: 5,
  cache,
  onProgress(done, total, videoId, status) {
    console.log(`[${status}] ${done}/${total} — ${videoId}`)
  },
})

console.log(`Succeeded: ${result.succeeded}, Failed: ${result.failed}`)
```

**Features:**
- **Concurrency control** — Process up to 20 videos in parallel
- **Smart caching** — `InMemoryCache` (~0.03ms hits) or `FsCache` (~0.3ms hits)
- **Partial failure handling** — Individual video failures don't kill the batch
- **Range filtering** — Use `from`/`to` to process a subset of the playlist

---

## Comments & Comment Threads

```typescript
// Fetch all comment threads
const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const threads = await client.comments(videoUrl)

// Top comments by relevance
const top5 = await client.topComments(videoUrl, 5)

// All replies to a specific comment
const replies = await client.commentReplies('UgwSomeCommentId')

// Search comments by keyword
const results = await client.searchComments(videoUrl, 'great song')

// Compute aggregate stats
const stats = client.commentStats(videoUrl, threads)
console.log(`Unique authors: ${stats.uniqueAuthors}`)
console.log(`Most liked: ${stats.mostLikedComment?.text}`)
```

---

## Playlist Query Builder

Filter, sort, and slice playlist videos with a chainable API:

```typescript
const result = await client
  .playlistQuery(playlistUrl)
  .filterByDuration({ min: 300 })      // At least 5 minutes
  .filterByViews({ min: 100_000 })     // At least 100K views
  .sortBy('views', 'desc')             // Sort by views, descending
  .between(1, 10)                      // Top 10 results
  .execute()
```

---

## URL Utilities (No API Key)

```typescript
import { parseURL, extractVideoId } from 'lyra-sdk/url'

const videoUrl = 'https://youtu.be/dQw4w9WgXcQ'
const result = parseURL(videoUrl)
// { isValid: true, type: 'video', videoId: 'dQw4w9WgXcQ' }

extractVideoId(videoUrl) // 'dQw4w9WgXcQ'
```

---

## Formatting (No API Key)

```typescript
import { formatNumber, formatDurationClock, relativeTime } from 'lyra-sdk/fmt'

formatNumber(1_763_613_349)   // '1.8B'
formatDurationClock(214)       // '3:34'
relativeTime(new Date('2025-01-01')) // '3 months ago'
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

### RAG runtime (`@lyra-sdk/*`)

Composable packages for building retrieval and RAG pipelines on top of YouTube transcripts.

| Package | Layer | Description |
|---------|-------|-------------|
| `@lyra-sdk/kernel` | Foundation | Branded ids, `TextSpan`, and the shared error hierarchy |
| `@lyra-sdk/storage` | Persistence | Document and chunk repositories (in-memory in Phase 1) |
| `@lyra-sdk/ingestion` | Ingestion | Source parsers, chunk strategies, and YouTube transcript loading |
| `@lyra-sdk/embedding` | Embedding | Provider-agnostic embedders (OpenAI, Ollama, Jina, Voyage, …) |
| `@lyra-sdk/index` | Index | Vector index contracts, similarity metrics, and `BruteForceIndex` |
| `@lyra-sdk/retrieval` | Retrieval | Dense, BM25, hybrid, parent-document, and multi-query retrievers |
| `@lyra-sdk/reranking` | Reranking | MMR, cross-encoder, and cascade rerankers |
| `@lyra-sdk/context` | Context | Token budgeting, ordering, expansion, deduplication, and citations |
| `@lyra-sdk/prompt` | Prompt | Provider-independent prompt construction |
| `@lyra-sdk/generation` | Generation | LLM providers (OpenAI, Anthropic, Gemini, OpenRouter, Ollama) |
| `@lyra-sdk/pipeline` | Orchestration | `RetrievalPipeline` — ingest, query, and `ask()` end-to-end |
| `@lyra-sdk/evaluation` | Evaluation | Recall@K, MRR, NDCG, and benchmark runners |

### Context Layer Usage

**YouTube URL → transcript → `SourceDocument`**

```typescript
import { CoreYouTubeTranscriptLoader, TranscriptParser } from '@lyra-sdk/ingestion'

const loader = new CoreYouTubeTranscriptLoader()
const transcript = await loader.load({ url: 'https://youtu.be/dQw4w9WgXcQ' })
const document = new TranscriptParser().parse(transcript)
```

**Retrieval-only pipeline (`query`)**

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

await pipeline.ingest(transcript)
const result = await pipeline.query('What did they say about love?', 5)
console.log(result.retrieval.results.map((r) => r.score))
pipeline.dispose()
```

**Full Context (`ask`)**

```typescript
import { DefaultContextBuilder, TranscriptOrdering, TranscriptExpander } from '@lyra-sdk/context'
import { DefaultPromptBuilder } from '@lyra-sdk/prompt'
import { OpenAIGenerator } from '@lyra-sdk/generation'

const generator = new OpenAIGenerator({ apiKey: process.env.OPENAI_API_KEY! })

const pipeline = new RetrievalPipeline({
  // ...same wiring as above
  contextBuilder: new DefaultContextBuilder({
    tokenBudget: 4000,
    resolver,
    ordering: new TranscriptOrdering(),
    expander: new TranscriptExpander(),
  }),
  promptBuilder: new DefaultPromptBuilder(),
  generator,
})

const out = await pipeline.ask({ query: 'Summarize the key points.' })
console.log(out.generation.text)
console.log(out.generation.citations)
```

**Vercel AI SDK tools**

```typescript
import { createAITools } from 'lyra-sdk/ai-tools'
import { generateText, tool } from 'ai'
import { openai } from '@ai-sdk/openai'

const ai = createAITools({ apiKey: process.env.YOUTUBE_API_KEY! })

const result = await generateText({
  model: openai('gpt-4o-mini'),
  tools: {
    getVideo: tool(ai.getVideo),
    transcribeVideo: tool(ai.transcribeVideo),
  },
  prompt: 'What is the title of dQw4w9WgXcQ?',
})

console.log(result.text)
```

---

## Development & Testing

The repo has two test layers:

- **Unit tests** in `packages/core/tests/` — fast, fully-mocked, run on every PR.
- **End-to-end tests** in `e2e/` — exercise the built SDK against the real YouTube Data API / innertube endpoints. Gated on `YOUTUBE_API_KEY`; auto-skips when unset. Runs nightly in CI plus on demand.

```bash
# Unit tests
npm test

# End-to-end tests (requires YOUTUBE_API_KEY)
export YOUTUBE_API_KEY=AIza...
npm run test:e2e
```

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

Full documentation, API reference, and examples: **[docs.uselyra.xyz](https://docs.uselyra.xyz)**

---

## License

MIT

---

<div align="center">

**If you find Lyra useful, please consider giving it a ⭐ on [GitHub](https://github.com/abhisek-1221/lyra-sdk)!**

</div>
