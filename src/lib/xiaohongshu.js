const axios = require("axios");
const path = require("path");
const { sanitizeFileName, getExtFromUrl } = require("../utils");

let puppeteer;
try {
    puppeteer = require("puppeteer");
} catch (err) { }

function isXiaohongshuUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname.includes("xiaohongshu.com") || 
               u.hostname.includes("rednote.com") || 
               u.hostname.includes("xhslink.com");
    } catch {
        return false;
    }
}

function parseNoteId(url) {
    const patterns = [
        /xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-f0-9]+)/i,
        /rednote\.com\/(?:explore|discovery\/item)\/([a-f0-9]+)/i,
        /xhslink\.com\/([a-zA-Z0-9]+)/i,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

function buildPostUrl(noteIdOrUrl) {
    if (noteIdOrUrl.startsWith("http")) return noteIdOrUrl;
    return `https://www.xiaohongshu.com/explore/${noteIdOrUrl}`;
}

async function resolveShortLink(url) {
    if (!url.includes("xhslink.com")) return url;

    try {
        const res = await axios.head(url, {
            maxRedirects: 5,
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
            },
        });
        return res.request.res.responseUrl || url;
    } catch (e) {
        if (e.response && e.response.headers && e.response.headers.location) {
            return e.response.headers.location;
        }
    }
    return url;
}

async function fetchXiaohongshuData(url) {
    if (!puppeteer) {
        throw new Error("Puppeteer is required for Xiaohongshu downloads. Install it with: npm install puppeteer");
    }

    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: "new",
            args: [
                "--disable-blink-features=AutomationControlled",
                "--disable-web-security",
                "--disable-features=IsolateOrigins,site-per-process",
                "--window-size=1920,1080",
                "--no-sandbox",
                "--disable-setuid-sandbox",
            ],
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        await page.setUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36"
        );

        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, "webdriver", { get: () => undefined });
            Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
            window.chrome = { runtime: {} };
        });

        page.setDefaultTimeout(30000);

        let finalUrl = await resolveShortLink(url);

        await page.goto(finalUrl, {
            waitUntil: "networkidle2",
            timeout: 30000,
        });

        await page.waitForFunction(
            () => window.__INITIAL_STATE__ !== undefined,
            { timeout: 15000 }
        );

        await new Promise((r) => setTimeout(r, 1500));

        const postData = await page.evaluate(() => {
            const state = window.__INITIAL_STATE__;
            if (!state) return null;

            const noteMap = state?.note?.noteDetailMap || {};
            const firstKey = Object.keys(noteMap)[0];
            const noteWrapper = noteMap[firstKey];
            const note = noteWrapper?.note || noteWrapper;

            if (!note) return null;

            return {
                id: note.noteId || note.id || firstKey || "",
                title: note.title || "",
                desc: note.desc || "",
                type: note.type || "normal",
                author: {
                    nickname: note.user?.nickname || "",
                    userId: note.user?.userId || "",
                    avatar: note.user?.image || note.user?.avatar || "",
                },
                images: (note.imageList || []).map((img) => ({
                    url: img.urlDefault || img.url || "",
                    livePhoto: img.livePhoto || img.stream?.h264?.[0]?.masterUrl || "",
                    width: img.width || 0,
                    height: img.height || 0,
                })),
                video: note.video ? {
                    url: note.video.media?.stream?.h264?.[0]?.masterUrl ||
                         note.video.media?.stream?.h265?.[0]?.masterUrl ||
                         note.video.url || "",
                    backupUrl: note.video.media?.stream?.h264?.[0]?.backupUrls?.[0] ||
                               note.video.media?.stream?.h265?.[0]?.backupUrls?.[0] || "",
                    duration: note.video.duration || 0,
                    width: note.video.width || note.video.media?.stream?.h264?.[0]?.width || 0,
                    height: note.video.height || note.video.media?.stream?.h264?.[0]?.height || 0,
                    cover: note.video.image?.firstFrameFileid || note.video.thumbnail || "",
                } : null,
                cover: note.cover?.urlDefault || note.cover?.url || "",
                stats: {
                    likes: note.interactInfo?.likedCount || "0",
                    collects: note.interactInfo?.collectedCount || "0",
                    comments: note.interactInfo?.commentCount || "0",
                    shares: note.interactInfo?.shareCount || "0",
                },
                tags: (note.tagList || []).map((tag) => tag.name || "").filter(Boolean),
                publishedAt: note.time || "",
                ipLocation: note.ipLocation || "",
            };
        });

        await browser.close();
        browser = null;

        if (!postData) {
            return null;
        }

        const medias = [];

        if (postData.video && postData.video.url) {
            medias.push({
                type: "video",
                format: "mp4",
                desc: `Video ${postData.video.width}x${postData.video.height}` +
                      (postData.video.duration ? ` (${Math.round(postData.video.duration)}s)` : ""),
                url: postData.video.url,
                backupUrl: postData.video.backupUrl || "",
            });
        }

        if (postData.images && postData.images.length > 0) {
            postData.images.forEach((img, i) => {
                if (img.url) {
                    medias.push({
                        type: "image",
                        format: "jpg",
                        desc: `Image ${i + 1}` + (img.width && img.height ? ` (${img.width}x${img.height})` : ""),
                        url: img.url.startsWith("http") ? img.url : `https://sns-img-bd.xhscdn.com/${img.url}`,
                    });
                }
                if (img.livePhoto) {
                    medias.push({
                        type: "video",
                        format: "mp4",
                        desc: `Live Photo ${i + 1}`,
                        url: img.livePhoto,
                    });
                }
            });
        }

        return {
            ...postData,
            medias,
        };
    } catch (err) {
        if (browser) {
            try { await browser.close(); } catch (_) { }
        }
        throw err;
    }
}

async function xiaohongshuDownloader(url) {
    try {
        if (!isXiaohongshuUrl(url)) {
            return {
                status: false,
                platform: "xiaohongshu",
                message: "Invalid Xiaohongshu URL. Make sure it's a valid post URL.",
            };
        }

        const noteId = parseNoteId(url);
        if (!noteId && !url.includes("xhslink.com")) {
            return {
                status: false,
                platform: "xiaohongshu",
                message: "Could not extract note ID from URL.",
            };
        }

        const postUrl = buildPostUrl(url);
        const data = await fetchXiaohongshuData(postUrl);

        if (!data || !data.medias || data.medias.length === 0) {
            return {
                status: false,
                platform: "xiaohongshu",
                message: "No media found in this post. The post may be private or deleted.",
            };
        }

        const selected = data.medias[0];
        const ext = selected.format.startsWith(".") ? selected.format : "." + selected.format;
        const safeTitle = sanitizeFileName(data.id || noteId || "xhs");
        const fileName = `xhs_${safeTitle}_${selected.type}${ext}`;

        return {
            status: true,
            platform: "xiaohongshu",
            data: {
                id: data.id || noteId,
                title: data.title || "Untitled",
                description: data.desc || "",
                author: {
                    nickname: data.author?.nickname || "Unknown",
                    userId: data.author?.userId || "",
                    avatar: data.author?.avatar || "",
                },
                type: data.type,
                stats: {
                    likes: data.stats?.likes || "0",
                    collects: data.stats?.collects || "0",
                    comments: data.stats?.comments || "0",
                    shares: data.stats?.shares || "0",
                },
                tags: data.tags || [],
                publishedAt: data.publishedAt,
                ipLocation: data.ipLocation,
                media: {
                    type: selected.type,
                    format: selected.format,
                    url: selected.url,
                    backupUrl: selected.backupUrl || "",
                    desc: selected.desc,
                },
                allMedias: data.medias,
                fileName: fileName,
            },
        };
    } catch (error) {
        return {
            status: false,
            platform: "xiaohongshu",
            message: error.message || "An unexpected error occurred",
        };
    }
}

module.exports = xiaohongshuDownloader;
