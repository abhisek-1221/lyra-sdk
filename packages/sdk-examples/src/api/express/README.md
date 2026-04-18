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
    "description": "The official video for “Never Gonna Give You Up” by Rick Astley. \n\nNever: The Autobiography 📚 OUT NOW! \nFollow this link to get your copy and listen to Rick’s ‘Never’ playlist ❤️ #RickAstleyNever\nhttps://linktr.ee/rickastleynever\n\n“Never Gonna Give You Up” was a global smash on its release in July 1987, topping the charts in 25 countries including Rick’s native UK and the US Billboard Hot 100.  It also won the Brit Award for Best single in 1988. Stock Aitken and Waterman wrote and produced the track which was the lead-off single and lead track from Rick’s debut LP “Whenever You Need Somebody”.  The album was itself a UK number one and would go on to sell over 15 million copies worldwide.\n\nThe legendary video was directed by Simon West – who later went on to make Hollywood blockbusters such as Con Air, Lara Croft – Tomb Raider and The Expendables 2.  The video passed the 1bn YouTube views milestone on 28 July 2021.\n\nSubscribe to the official Rick Astley YouTube channel: https://RickAstley.lnk.to/YTSubID\n\nFollow Rick Astley:\nFacebook: https://RickAstley.lnk.to/FBFollowID \nTwitter: https://RickAstley.lnk.to/TwitterID \nInstagram: https://RickAstley.lnk.to/InstagramID \nWebsite: https://RickAstley.lnk.to/storeID \nTikTok: https://RickAstley.lnk.to/TikTokID\n\nListen to Rick Astley:\nSpotify: https://RickAstley.lnk.to/SpotifyID \nApple Music: https://RickAstley.lnk.to/AppleMusicID \nAmazon Music: https://RickAstley.lnk.to/AmazonMusicID \nDeezer: https://RickAstley.lnk.to/DeezerID \n\nLyrics:\nWe’re no strangers to love\nYou know the rules and so do I\nA full commitment’s what I’m thinking of\nYou wouldn’t get this from any other guy\n\nI just wanna tell you how I’m feeling\nGotta make you understand\n\nNever gonna give you up\nNever gonna let you down\nNever gonna run around and desert you\nNever gonna make you cry\nNever gonna say goodbye\nNever gonna tell a lie and hurt you\n\nWe’ve known each other for so long\nYour heart’s been aching but you’re too shy to say it\nInside we both know what’s been going on\nWe know the game and we’re gonna play it\n\nAnd if you ask me how I’m feeling\nDon’t tell me you’re too blind to see\n\nNever gonna give you up\nNever gonna let you down\nNever gonna run around and desert you\nNever gonna make you cry\nNever gonna say goodbye\nNever gonna tell a lie and hurt you\n\n#RickAstley #NeverGonnaGiveYouUp #WheneverYouNeedSomebody #OfficialMusicVideo",
    "channel": "Rick Astley",
    "channelId": "UCuAXFkgsw1L7xaCfnd5JJOw",
    "views": 1763613349,
    "viewsFmt": "1.8B",
    "likes": 18945406,
    "likesFmt": "19M",
    "comments": 2434523,
    "commentsFmt": "2.4M",
    "duration": 214,
    "durationFmt": "3:34",
    "published": "October 25, 2009",
    "publishedAt": "2009-10-25T06:57:33.000Z",
    "thumbnails": {
        "default": {
            "url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/default.jpg",
            "width": 120,
            "height": 90
        },
        "medium": {
            "url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg",
            "width": 320,
            "height": 180
        },
        "high": {
            "url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
            "width": 480,
            "height": 360
        },
        "standard": {
            "url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/sddefault.jpg",
            "width": 640,
            "height": 480
        },
        "maxres": {
            "url": "https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg",
            "width": 1280,
            "height": 720
        }
    }
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
    "totalViews": 118147810313,
    "totalViewsFmt": "118B",
    "videoCount": 966,
    "country": "US",
    "thumbnails": {
        "default": {
            "url": "https://yt3.ggpht.com/nxYrc_1_2f77DoBadyxMTmv7ZpRZapHR5jbuYe7PlPd5cIRJxtNNEYyOC0ZsxaDyJJzXrnJiuDE=s88-c-k-c0x00ffffff-no-rj",
            "width": 88,
            "height": 88
        },
        "medium": {
            "url": "https://yt3.ggpht.com/nxYrc_1_2f77DoBadyxMTmv7ZpRZapHR5jbuYe7PlPd5cIRJxtNNEYyOC0ZsxaDyJJzXrnJiuDE=s240-c-k-c0x00ffffff-no-rj",
            "width": 240,
            "height": 240
        },
        "high": {
            "url": "https://yt3.ggpht.com/nxYrc_1_2f77DoBadyxMTmv7ZpRZapHR5jbuYe7PlPd5cIRJxtNNEYyOC0ZsxaDyJJzXrnJiuDE=s800-c-k-c0x00ffffff-no-rj",
            "width": 800,
            "height": 800
        }
    },
    "uploadsPlaylistId": "UUX6OQ3DkcsbYNE6H8uQQuVA"
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
        "id": "zRtGL0-5rg4",
        "title": "Last To Leave Grocery Store, Wins $250,000",
        "views": 2668870,
        "viewsFmt": "2.7M",
        "likes": 228850,
        "likesFmt": "229K",
        "duration": 2577,
        "durationFmt": "42:57",
        "thumbnail": "https://i.ytimg.com/vi/zRtGL0-5rg4/hqdefault.jpg",
        "uploadAge": "1 hour ago",
        "publishedAt": "2026-04-18T16:00:01.000Z"
    },
    {
        "id": "mFWpUx3FiyU",
        "title": "Guess The Animal",
        "views": 33766913,
        "viewsFmt": "34M",
        "likes": 546436,
        "likesFmt": "546K",
        "duration": 45,
        "durationFmt": "0:45",
        "thumbnail": "https://i.ytimg.com/vi/mFWpUx3FiyU/hqdefault.jpg",
        "uploadAge": "1 day ago",
        "publishedAt": "2026-04-17T16:00:01.000Z"
    },
    {
        "id": "6W_841xoprg",
        "title": "Can a Window Stop a Wrecking Ball?",
        "views": 43938442,
        "viewsFmt": "44M",
        "likes": 1072621,
        "likesFmt": "1.1M",
        "duration": 30,
        "durationFmt": "0:30",
        "thumbnail": "https://i.ytimg.com/vi/6W_841xoprg/hqdefault.jpg",
        "uploadAge": "4 days ago",
        "publishedAt": "2026-04-14T16:00:01.000Z"
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
    "description": "Some lectures on deep learning, deep reinforcement learning, autonomous vehicles, and artificial intelligence. https://deeplearning.mit.edu",
    "thumbnails": {
        "default": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/default.jpg",
            "width": 120,
            "height": 90
        },
        "medium": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/mqdefault.jpg",
            "width": 320,
            "height": 180
        },
        "high": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/hqdefault.jpg",
            "width": 480,
            "height": 360
        },
        "standard": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/sddefault.jpg",
            "width": 640,
            "height": 480
        },
        "maxres": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/maxresdefault.jpg",
            "width": 1280,
            "height": 720
        }
    },
    "videoCount": 2,
    "totalDuration": 9347,
    "totalDurationFmt": "2h 35m 47s",
    "videos": [
        {
            "id": "0VH1Lim8gL8",
            "title": "Deep Learning State of the Art (2020)",
            "description": "Lecture on most recent research and developments in deep learning, and hopes for 2020. This is not intended to be a list of SOTA benchmark results, but rather a set of highlights of machine learning and AI innovations and progress in academia, industry, and society in general. This lecture is part of the MIT Deep Learning Lecture Series.\n\nWebsite: https://deeplearning.mit.edu\nSlides: http://bit.ly/2QEfbAm\nReferences: http://bit.ly/deeplearn-sota-2020\nPlaylist: http://bit.ly/deep-learning-playlist\n\nOUTLINE:\n0:00 - Introduction\n0:33 - AI in the context of human history\n5:47 - Deep learning celebrations, growth, and limitations\n6:35 - Deep learning early key figures\n9:29 - Limitations of deep learning\n11:01 - Hopes for 2020: deep learning community and research\n12:50 - Deep learning frameworks: TensorFlow and PyTorch\n15:11 - Deep RL frameworks\n16:13 - Hopes for 2020: deep learning and deep RL frameworks\n17:53 - Natural language processing\n19:42 - Megatron, XLNet, ALBERT\n21:21 - Write with transformer examples\n24:28 - GPT-2 release strategies report\n26:25 - Multi-domain dialogue\n27:13 - Commonsense reasoning\n28:26 - Alexa prize and open-domain conversation\n33:44 - Hopes for 2020: natural language processing\n35:11 - Deep RL and self-play\n35:30 - OpenAI Five and Dota 2\n37:04 - DeepMind Quake III Arena\n39:07 - DeepMind AlphaStar\n41:09 - Pluribus: six-player no-limit Texas hold'em poker\n43:13 - OpenAI Rubik's Cube\n44:49 - Hopes for 2020: Deep RL and self-play\n45:52 - Science of deep learning\n46:01 - Lottery ticket hypothesis\n47:29 - Disentangled representations\n48:34 - Deep double descent\n49:30 - Hopes for 2020: science of deep learning\n50:56 - Autonomous vehicles and AI-assisted driving\n51:50 - Waymo\n52:42 - Tesla Autopilot\n57:03 - Open question for Level 2 and Level 4 approaches\n59:55 - Hopes for 2020: autonomous vehicles and AI-assisted driving\n1:01:43 - Government, politics, policy\n1:03:03 - Recommendation systems and policy\n1:05:36 - Hopes for 2020: Politics, policy and recommendation systems\n1:06:50 - Courses, Tutorials, Books\n1:10:05 - General hopes for 2020\n1:11:19 - Recipe for progress in AI\n1:14:15 - Q&A: what made you interested in AI\n1:15:21 - Q&A: Will machines ever be able to think and feel?\n1:18:20 - Q&A: Is RL a good candidate for achieving AGI?\n1:21:31 - Q&A: Are autonomous vehicles responsive to sound?\n1:22:43 - Q&A: What does the future with AGI look like? \n1:25:50 - Q&A: Will AGI systems become our masters?\n\nCONNECT:\n- If you enjoyed this video, please subscribe to this channel.\n- Twitter: https://twitter.com/lexfridman\n- LinkedIn: https://www.linkedin.com/in/lexfridman\n- Facebook: https://www.facebook.com/lexfridman\n- Instagram: https://www.instagram.com/lexfridman",
            "channelTitle": "Lex Fridman",
            "publishedAt": "2020-01-10T16:04:31.000Z",
            "duration": 5261,
            "durationFmt": "1:27:41",
            "views": 1362759,
            "viewsFmt": "1.4M",
            "likes": 27457,
            "likesFmt": "27K",
            "thumbnails": {
                "default": {
                    "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/default.jpg",
                    "width": 120,
                    "height": 90
                },
                "medium": {
                    "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/mqdefault.jpg",
                    "width": 320,
                    "height": 180
                },
                "high": {
                    "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/hqdefault.jpg",
                    "width": 480,
                    "height": 360
                },
                "standard": {
                    "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/sddefault.jpg",
                    "width": 640,
                    "height": 480
                },
                "maxres": {
                    "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/maxresdefault.jpg",
                    "width": 1280,
                    "height": 720
                }
            }
        },
        {
            "id": "O5xeyoRL95U",
            "title": "Deep Learning Basics: Introduction and Overview",
            "description": "An introductory lecture for MIT course 6.S094 on the basics of deep learning including a few key ideas, subfields, and the big picture of why neural networks have inspired and energized an entire new generation of researchers. For more lecture videos on deep learning, reinforcement learning (RL), artificial intelligence (AI & AGI), and podcast conversations, visit our website or follow TensorFlow code tutorials on our GitHub repo.\n\nINFO:\nWebsite: https://deeplearning.mit.edu\nGitHub: https://github.com/lexfridman/mit-deep-learning\nSlides: http://bit.ly/deep-learning-basics-slides\nPlaylist: http://bit.ly/deep-learning-playlist\nBlog post: https://link.medium.com/TkE476jw2T\n\nOUTLINE:\n0:00 - Introduction\n0:53 - Deep learning in one slide\n4:55 - History of ideas and tools\n9:43 - Simple example in TensorFlow\n11:36 - TensorFlow in one slide\n13:32 - Deep learning is representation learning\n16:02 - Why deep learning (and why not)\n22:00 - Challenges for supervised learning\n38:27 - Key low-level concepts\n46:15 - Higher-level methods\n1:06:00 - Toward artificial general intelligence\n\nCONNECT:\n- If you enjoyed this video, please subscribe to this channel.\n- Twitter: https://twitter.com/lexfridman\n- LinkedIn: https://www.linkedin.com/in/lexfridman\n- Facebook: https://www.facebook.com/lexfridman\n- Instagram: https://www.instagram.com/lexfridman",
            "channelTitle": "Lex Fridman",
            "publishedAt": "2019-01-11T16:47:40.000Z",
            "duration": 4086,
            "durationFmt": "1:08:06",
            "views": 2520770,
            "viewsFmt": "2.5M",
            "likes": 46250,
            "likesFmt": "46K",
            "thumbnails": {
                "default": {
                    "url": "https://i.ytimg.com/vi/O5xeyoRL95U/default.jpg",
                    "width": 120,
                    "height": 90
                },
                "medium": {
                    "url": "https://i.ytimg.com/vi/O5xeyoRL95U/mqdefault.jpg",
                    "width": 320,
                    "height": 180
                },
                "high": {
                    "url": "https://i.ytimg.com/vi/O5xeyoRL95U/hqdefault.jpg",
                    "width": 480,
                    "height": 360
                },
                "standard": {
                    "url": "https://i.ytimg.com/vi/O5xeyoRL95U/sddefault.jpg",
                    "width": 640,
                    "height": 480
                },
                "maxres": {
                    "url": "https://i.ytimg.com/vi/O5xeyoRL95U/maxresdefault.jpg",
                    "width": 1280,
                    "height": 720
                }
            }
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
    "description": "Some lectures on deep learning, deep reinforcement learning, autonomous vehicles, and artificial intelligence. https://deeplearning.mit.edu",
    "thumbnails": {
        "default": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/default.jpg",
            "width": 120,
            "height": 90
        },
        "medium": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/mqdefault.jpg",
            "width": 320,
            "height": 180
        },
        "high": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/hqdefault.jpg",
            "width": 480,
            "height": 360
        },
        "standard": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/sddefault.jpg",
            "width": 640,
            "height": 480
        },
        "maxres": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/maxresdefault.jpg",
            "width": 1280,
            "height": 720
        }
    }
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
    "videoIds": [
        "0VH1Lim8gL8",
        "O5xeyoRL95U"
    ],
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
    "description": "Some lectures on deep learning, deep reinforcement learning, autonomous vehicles, and artificial intelligence. https://deeplearning.mit.edu",
    "thumbnails": {
        "default": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/default.jpg",
            "width": 120,
            "height": 90
        },
        "medium": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/mqdefault.jpg",
            "width": 320,
            "height": 180
        },
        "high": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/hqdefault.jpg",
            "width": 480,
            "height": 360
        },
        "standard": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/sddefault.jpg",
            "width": 640,
            "height": 480
        },
        "maxres": {
            "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/maxresdefault.jpg",
            "width": 1280,
            "height": 720
        }
    },
    "videos": [
        {
            "id": "O5xeyoRL95U",
            "title": "Deep Learning Basics: Introduction and Overview",
            "description": "An introductory lecture for MIT course 6.S094 on the basics of deep learning including a few key ideas, subfields, and the big picture of why neural networks have inspired and energized an entire new generation of researchers. For more lecture videos on deep learning, reinforcement learning (RL), artificial intelligence (AI & AGI), and podcast conversations, visit our website or follow TensorFlow code tutorials on our GitHub repo.\n\nINFO:\nWebsite: https://deeplearning.mit.edu\nGitHub: https://github.com/lexfridman/mit-deep-learning\nSlides: http://bit.ly/deep-learning-basics-slides\nPlaylist: http://bit.ly/deep-learning-playlist\nBlog post: https://link.medium.com/TkE476jw2T\n\nOUTLINE:\n0:00 - Introduction\n0:53 - Deep learning in one slide\n4:55 - History of ideas and tools\n9:43 - Simple example in TensorFlow\n11:36 - TensorFlow in one slide\n13:32 - Deep learning is representation learning\n16:02 - Why deep learning (and why not)\n22:00 - Challenges for supervised learning\n38:27 - Key low-level concepts\n46:15 - Higher-level methods\n1:06:00 - Toward artificial general intelligence\n\nCONNECT:\n- If you enjoyed this video, please subscribe to this channel.\n- Twitter: https://twitter.com/lexfridman\n- LinkedIn: https://www.linkedin.com/in/lexfridman\n- Facebook: https://www.facebook.com/lexfridman\n- Instagram: https://www.instagram.com/lexfridman",
            "channelTitle": "Lex Fridman",
            "publishedAt": "2019-01-11T16:47:40.000Z",
            "duration": 4086,
            "durationFmt": "1:08:06",
            "views": 2520770,
            "viewsFmt": "2.5M",
            "likes": 46250,
            "likesFmt": "46K",
            "thumbnails": {
                "default": {
                    "url": "https://i.ytimg.com/vi/O5xeyoRL95U/default.jpg",
                    "width": 120,
                    "height": 90
                },
                "medium": {
                    "url": "https://i.ytimg.com/vi/O5xeyoRL95U/mqdefault.jpg",
                    "width": 320,
                    "height": 180
                },
                "high": {
                    "url": "https://i.ytimg.com/vi/O5xeyoRL95U/hqdefault.jpg",
                    "width": 480,
                    "height": 360
                },
                "standard": {
                    "url": "https://i.ytimg.com/vi/O5xeyoRL95U/sddefault.jpg",
                    "width": 640,
                    "height": 480
                },
                "maxres": {
                    "url": "https://i.ytimg.com/vi/O5xeyoRL95U/maxresdefault.jpg",
                    "width": 1280,
                    "height": 720
                }
            }
        },
        {
            "id": "0VH1Lim8gL8",
            "title": "Deep Learning State of the Art (2020)",
            "description": "Lecture on most recent research and developments in deep learning, and hopes for 2020. This is not intended to be a list of SOTA benchmark results, but rather a set of highlights of machine learning and AI innovations and progress in academia, industry, and society in general. This lecture is part of the MIT Deep Learning Lecture Series.\n\nWebsite: https://deeplearning.mit.edu\nSlides: http://bit.ly/2QEfbAm\nReferences: http://bit.ly/deeplearn-sota-2020\nPlaylist: http://bit.ly/deep-learning-playlist\n\nOUTLINE:\n0:00 - Introduction\n0:33 - AI in the context of human history\n5:47 - Deep learning celebrations, growth, and limitations\n6:35 - Deep learning early key figures\n9:29 - Limitations of deep learning\n11:01 - Hopes for 2020: deep learning community and research\n12:50 - Deep learning frameworks: TensorFlow and PyTorch\n15:11 - Deep RL frameworks\n16:13 - Hopes for 2020: deep learning and deep RL frameworks\n17:53 - Natural language processing\n19:42 - Megatron, XLNet, ALBERT\n21:21 - Write with transformer examples\n24:28 - GPT-2 release strategies report\n26:25 - Multi-domain dialogue\n27:13 - Commonsense reasoning\n28:26 - Alexa prize and open-domain conversation\n33:44 - Hopes for 2020: natural language processing\n35:11 - Deep RL and self-play\n35:30 - OpenAI Five and Dota 2\n37:04 - DeepMind Quake III Arena\n39:07 - DeepMind AlphaStar\n41:09 - Pluribus: six-player no-limit Texas hold'em poker\n43:13 - OpenAI Rubik's Cube\n44:49 - Hopes for 2020: Deep RL and self-play\n45:52 - Science of deep learning\n46:01 - Lottery ticket hypothesis\n47:29 - Disentangled representations\n48:34 - Deep double descent\n49:30 - Hopes for 2020: science of deep learning\n50:56 - Autonomous vehicles and AI-assisted driving\n51:50 - Waymo\n52:42 - Tesla Autopilot\n57:03 - Open question for Level 2 and Level 4 approaches\n59:55 - Hopes for 2020: autonomous vehicles and AI-assisted driving\n1:01:43 - Government, politics, policy\n1:03:03 - Recommendation systems and policy\n1:05:36 - Hopes for 2020: Politics, policy and recommendation systems\n1:06:50 - Courses, Tutorials, Books\n1:10:05 - General hopes for 2020\n1:11:19 - Recipe for progress in AI\n1:14:15 - Q&A: what made you interested in AI\n1:15:21 - Q&A: Will machines ever be able to think and feel?\n1:18:20 - Q&A: Is RL a good candidate for achieving AGI?\n1:21:31 - Q&A: Are autonomous vehicles responsive to sound?\n1:22:43 - Q&A: What does the future with AGI look like? \n1:25:50 - Q&A: Will AGI systems become our masters?\n\nCONNECT:\n- If you enjoyed this video, please subscribe to this channel.\n- Twitter: https://twitter.com/lexfridman\n- LinkedIn: https://www.linkedin.com/in/lexfridman\n- Facebook: https://www.facebook.com/lexfridman\n- Instagram: https://www.instagram.com/lexfridman",
            "channelTitle": "Lex Fridman",
            "publishedAt": "2020-01-10T16:04:31.000Z",
            "duration": 5261,
            "durationFmt": "1:27:41",
            "views": 1362759,
            "viewsFmt": "1.4M",
            "likes": 27457,
            "likesFmt": "27K",
            "thumbnails": {
                "default": {
                    "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/default.jpg",
                    "width": 120,
                    "height": 90
                },
                "medium": {
                    "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/mqdefault.jpg",
                    "width": 320,
                    "height": 180
                },
                "high": {
                    "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/hqdefault.jpg",
                    "width": 480,
                    "height": 360
                },
                "standard": {
                    "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/sddefault.jpg",
                    "width": 640,
                    "height": 480
                },
                "maxres": {
                    "url": "https://i.ytimg.com/vi/0VH1Lim8gL8/maxresdefault.jpg",
                    "width": 1280,
                    "height": 720
                }
            }
        }
    ],
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
