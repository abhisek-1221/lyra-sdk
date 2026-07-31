

<div align="center">

<h1 style="font-size: 3em; line-height: 2">
  <img src="https://raw.githubusercontent.com/abhisek-1221/lyra-sdk/main/apps/docs/public/logo.svg" width="28" style="vertical-align: middle" />
  Lyra SDK
</h1>

[![npm version](https://img.shields.io/npm/v/lyra-sdk.svg)](https://www.npmjs.com/package/lyra-sdk)
[![npm downloads](https://img.shields.io/npm/dt/lyra-sdk)](https://www.npmjs.com/package/lyra-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Un SDK potente en TypeScript para trabajar con datos de YouTube. Obtén videos, canales, listas de reproducción, comentarios y transcripciones, todo con seguridad de tipos completa y cero dependencias.

**🌐 [Sitio web](https://uselyra.xyz)** · **📚 [Documentación](https://docs.uselyra.xyz)**
<img width="1302" height="850" alt="LYRA-HEADER" src="https://github.com/user-attachments/assets/84be664e-2fec-424b-ac95-9175671d64b5" />
</div>

---

## Instalación

```bash
npm install lyra-sdk
```

Requiere Node.js 18+ y una [clave de API de YouTube Data API v3](https://console.cloud.google.com/apis/credentials).

---

## Inicio rápido

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

## Obtener transcripción de video (sin clave de API)

```typescript
import { transcribeVideo, toPlainText } from 'lyra-sdk/transcript'

const videoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
const lines = await transcribeVideo(videoUrl)
console.log(lines[0].text) // "♪ We're no strangers to love ♪"
console.log(toPlainText(lines)) // Full transcript as plain text
```

El módulo de transcripciones utiliza la API interna de Innertube de YouTube: **sin consumo de cuota, sin clave de API**.

---

## Transcribir lista de reproducción (por lotes)

Obtén transcripciones para cada video de una lista de reproducción con control de concurrencia y seguimiento del progreso:

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

**Características:**
- **Control de concurrencia** — Procesa hasta 20 videos en paralelo
- **Caché inteligente** — `InMemoryCache` (~0.03ms hits) o `FsCache` (~0.3ms hits)
- **Manejo de fallos parciales** — Los fallos de videos individuales no interrumpen el lote
- **Filtrado por rango** — Usa `from`/`to` para procesar un subconjunto de la lista de reproducción

---

## Comentarios y hilos de comentarios

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

## Constructor de consultas de listas de reproducción

Filtra, ordena y extrae fragmentos de videos de listas de reproducción con una API encadenable:

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

## Utilidades para URLs (sin clave de API)

```typescript
import { parseURL, extractVideoId } from 'lyra-sdk/url'

const videoUrl = 'https://youtu.be/dQw4w9WgXcQ'
const result = parseURL(videoUrl)
// { isValid: true, type: 'video', videoId: 'dQw4w9WgXcQ' }

extractVideoId(videoUrl) // 'dQw4w9WgXcQ'
```

---

## Formateo (sin clave de API)

```typescript
import { formatNumber, formatDurationClock, relativeTime } from 'lyra-sdk/fmt'

formatNumber(1_763_613_349)   // '1.8B'
formatDurationClock(214)       // '3:34'
relativeTime(new Date('2025-01-01')) // '3 months ago'
```

---

## Manejo de errores

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

## Paquetes

| Paquete | Descripción |
|---------|-------------|
| `lyra-sdk` | SDK principal: todas las funciones, tipos y utilidades |
| `lyra-sdk/url` | Utilidades para URLs independientes (no requiere clave de API) |
| `lyra-sdk/fmt` | Formateadores independientes (no requiere clave de API) |
| `lyra-sdk/transcript` | Obtención de transcripciones y subtítulos (no requiere clave de API para videos individuales) |

---

## Desarrollo y pruebas

El repositorio tiene dos capas de pruebas:

- **Pruebas unitarias** en `packages/core/tests/` — rápidas, totalmente simuladas, se ejecutan en cada PR.
- **Pruebas de extremo a extremo** en `e2e/` — ponen a prueba el SDK compilado contra los puntos finales reales de YouTube Data API / innertube. Requieren `YOUTUBE_API_KEY`; se omiten automáticamente si no está configurada. Se ejecutan a diario en CI y bajo demanda.

```bash
# Unit tests
npm test

# End-to-end tests (requires YOUTUBE_API_KEY)
export YOUTUBE_API_KEY=AIza...
npm run test:e2e
```

---

## Próximas características

- **Lyra CLI** — Herramienta de línea de comandos para operaciones por lotes y automatización de flujos de trabajo
- **Integración con OpenClaw** — Extracción de datos estructurada impulsada por LLMs
- **Soporte para Ollama** — Inferencia local de LLMs para análisis de contenido
- **Agente Hermes** — Agente autónomo para investigación y monitoreo en YouTube
- **Soporte nativo para herramientas** — Integraciones nativas con Vercel AI SDK, Mastra y LangChain

---

## Documentación

Documentación completa, referencia de la API y ejemplos: **[docs.uselyra.xyz](https://docs.uselyra.xyz)**

---

## Licencia

MIT

---

<div align="center">

**Si encuentras Lyra útil, por favor considera darle una ⭐ en [GitHub](https://github.com/abhisek-1221/lyra-sdk)!**

</div>
