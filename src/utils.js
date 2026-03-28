const axios = require("axios");
const path = require("path");

const DEFAULT_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36";

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanText(text) {
    if (!text) return null;
    const t = String(text).replace(/\s+/g, " ").trim();
    return t || null;
}

function sanitizeFileName(name) {
    return String(name || "untitled")
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
}

function getExtFromUrl(url, fallback = ".mp4") {
    try {
        const pathname = new URL(url).pathname;
        const ext = path.extname(pathname);
        if (ext) return ext.split("?")[0];
        return fallback;
    } catch {
        return fallback;
    }
}

function formatNumber(num) {
    return new Intl.NumberFormat("en-US").format(num || 0);
}

function isValidUrl(url) {
    if (!url) return false;
    return /^https?:\/\//i.test(url);
}

function safeJsonParse(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function uniqBy(arr, keyFn) {
    const seen = new Set();
    const out = [];
    for (const item of arr) {
        const key = keyFn(item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(item);
    }
    return out;
}

async function makeRequest(url, options = {}) {
    const config = {
        headers: {
            "User-Agent": DEFAULT_UA,
            ...options.headers,
        },
        timeout: options.timeout || 30000,
        maxRedirects: options.maxRedirects || 5,
        ...options,
    };
    delete config.headers;
    config.headers = {
        "User-Agent": DEFAULT_UA,
        ...options.headers,
    };
    return axios(url, config);
}

module.exports = {
    DEFAULT_UA,
    delay,
    cleanText,
    sanitizeFileName,
    getExtFromUrl,
    formatNumber,
    isValidUrl,
    safeJsonParse,
    uniqBy,
    makeRequest,
};
