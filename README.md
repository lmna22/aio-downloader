# @lmna22/aio-downloader

> All-in-one media downloader for YouTube, Instagram, TikTok, Pinterest, Pixiv, and X/Twitter.

[![npm version](https://img.shields.io/npm/v/@lmna22/aio-downloader.svg)](https://www.npmjs.com/package/@lmna22/aio-downloader)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

Scrape and download videos, audio, and images from multiple platforms with a single, unified API. No API keys required.

---

## ✨ Features

| Platform | Video | Audio | Image | Search |
|---|---|---|---|---|
| **YouTube** | ✅ (Multiple qualities) | ✅ (MP3) | — | — |
| **Instagram** | ✅ | — | ✅ | — |
| **TikTok** | ✅ (Buffer) | ✅ | — | — |
| **Pinterest** | — | — | ✅ | ✅ |
| **Pixiv** | — | — | ✅ (Original Resolution) | ✅ |
| **X / Twitter** | ✅ (Best quality) | — | ✅ | — |

- 🔗 **Auto-detect platform** from URL — just pass any supported link
- 📦 **Programmatic API** — designed for Node.js applications, bots, and scripts
- 📥 **Built-in download helper** with progress callback
- 🔍 **Search support** for Pinterest and Pixiv (pass keywords instead of URLs)
- 🚫 **No API keys** — all data is scraped from public sources
- 🔄 **Multi-method fallback** — Instagram uses 4 different methods for maximum reliability
- 🎬 **YouTube quality selection** — choose from 144p to 2160p, or audio-only MP3

---

## 📦 Installation

```bash
npm install @lmna22/aio-downloader
```

All required dependencies are bundled and will be installed automatically.

**Optional:** For Pinterest/Pixiv fallback when axios scraping is blocked:

```bash
npm install puppeteer
```

---

## 🚀 Quick Start

```javascript
const { aioDownloader } = require("@lmna22/aio-downloader");

// Auto-detects the platform from the URL
const result = await aioDownloader("https://www.youtube.com/watch?v=dQw4w9WgXcQ", { quality: 5 });
console.log(result);
```

---

## 📖 Usage Examples

### YouTube

```javascript
const { youtubeDownloader, youtubePlaylistDownloader } = require("@lmna22/aio-downloader");

// Quality options:
// 1 = 144p, 2 = 360p, 3 = 480p, 4 = 720p,
// 5 = 1080p, 6 = 1440p, 7 = 2160p,
// 8 = Audio only (MP3), 9 = Get bitrate list

// Download a video in 1080p
const result = await youtubeDownloader("https://www.youtube.com/watch?v=dQw4w9WgXcQ", 5);

if (result.status) {
    console.log(result.data.title);      // "Rick Astley - Never Gonna Give You Up"
    console.log(result.data.channel);    // "Rick Astley"
    console.log(result.data.views);      // 1500000000
    console.log(result.data.size);       // Buffer size in bytes
    console.log(result.data.type);       // "mp4" or "mp3"

    // Save to file
    const fs = require("fs");
    fs.writeFileSync(`${result.data.title}.${result.data.type}`, result.data.result);
}

// Download audio only
const audio = await youtubeDownloader("https://www.youtube.com/watch?v=dQw4w9WgXcQ", 8);

// Get available audio bitrates
const bitrates = await youtubeDownloader("https://www.youtube.com/watch?v=dQw4w9WgXcQ", 9);
console.log(bitrates.data.bitrateList);

// Download entire playlist
const playlist = await youtubePlaylistDownloader(
    "https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf",
    5, // quality
    "./my-playlist" // output folder
);
```

### Instagram

```javascript
const { instagramDownloader } = require("@lmna22/aio-downloader");

const result = await instagramDownloader("https://www.instagram.com/p/ABC123/");

if (result.status) {
    console.log(result.data.url);        // Array of download URLs
    console.log(result.data.caption);    // Post caption
    console.log(result.data.username);   // "@username"
    console.log(result.data.like);       // Like count
    console.log(result.data.comment);    // Comment count
    console.log(result.data.isVideo);    // true/false

    // Download all media
    const { download } = require("@lmna22/aio-downloader");
    for (let i = 0; i < result.data.url.length; i++) {
        await download(result.data.url[i], `./downloads/ig_${i + 1}.mp4`);
    }
}
```

### TikTok

```javascript
const { tiktokDownloader } = require("@lmna22/aio-downloader");

const result = await tiktokDownloader("https://www.tiktok.com/@user/video/1234567890");

if (result.status) {
    const data = result.data;

    console.log(data.description);       // Video description
    console.log(data.author.nickname);   // Author name
    console.log(data.author.uniqueId);   // @username
    console.log(data.stats.likes);       // Like count
    console.log(data.stats.comments);    // Comment count
    console.log(data.stats.plays);       // Play count
    console.log(data.music.title);       // Music title
    console.log(data.videoInfo.duration); // Duration in seconds
    console.log(data.videoInfo.width);    // Video width
    console.log(data.videoInfo.height);   // Video height

    // Video is returned as a Buffer — save directly
    if (data.videoBuffer) {
        const fs = require("fs");
        fs.writeFileSync("tiktok_video.mp4", data.videoBuffer);
    }
}
```

### Pinterest

```javascript
const { pinterestDownloader } = require("@lmna22/aio-downloader");

// From a direct pin URL
const data = await pinterestDownloader("https://www.pinterest.com/pin/123456789/");

// Or search by keyword
const searchResults = await pinterestDownloader("aesthetic wallpaper", { limit: 20 });

console.log(data.results);
// [
//   {
//     id: "123456789",
//     title: "Beautiful Wallpaper",
//     link: "https://www.pinterest.com/pin/123456789/",
//     image: "https://i.pinimg.com/originals/...",
//     source: "example.com"
//   }
// ]
```

### Pixiv

```javascript
const { pixivDownloader } = require("@lmna22/aio-downloader");

// From an artwork URL
const data = await pixivDownloader("https://www.pixiv.net/artworks/12345678");

// Or search by tag/keyword
const searchResults = await pixivDownloader("landscape", { limit: 5 });

console.log(data.results);
// [
//   {
//     id: "12345678",
//     title: "Beautiful Landscape",
//     link: "https://www.pixiv.net/artworks/12345678",
//     image: "https://i.pximg.net/img-original/...",
//     artist: "ArtistName",
//     artistUrl: "https://www.pixiv.net/users/999",
//     userId: "999",
//     images: ["https://i.pximg.net/img-original/..."]
//   }
// ]

// Skip enrichment for faster results (no original resolution images)
const fast = await pixivDownloader("landscape", { limit: 10, enrich: false });
```

### X / Twitter

```javascript
const { twitterDownloader } = require("@lmna22/aio-downloader");

const result = await twitterDownloader("https://x.com/user/status/1234567890");

if (result.status) {
    console.log(result.data.author);          // "username"
    console.log(result.data.description);     // Tweet text
    console.log(result.data.like);            // Like count
    console.log(result.data.view);            // View count
    console.log(result.data.retweet);         // Retweet count
    console.log(result.data.sensitiveContent); // true/false

    // result.data.result contains media items:
    // [
    //   { type: "video", thumb: "https://...", url: "https://..." },
    //   { type: "image", url: "https://...?format=png&name=large" },
    //   { type: "gif", thumb: "https://...", url: "https://..." }
    // ]

    // Download all media
    const { download } = require("@lmna22/aio-downloader");
    for (let i = 0; i < result.data.result.length; i++) {
        const media = result.data.result[i];
        const ext = media.type === "image" ? ".png" : ".mp4";
        await download(media.url, `./downloads/tweet_${i + 1}${ext}`);
    }
}
```

---

## 📥 Download Helper

Use the built-in `download` helper to save files to disk:

```javascript
const { download } = require("@lmna22/aio-downloader");

// Download with progress tracking
const result = await download("https://example.com/video.mp4", "./downloads/video.mp4", {
    onProgress: ({ downloaded, total, percentage }) => {
        console.log(`${percentage}% - ${downloaded}/${total} bytes`);
    },
});

console.log(result);
// { path: "./downloads/video.mp4", size: 26345678, filename: "video.mp4" }
```

---

## 🌐 Auto-detect Platform

```javascript
const { aioDownloader, detectPlatform } = require("@lmna22/aio-downloader");

// Auto-detect and scrape
await aioDownloader("https://www.youtube.com/watch?v=abc123", { quality: 5 });
await aioDownloader("https://www.instagram.com/p/xyz/");
await aioDownloader("https://www.tiktok.com/@user/video/123");
await aioDownloader("https://www.pinterest.com/pin/456/");
await aioDownloader("https://www.pixiv.net/artworks/789");
await aioDownloader("https://x.com/user/status/101112");

// Force a specific platform
await aioDownloader("https://example.com/video", { platform: "youtube", quality: 5 });

// Detect platform only
detectPlatform("https://youtube.com/watch?v=abc");  // "youtube"
detectPlatform("https://instagram.com/p/xyz");       // "instagram"
detectPlatform("https://tiktok.com/@user/video/1");  // "tiktok"
detectPlatform("https://pinterest.com/pin/123");     // "pinterest"
detectPlatform("https://pixiv.net/artworks/456");    // "pixiv"
detectPlatform("https://x.com/user/status/789");     // "twitter"
detectPlatform("https://unknown.com");               // null
```

---

## 📚 API Reference

### `aioDownloader(url, options?)`

Auto-detect platform and scrape media data.

| Parameter | Type | Description |
|---|---|---|
| `url` | `string` | The URL to scrape |
| `options.platform` | `string` | Force a specific platform |
| `options.quality` | `number` | YouTube quality (1-9) |

---

### `youtubeDownloader(url, quality)`

| Parameter | Type | Description |
|---|---|---|
| `url` | `string` | YouTube video URL |
| `quality` | `number` | 1=144p, 2=360p, 3=480p, 4=720p, 5=1080p, 6=1440p, 7=2160p, 8=MP3, 9=bitrate list |

**Returns:** `{ creator, status, data: { title, result (Buffer), size, quality, desc, views, likes, channel, uploadDate, thumb, type } }`

---

### `youtubePlaylistDownloader(url, quality, folderPath?)`

Downloads all videos from a YouTube playlist.

**Returns:** `{ creator, status, data: { title, resultPath[], metadata[] } }`

---

### `instagramDownloader(url)`

Uses 4 fallback methods for maximum reliability.

**Returns:** `{ creator, status, data: { url[], caption, username, like, comment, isVideo } }`

---

### `tiktokDownloader(url)`

Returns video as a Buffer (no watermark).

**Returns:** `{ creator, status, data: { videoId, description, videoUrl, videoBuffer (Buffer), videoInfo, author, music, stats, locationCreated } }`

---

### `pinterestDownloader(input, options?)`

| Parameter | Type | Description |
|---|---|---|
| `input` | `string` | Pin URL or search keyword |
| `options.limit` | `number` | Max results for search (default: 10) |

**Returns:** `{ status, platform, method, total, results: [{ id, title, link, image, source }] }`

---

### `pixivDownloader(input, options?)`

| Parameter | Type | Description |
|---|---|---|
| `input` | `string` | Artwork URL or search keyword |
| `options.limit` | `number` | Max results (default: 10) |
| `options.enrich` | `boolean` | Fetch original resolution images (default: true) |

**Returns:** `{ status, platform, method, total, results: [{ id, title, link, image, artist, artistUrl, userId, images[] }] }`

---

### `twitterDownloader(url)`

Extracts best quality video/image/gif from tweets via Twitter GraphQL API.

**Returns:** `{ creator, status, data: { author, like, view, retweet, description, sensitiveContent, result: [{ type, url, thumb? }] } }`

---

### `download(url, outputPath, options?)`

Helper to download any file to disk.

| Parameter | Type | Description |
|---|---|---|
| `url` | `string` | Direct download URL |
| `outputPath` | `string` | Local file path |
| `options.headers` | `object` | Custom request headers |
| `options.timeout` | `number` | Timeout in ms (default: 120000) |
| `options.onProgress` | `function` | `({ downloaded, total, percentage })` |

**Returns:** `{ path, size, filename }`

---

### `detectPlatform(url)`

**Returns:** `"youtube"` | `"instagram"` | `"tiktok"` | `"pinterest"` | `"pixiv"` | `"twitter"` | `null`

---

## ⚠️ Error Handling

All functions return `{ status: false, message: "..." }` on failure:

```javascript
const { youtubeDownloader } = require("@lmna22/aio-downloader");

const result = await youtubeDownloader("https://www.youtube.com/watch?v=invalid", 5);
if (!result.status) {
    console.error("Failed:", result.message);
}
```

---

## 📋 Requirements

- **Node.js** >= 14.0.0
- **puppeteer** (optional) — fallback for Pinterest/Pixiv when axios scraping is blocked

---

## 📄 License

MIT
