const { youtubeDownloader, youtubePlaylistDownloader } = require("./lib/youtube");
const instagramDownloader = require("./lib/instagram");
const tiktokDownloader = require("./lib/tiktok");
const pinterestDownloader = require("./lib/pinterest");
const pixivDownloader = require("./lib/pixiv");
const twitterDownloader = require("./lib/twitter");
const laheluDownloader = require("./lib/lahelu");
const download = require("./download");

const PLATFORM_PATTERNS = [
    { name: "youtube", test: (url) => /(?:youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts|youtube\.com\/playlist)/i.test(url) },
    { name: "instagram", test: (url) => /instagram\.com\//i.test(url) },
    { name: "tiktok", test: (url) => /tiktok\.com\//i.test(url) },
    { name: "pinterest", test: (url) => /(?:pinterest\.|pin\.it\/)/i.test(url) },
    { name: "pixiv", test: (url) => /pixiv\.net\//i.test(url) },
    { name: "twitter", test: (url) => /(?:twitter\.com\/|x\.com\/)/i.test(url) },
    { name: "lahelu", test: (url) => /lahelu\.com\/post\//i.test(url) },
];

function detectPlatform(url) {
    for (const p of PLATFORM_PATTERNS) {
        if (p.test(url)) return p.name;
    }
    return null;
}

const scrapers = {
    youtube: (url, options) => youtubeDownloader(url, options?.quality),
    instagram: (url) => instagramDownloader(url),
    tiktok: (url) => tiktokDownloader(url),
    pinterest: (url, options) => pinterestDownloader(url, options),
    pixiv: (url, options) => pixivDownloader(url, options),
    twitter: (url) => twitterDownloader(url),
    lahelu: (url) => laheluDownloader(url),
};

async function aioDownloader(url, options = {}) {
    const platform = options.platform || detectPlatform(url);

    if (!platform) {
        throw new Error(
            `Unsupported or unrecognized URL: ${url}. Supported platforms: YouTube, Instagram, TikTok, Pinterest, Pixiv, X/Twitter.`
        );
    }

    const scraper = scrapers[platform];
    if (!scraper) {
        throw new Error(`No scraper found for platform: ${platform}`);
    }

    return scraper(url, options);
}

const lmna = {
    youtube: (url, quality) => youtubeDownloader(url, quality),
    youtubePlaylist: (url, quality, folder) => youtubePlaylistDownloader(url, quality, folder),
    instagram: (url) => instagramDownloader(url),
    tiktok: (url) => tiktokDownloader(url),
    pinterest: (url, options) => pinterestDownloader(url, options),
    pixiv: (url, options) => pixivDownloader(url, options),
    twitter: (url) => twitterDownloader(url),
    lahelu: (url) => laheluDownloader(url),
};

module.exports = {
    lmna,
    aioDownloader,
    detectPlatform,
    download,
};
