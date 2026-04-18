# lyra-sdk Express API Example

REST API that wraps all `lyra-sdk` functions. Test every endpoint in Postman.

## Start the server

```bash
cd packages/sdk-examples
npm run dev:express
```

Runs on `http://localhost:3000` (override with `PORT` env var).

Requires `YOUTUBE_API_KEY` in your `.env` file.

---

## Endpoints

### Video

#### GET `/api/video/:id`

Fetch full video details by ID or URL.

**Postman**

| Field  | Value                                         |
| ------ | --------------------------------------------- |
| Method | `GET`                                         |
| URL    | `http://localhost:3000/api/video/dQw4w9WgXcQ` |

**Response**

```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)",
  "channel": "Rick Astley",
  "views": 1763247324,
  "viewsFmt": "1.8B",
  "likes": 18942897,
  "likesFmt": "19M",
  "duration": 214,
  "durationFmt": "3:34",
  "published": "October 25, 2009",
  "thumbnails": { ... }
}
```

Also accepts URLs:

```
http://localhost:3000/api/video/https://youtu.be/dQw4w9WgXcQ
```

> **Postman tip:** URL-encode the query. Use path variable `:id` = `dQw4w9WgXcQ` or the full URL encoded.

---

#### GET `/api/videos`

Batch fetch multiple videos.

**Postman**

| Field  | Value                                                          |
| ------ | -------------------------------------------------------------- |
| Method | `GET`                                                          |
| URL    | `http://localhost:3000/api/videos?ids=dQw4w9WgXcQ,jNQXAC9IVRw` |

| Param | Type  | Description                          |
| ----- | ----- | ------------------------------------ |
| `ids` | query | Comma-separated video IDs (required) |

**Response**

```json
[
  { "id": "dQw4w9WgXcQ", "title": "...", ... },
  { "id": "jNQXAC9IVRw", "title": "...", ... }
]
```

---

#### GET `/api/video/:id/title`

Lightweight title-only lookup (1 quota unit).

**Postman**

| Field  | Value                                               |
| ------ | --------------------------------------------------- |
| Method | `GET`                                               |
| URL    | `http://localhost:3000/api/video/dQw4w9WgXcQ/title` |

**Response**

```json
{
  "id": "dQw4w9WgXcQ",
  "title": "Rick Astley - Never Gonna Give You Up (Official Video) (4K Remaster)"
}
```

---

### Channel

#### GET `/api/channel/:id`

Fetch channel metadata. Accepts channel ID, `@username`, or URL.

**Postman**

| Field  | Value                                        |
| ------ | -------------------------------------------- |
| Method | `GET`                                        |
| URL    | `http://localhost:3000/api/channel/@MrBeast` |

**Response**

```json
{
  "id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
  "name": "MrBeast",
  "username": "@@mrbeast",
  "subscribers": 478000000,
  "subscribersFmt": "478M",
  "totalViews": 118018708949,
  "totalViewsFmt": "118B",
  "videoCount": 964,
  "country": "US"
}
```

---

#### GET `/api/channel/:id/videos`

Fetch recent uploads for a channel.

**Postman**

| Field  | Value                                                       |
| ------ | ----------------------------------------------------------- |
| Method | `GET`                                                       |
| URL    | `http://localhost:3000/api/channel/@MrBeast/videos?limit=3` |

| Param   | Type  | Description                            |
| ------- | ----- | -------------------------------------- |
| `limit` | query | Max videos to return (1-50, default 5) |

**Response**

```json
[
  {
    "id": "...",
    "title": "Last To Leave Grocery Store, Wins $250,000!",
    "views": 150000000,
    "viewsFmt": "150M",
    "durationFmt": "25:30",
    "uploadAge": "3 weeks ago"
  }
]
```

---

### Playlist

#### GET `/api/playlist/:id`

Fetch complete playlist with all videos, stats, and total duration.

**Postman**

| Field  | Value                                                                   |
| ------ | ----------------------------------------------------------------------- |
| Method | `GET`                                                                   |
| URL    | `http://localhost:3000/api/playlist/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf` |

**Response**

```json
{
  "id": "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
  "title": "Select Lectures",
  "description": "...",
  "videoCount": 2,
  "totalDuration": 9347,
  "totalDurationFmt": "2h 35m 47s",
  "videos": [
    {
      "id": "...",
      "title": "...",
      "viewsFmt": "2.5M",
      "durationFmt": "1:08:06"
    }
  ]
}
```

---

#### GET `/api/playlist/:id/info`

Playlist metadata only — no videos (1 quota unit).

**Postman**

| Field  | Value                                                                        |
| ------ | ---------------------------------------------------------------------------- |
| Method | `GET`                                                                        |
| URL    | `http://localhost:3000/api/playlist/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf/info` |

**Response**

```json
{
  "id": "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
  "title": "Select Lectures",
  "description": "...",
  "thumbnails": { ... }
}
```

---

#### GET `/api/playlist/:id/ids`

Fetch all video IDs in a playlist (auto-paginates).

**Postman**

| Field  | Value                                                                       |
| ------ | --------------------------------------------------------------------------- |
| Method | `GET`                                                                       |
| URL    | `http://localhost:3000/api/playlist/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf/ids` |

**Response**

```json
{
  "id": "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
  "videoIds": ["0VH1Lim8gL8", "O5xeyoRL95U"],
  "count": 2
}
```

---

#### POST `/api/playlist/:id/query`

Filter, sort, and slice playlist videos.

**Postman**

| Field   | Value                                                                         |
| ------- | ----------------------------------------------------------------------------- |
| Method  | `POST`                                                                        |
| URL     | `http://localhost:3000/api/playlist/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf/query` |
| Headers | `Content-Type: application/json`                                              |
| Body    | raw JSON (see below)                                                          |

**Request body — all fields optional:**

```json
{
  "filter": {
    "duration": { "min": 300 },
    "views": { "min": 100000, "max": 5000000 },
    "likes": { "min": 1000 }
  },
  "sort": {
    "field": "views",
    "order": "desc"
  },
  "range": {
    "start": 1,
    "end": 10
  }
}
```

| Field                 | Type   | Description                            |
| --------------------- | ------ | -------------------------------------- |
| `filter.duration.min` | number | Min duration in seconds                |
| `filter.duration.max` | number | Max duration in seconds                |
| `filter.views.min`    | number | Min view count                         |
| `filter.views.max`    | number | Max view count                         |
| `filter.likes.min`    | number | Min like count                         |
| `filter.likes.max`    | number | Max like count                         |
| `sort.field`          | string | `"duration"` \| `"views"` \| `"likes"` |
| `sort.order`          | string | `"asc"` \| `"desc"`                    |
| `range.start`         | number | 1-indexed start (inclusive)            |
| `range.end`           | number | 1-indexed end (inclusive)              |

**Examples**

Sort by views, top 10:

```json
{
  "sort": { "field": "views", "order": "desc" },
  "range": { "start": 1, "end": 10 }
}
```

Videos 5-15 minutes only:

```json
{
  "filter": { "duration": { "min": 300, "max": 900 } }
}
```

**Response**

```json
{
  "id": "PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
  "title": "Select Lectures",
  "description": "...",
  "videos": [ ... ],
  "videoCount": 2,
  "originalCount": 2,
  "totalDuration": 9347,
  "totalDurationFmt": "2h 35m 47s"
}
```

---

### URL Utilities

#### POST `/api/url/parse`

Parse a YouTube URL into a structured result.

**Postman**

| Field   | Value                                 |
| ------- | ------------------------------------- |
| Method  | `POST`                                |
| URL     | `http://localhost:3000/api/url/parse` |
| Headers | `Content-Type: application/json`      |
| Body    | raw JSON                              |

```json
{ "url": "https://youtu.be/dQw4w9WgXcQ" }
```

**Response**

```json
{
  "isValid": true,
  "type": "video",
  "videoId": "dQw4w9WgXcQ"
}
```

---

#### POST `/api/url/extract`

Extract IDs from a YouTube URL.

**Postman**

| Field   | Value                                   |
| ------- | --------------------------------------- |
| Method  | `POST`                                  |
| URL     | `http://localhost:3000/api/url/extract` |
| Headers | `Content-Type: application/json`        |
| Body    | raw JSON                                |

```json
{ "url": "https://www.youtube.com/playlist?list=PLtest123" }
```

Optional `type` field forces extraction mode:

```json
{ "url": "https://youtu.be/dQw4w9WgXcQ", "type": "video" }
```

**Response**

```json
{
  "type": "playlist",
  "playlistId": "PLtest123"
}
```

---

## Error Responses

All errors follow the same format:

```json
{
  "error": {
    "code": 404,
    "message": "Video not found: INVALID_ID"
  }
}
```

| HTTP Status | Cause                                 |
| ----------- | ------------------------------------- |
| `400`       | Validation error (Zod) or invalid URL |
| `401`       | Invalid YouTube API key               |
| `404`       | Video/channel/playlist not found      |
| `429`       | YouTube API quota exceeded            |
| `502`       | YouTube API error                     |
| `500`       | Internal server error                 |

Validation errors include details:

```json
{
  "error": {
    "code": 400,
    "message": "Validation error",
    "details": ["url: Invalid input: expected string, received undefined"]
  }
}
```

---

## Postman Collection Setup

1. Create a new collection called **lyra-sdk API**
2. Set a collection variable `base_url` = `http://localhost:3000`
3. Add requests using the endpoints above
4. For `POST` endpoints, set **Body** → **raw** → **JSON** and paste the request body

### Quick import

Save this as `postman_collection.json` and import into Postman:

```json
{
  "info": {
    "name": "lyra-sdk API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Video",
      "item": [
        {
          "name": "Get Video",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/api/video/dQw4w9WgXcQ"
          }
        },
        {
          "name": "Get Videos (batch)",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/api/videos?ids=dQw4w9WgXcQ,jNQXAC9IVRw"
          }
        },
        {
          "name": "Get Video Title",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/api/video/dQw4w9WgXcQ/title"
          }
        }
      ]
    },
    {
      "name": "Channel",
      "item": [
        {
          "name": "Get Channel",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/api/channel/@MrBeast"
          }
        },
        {
          "name": "Get Channel Videos",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/api/channel/@MrBeast/videos?limit=5"
          }
        }
      ]
    },
    {
      "name": "Playlist",
      "item": [
        {
          "name": "Get Playlist",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/api/playlist/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf"
          }
        },
        {
          "name": "Get Playlist Info",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/api/playlist/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf/info"
          }
        },
        {
          "name": "Get Playlist IDs",
          "request": {
            "method": "GET",
            "url": "{{base_url}}/api/playlist/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf/ids"
          }
        },
        {
          "name": "Query Playlist",
          "request": {
            "method": "POST",
            "header": [{ "key": "Content-Type", "value": "application/json" }],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"sort\": { \"field\": \"views\", \"order\": \"desc\" },\n  \"range\": { \"start\": 1, \"end\": 10 }\n}"
            },
            "url": "{{base_url}}/api/playlist/PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf/query"
          }
        }
      ]
    },
    {
      "name": "URL",
      "item": [
        {
          "name": "Parse URL",
          "request": {
            "method": "POST",
            "header": [{ "key": "Content-Type", "value": "application/json" }],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"url\": \"https://youtu.be/dQw4w9WgXcQ\"\n}"
            },
            "url": "{{base_url}}/api/url/parse"
          }
        },
        {
          "name": "Extract URL",
          "request": {
            "method": "POST",
            "header": [{ "key": "Content-Type", "value": "application/json" }],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"url\": \"https://www.youtube.com/playlist?list=PLtest123\"\n}"
            },
            "url": "{{base_url}}/api/url/extract"
          }
        }
      ]
    }
  ],
  "variable": [{ "key": "base_url", "value": "http://localhost:3000" }]
}
```
