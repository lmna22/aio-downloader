const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");
const { DEFAULT_UA, cleanText, safeJsonParse, uniqBy, isValidUrl, delay } = require("../utils");

function isPixivUrl(text) {
    try {
        const u = new URL(text);
        return u.hostname.includes("pixiv.net") || u.hostname.includes("pximg.net");
    } catch {
        return false;
    }
}

function buildSearchUrl(query) {
    return `https://www.pixiv.net/en/tags/${encodeURIComponent(query)}/artworks`;
}

function parseArtworkIdFromUrl(url) {
    if (!url) return null;
    const m = String(url).match(/(?:artworks\/|illust_id=)(\d+)/);
    return m ? m[1] : null;
}

function normalizeArtworkUrl(url, id = null) {
    if (!url && id) return `https://www.pixiv.net/artworks/${id}`;
    if (!url) return null;

    try {
        const u = new URL(url, "https://www.pixiv.net");
        const illustId = u.searchParams.get("illust_id");
        if (illustId) return `https://www.pixiv.net/artworks/${illustId}`;

        const m = u.pathname.match(/\/artworks\/(\d+)/);
        if (m) return `https://www.pixiv.net/artworks/${m[1]}`;
        if (id) return `https://www.pixiv.net/artworks/${id}`;
        return u.toString();
    } catch {
        const m = String(url).match(/(?:artworks\/|illust_id=)(\d+)/);
        if (m) return `https://www.pixiv.net/artworks/${m[1]}`;
        if (id) return `https://www.pixiv.net/artworks/${id}`;
        return url;
    }
}

function normalizeUserUrl(url, userId = null) {
    if (!url && userId) return `https://www.pixiv.net/users/${userId}`;
    if (!url) return null;

    try {
        const u = new URL(url, "https://www.pixiv.net");
        const m = u.pathname.match(/\/users\/(\d+)/);
        if (m) return `https://www.pixiv.net/users/${m[1]}`;
        if (userId) return `https://www.pixiv.net/users/${userId}`;
        return u.toString();
    } catch {
        const m = String(url).match(/\/users\/(\d+)/);
        if (m) return `https://www.pixiv.net/users/${m[1]}`;
        if (userId) return `https://www.pixiv.net/users/${userId}`;
        return url;
    }
}

function getExtFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        const ext = path.extname(pathname);
        return ext || ".jpg";
    } catch {
        return ".jpg";
    }
}

function makeHeaders() {
    return {
        "User-Agent": DEFAULT_UA,
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.pixiv.net/",
    };
}

function normalizePixivItem(item) {
    if (!item || typeof item !== "object") return null;

    const id = item.id || item.illustId || item.illust_id ||
        parseArtworkIdFromUrl(item.url) || parseArtworkIdFromUrl(item.link) || null;
    if (!id) return null;

    const title = cleanText(item.title || item.illust_title || item.alt || item.caption || null);

    const userId = item.userId || item.user_id || (() => {
        const m = String(item.userUrl || item.www_user_url || "").match(/\/users\/(\d+)/);
        return m ? m[1] : null;
    })();

    const link = normalizeArtworkUrl(
        item.link || item.url || item.artworkUrl || item.www_member_illust_medium_url || null, id
    );

    const image = item.image || item.src || item.urls?.original || item.url || null;
    const artist = cleanText(item.userName || item.user_name || item.artist || null);
    const artistUrl = normalizeUserUrl(item.userUrl || item.www_user_url || null, userId);

    return {
        id: String(id),
        title: title || null,
        link: link || `https://www.pixiv.net/artworks/${id}`,
        displayUrl: link || `https://www.pixiv.net/artworks/${id}`,
        image: isValidUrl(image) ? image : null,
        artist: artist || null,
        artistUrl: artistUrl || null,
        userId: userId ? String(userId) : null,
        images: [],
    };
}

function deepCollectPixivItems(obj, bucket = []) {
    if (!obj || typeof obj !== "object") return bucket;

    if (Array.isArray(obj)) {
        for (const item of obj) deepCollectPixivItems(item, bucket);
        return bucket;
    }

    const parsed = normalizePixivItem(obj);
    if (parsed) bucket.push(parsed);

    for (const value of Object.values(obj)) deepCollectPixivItems(value, bucket);
    return bucket;
}

function parseInitConfigJson(html) {
    const $ = cheerio.load(html);
    const raw = $("#init-config").attr("content") || $("#init-config").text() || $("#init-config.json-data").attr("value");
    if (!raw) return [];
    const json = safeJsonParse(raw);
    if (!json) return [];
    return uniqBy(deepCollectPixivItems(json), (x) => x.id);
}

function parseNextData(html) {
    const results = [];
    const matches = [...html.matchAll(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/g)];
    for (const m of matches) {
        const json = safeJsonParse(m[1]);
        if (!json) continue;
        results.push(...deepCollectPixivItems(json));
    }
    return uniqBy(results, (x) => x.id);
}

function parsePreloadData(html) {
    const results = [];
    const matches = [...html.matchAll(/<meta[^>]+id=["']meta-preload-data["'][^>]+content=["']([^"]+)["']/g)];
    for (const m of matches) {
        const raw = m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
        const json = safeJsonParse(raw);
        if (!json) continue;
        results.push(...deepCollectPixivItems(json));
    }
    return uniqBy(results, (x) => x.id);
}

function parseAnchors(html) {
    const $ = cheerio.load(html);
    const results = [];

    $("a[href*='/artworks/'], a[href*='illust_id=']").each((_, el) => {
        const a = $(el);
        const href = a.attr("href");
        const link = normalizeArtworkUrl(href);
        const id = parseArtworkIdFromUrl(link);
        if (!id) return;

        const img = a.find("img").first();
        const image = img.attr("src") || img.attr("data-src") || img.attr("data-lazy-src") || null;
        const title = cleanText(a.attr("title") || a.attr("aria-label") || img.attr("alt") || null);

        let artist = null;
        let artistUrl = null;
        let userId = null;

        const wrapper = a.closest("li, article, div, figure");
        const userAnchor = wrapper.find("a[href*='/users/']").first();

        if (userAnchor.length) {
            artist = cleanText(userAnchor.attr("title") || userAnchor.text() || null);
            artistUrl = normalizeUserUrl(userAnchor.attr("href"));
            userId = artistUrl ? (artistUrl.match(/\/users\/(\d+)/) || [])[1] || null : null;
        }

        results.push({
            id: String(id),
            title: title || null,
            link,
            displayUrl: link,
            image: isValidUrl(image) ? image : null,
            artist,
            artistUrl,
            userId,
            images: [],
        });
    });

    return uniqBy(results, (x) => x.id);
}

function extractResultsFromHtml(html) {
    const items = [
        ...parseInitConfigJson(html),
        ...parseNextData(html),
        ...parsePreloadData(html),
        ...parseAnchors(html),
    ];

    return uniqBy(
        items.filter(Boolean).filter((x) => x.id).map((x) => ({
            id: String(x.id),
            title: cleanText(x.title),
            link: normalizeArtworkUrl(x.link, x.id),
            displayUrl: normalizeArtworkUrl(x.displayUrl || x.link, x.id),
            image: isValidUrl(x.image) ? x.image : null,
            artist: cleanText(x.artist),
            artistUrl: normalizeUserUrl(x.artistUrl, x.userId),
            userId: x.userId ? String(x.userId) : null,
            images: Array.isArray(x.images) ? x.images.filter(isValidUrl) : [],
        })),
        (x) => x.id
    );
}

async function fetchHtmlWithAxios(url) {
    const res = await axios.get(url, {
        headers: {
            ...makeHeaders(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        timeout: 30000,
        maxRedirects: 5,
    });
    return res.data;
}

async function fetchHtmlWithPuppeteer(url) {
    let puppeteer;
    try {
        puppeteer = require("puppeteer");
    } catch {
        throw new Error("Puppeteer is required for this Pixiv URL but is not installed. Install it with: npm install puppeteer");
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
        const page = await browser.newPage();
        await page.setUserAgent(DEFAULT_UA);
        await page.setExtraHTTPHeaders(makeHeaders());
        await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
        await delay(4000);

        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                const distance = 1000;
                const timer = setInterval(() => {
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= 10000) { clearInterval(timer); resolve(); }
                }, 300);
            });
        });

        await delay(2000);
        return await page.content();
    } finally {
        await browser.close();
    }
}

async function fetchArtworkPages(artworkId) {
    const apiUrl = `https://www.pixiv.net/ajax/illust/${artworkId}/pages?lang=en`;

    try {
        const res = await axios.get(apiUrl, {
            headers: {
                ...makeHeaders(),
                "Accept": "application/json, text/plain, */*",
                "X-Requested-With": "XMLHttpRequest",
            },
            timeout: 30000,
        });

        const body = res.data?.body;
        if (!Array.isArray(body)) return [];

        const urls = [];
        for (const page of body) {
            if (page?.urls?.original && isValidUrl(page.urls.original)) {
                urls.push(page.urls.original);
            }
        }
        return uniqBy(urls, (x) => x);
    } catch {
        return [];
    }
}

async function fetchArtworkDetails(artworkId) {
    const apiUrl = `https://www.pixiv.net/ajax/illust/${artworkId}?lang=en`;

    try {
        const res = await axios.get(apiUrl, {
            headers: {
                ...makeHeaders(),
                "Accept": "application/json, text/plain, */*",
                "X-Requested-With": "XMLHttpRequest",
            },
            timeout: 30000,
        });
        return res.data?.body || null;
    } catch {
        return null;
    }
}

async function enrichImages(items) {
    const out = [];

    for (const item of items) {
        const images = await fetchArtworkPages(item.id);

        let artist = item.artist;
        let userId = item.userId;
        let title = item.title;
        let artistUrl = item.artistUrl;

        if (!artist || !userId || !title) {
            const details = await fetchArtworkDetails(item.id);
            if (details) {
                artist = details.userName || artist;
                userId = details.userId || userId;
                title = details.illustTitle || details.title || title;
            }
        }

        if (userId && !artistUrl) {
            artistUrl = `https://www.pixiv.net/users/${userId}`;
        }

        const bestImage = images[0] || item.image || null;

        out.push({
            ...item,
            title: title || item.title,
            artist: artist || item.artist,
            userId: userId || item.userId,
            artistUrl: artistUrl || item.artistUrl,
            image: bestImage,
            images,
        });

        await delay(350);
    }

    return out;
}

async function pixivDownloader(input, options = {}) {
    try {
        const limit = options.limit || 10;
        const enrich = options.enrich !== false;

        let isUrl = false;
        try { new URL(input); isUrl = true; } catch { }

        const inputIsPixiv = isUrl && isPixivUrl(input);
        const singleMode = isUrl && inputIsPixiv;
        const url = isUrl ? input : buildSearchUrl(input);

        let html;
        let results;
        let method = "axios";

        try {
            html = await fetchHtmlWithAxios(url);
            results = extractResultsFromHtml(html);
            if (results.length === 0) throw new Error("No results from axios");
        } catch {
            html = await fetchHtmlWithPuppeteer(url);
            results = extractResultsFromHtml(html);
            method = "puppeteer";
        }

        let finalResults = results;

        if (singleMode) {
            const exactId = parseArtworkIdFromUrl(url);
            if (exactId) {
                finalResults = finalResults.filter((x) => x.id === exactId);
            }
            finalResults = finalResults.slice(0, 1);
        } else {
            finalResults = finalResults.slice(0, limit);
        }

        if (finalResults.length === 0) {
            return {
                status: false,
                platform: "pixiv",
                message: "No Pixiv artwork data found.",
            };
        }

        if (enrich) {
            finalResults = await enrichImages(finalResults);
        }

        return {
            status: true,
            platform: "pixiv",
            method,
            total: finalResults.length,
            results: finalResults,
        };
    } catch (error) {
        return {
            status: false,
            platform: "pixiv",
            message: error.message || "An unexpected error occurred",
        };
    }
}

module.exports = pixivDownloader;
