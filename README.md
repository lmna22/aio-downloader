# @lmna22/aio-downloader

> All-in-one media downloader for YouTube, Instagram, TikTok, Pinterest, Pixiv, X (Twitter), Lahelu, Xiaohongshu (RedNote), and more.

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
| **TikTok** | ✅ (Buffer) | ✅ | ✅ (Photo/Slides) | — |
| **Pinterest** | — | — | ✅ | ✅ |
| **Pixiv** | — | — | ✅ (Original Resolution) | ✅ |
| **X / Twitter** | ✅ (Best quality) | — | ✅ | — |
| **Lahelu** | ✅ | — | ✅ | — |
| **Xiaohongshu/RedNote** | ✅ | — | ✅ | — |
| **Dailymotion** | ✅ | ✅ | ✅ | ✅ |
| **Spotify** | — | ✅ (MP3, Opus, WAV) | — | — |

- 🔗 **Auto-detect platform** from URL — just pass any supported link
- 📦 **Programmatic API** — designed for Node.js applications, bots, and scripts
- 📥 **Built-in download helper** with progress callback
- 🔍 **Search support** for Pinterest and Pixiv (pass keywords instead of URLs)
- 🚫 **No API keys** — all data is scraped from public sources
- 🔄 **Multi-method fallback** — Instagram uses 4 methods, TikTok uses 2 methods for maximum reliability
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
const { lmna, aioDownloader } = require("@lmna22/aio-downloader");

// Recommended: use the lmna namespace
const result = await lmna.youtube("https://www.youtube.com/watch?v=dQw4w9WgXcQ", 5);
console.log(result);

// Unified: auto-detect platform from URL
const result2 = await aioDownloader("https://www.instagram.com/p/ABC123/");
console.log(result2);
```

---

## 📖 Usage Examples

### YouTube

```javascript
const { lmna } = require("@lmna22/aio-downloader");

// Quality: 1=144p, 2=360p, 5=1080p, 8=MP3, 9=bitrate list
const result = await lmna.youtube("https://www.youtube.com/watch?v=dQw4w9WgXcQ", 5);

if (result.status) {
    console.log(result.data.title);
    const fs = require("fs");
    fs.writeFileSync(`${result.data.title}.${result.data.type}`, result.data.result);
}
```

### Instagram

```javascript
const { lmna } = require("@lmna22/aio-downloader");
const result = await lmna.instagram("https://www.instagram.com/p/ABC123/");
```

### TikTok

```javascript
const { lmna } = require("@lmna22/aio-downloader");
const result = await lmna.tiktok("https://www.tiktok.com/@user/video/1234567890");
```

### Xiaohongshu / RedNote

```javascript
const { lmna } = require("@lmna22/aio-downloader");

const result = await lmna.xiaohongshu("https://www.xiaohongshu.com/explore/abc123");

if (result.status) {
    console.log(result.data.title);
    console.log(result.data.author.nickname);
    console.log(result.data.stats.likes);
    console.log(result.data.stats.collects);
    console.log(result.data.stats.comments);
    console.log(result.data.media.url);

    // Download the media
    const { download } = require("@lmna22/aio-downloader");
    await download(result.data.media.url, `./downloads/${result.data.fileName}`);
}
```

### Dailymotion

```javascript
const { lmna } = require("@lmna22/aio-downloader");

// Download video
const result = await lmna.dailymotion("https://www.dailymotion.com/video/x8z3v2y");

if (result.status) {
    console.log(result.data.title);
    console.log(result.data.author);
    console.log(result.data.views);
    console.log(result.data.url);
}

// Search videos
const searchResult = await lmna.dailymotion("https://www.dailymotion.com/search/programming", { query: "programming", limit: 10 });

if (searchResult.status) {
    console.log(searchResult.data.videos);
}
```

### Spotify

```javascript
const { lmna } = require("@lmna22/aio-downloader");

// Get track metadata (returns search query, does not download)
const result = await lmna.spotify("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT");

if (result.status) {
    console.log(result.data.title);
    console.log(result.data.artist);
    console.log(result.data.cover);
    console.log(result.data.searchQuery); // Use this to download with yt-dlp
    
    // Download using yt-dlp or similar tool
    // Example: yt-dlp "ytsearch1:Never Gonna Give You Up audio" --extract-audio --audio-format mp3
}

// Supported formats: mp3, opus, wav
const mp3Result = await lmna.spotify("https://open.spotify.com/track/abc123", { format: 'mp3' });
const opusResult = await lmna.spotify("https://open.spotify.com/track/abc123", { format: 'opus' });
const wavResult = await lmna.spotify("https://open.spotify.com/track/abc123", { format: 'wav' });
```

**Note:** Spotify scraper returns metadata and a search query. Use yt-dlp or similar tool to download the actual audio file using the provided searchQuery.

*(See the API Reference below for other platforms: Pinterest, Pixiv, Twitter, Lahelu, Dailymotion)*

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
await aioDownloader("https://lahelu.com/post/abc123");
await aioDownloader("https://www.xiaohongshu.com/explore/abc123");
await aioDownloader("https://www.rednote.com/explore/abc123");
await aioDownloader("https://xhslink.com/abc123");
await aioDownloader("https://www.dailymotion.com/video/x8z3v2y");
await aioDownloader("https://www.dailymotion.com/search/programming");
await aioDownloader("https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT");

// Force a specific platform
await aioDownloader("https://example.com/video", { platform: "youtube", quality: 5 });

// Detect platform only
detectPlatform("https://youtube.com/watch?v=abc");  // "youtube"
detectPlatform("https://instagram.com/p/xyz");       // "instagram"
detectPlatform("https://tiktok.com/@user/video/1");  // "tiktok"
detectPlatform("https://pinterest.com/pin/123");     // "pinterest"
detectPlatform("https://pin.it/abc123");             // "pinterest"
detectPlatform("https://pixiv.net/artworks/456");    // "pixiv"
detectPlatform("https://x.com/user/status/789");     // "twitter"
detectPlatform("https://lahelu.com/post/abc");       // "lahelu"
detectPlatform("https://xiaohongshu.com/explore/abc"); // "xiaohongshu"
detectPlatform("https://rednote.com/explore/abc");   // "xiaohongshu"
detectPlatform("https://xhslink.com/abc");           // "xiaohongshu"
detectPlatform("https://dailymotion.com/video/x8z3v2y"); // "dailymotion"
detectPlatform("https://dailymotion.com/search/music"); // "dailymotion"
detectPlatform("https://open.spotify.com/track/abc123"); // "spotify"
detectPlatform("https://unknown.com");               // null
```

---

## 📚 API Reference

### `lmna` Namespace (Mandatory for individual scrapers)

Instead of individual function exports, all scrapers are now grouped under the `lmna` object:

```javascript
const { lmna } = require("@lmna22/aio-downloader");

await lmna.youtube(url, quality);
await lmna.youtubePlaylist(url, quality, folderPath);
await lmna.instagram(url);
await lmna.tiktok(url);
await lmna.pinterest(url, options);
await lmna.pixiv(url, options);
await lmna.twitter(url);
await lmna.lahelu(url);
await lmna.xiaohongshu(url);
await lmna.dailymotion(url, options);
await lmna.spotify(url, options);

// All return: { status, platform, data?, message? }
```

---

### `aioDownloader(url, options?)`

Auto-detect platform and scrape media data.

| Parameter | Type | Description |
|---|---|---|
| `url` | `string` | The URL to scrape |
| `options.platform` | `string` | Force a specific platform |
| `options.quality` | `number` | YouTube quality (1-9) |

---

### Utility Exports

```javascript
const { detectPlatform, download } = require("@lmna22/aio-downloader");
```

| Function | Description |
|---|---|
| `detectPlatform(url)` | Returns the platform name from URL |
| `download(url, path, options)` | Helper to download files to disk |

---

## ⚠️ Error Handling

All functions return `{ status: false, platform: "...", message: "..." }` on failure.

---

## 📋 Requirements

- **Node.js** >= 14.0.0
- **puppeteer** (optional) — fallback for Pinterest/Pixiv

---

## 📄 License

MIT
