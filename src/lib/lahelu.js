const axios = require("axios");
const { DEFAULT_UA, sanitizeFileName, getExtFromUrl, formatNumber } = require("../utils");

function isLaheluUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname.includes("lahelu.com") && u.pathname.includes("/post/");
    } catch {
        return false;
    }
}

function extractPostId(url) {
    try {
        const urlObj = new URL(url);
        const paths = urlObj.pathname.split("/").filter(p => p);
        if (paths.length >= 2 && paths[0] === "post" && paths[1]) {
            return paths[1];
        }
    } catch {
        const match = url.match(/lahelu\.com\/post\/([a-zA-Z0-9_-]+)/);
        if (match) return match[1];
    }
    return null;
}

async function fetchLaheluData(postId) {
    for (let page = 1; page <= 10; page++) {
        const apiUrl = `https://lahelu.com/api/post/get-posts?feed=1&page=${page}`;

        const res = await axios.get(apiUrl, {
            headers: {
                "User-Agent": DEFAULT_UA,
                "Referer": "https://lahelu.com/",
            },
            timeout: 15000,
        });

        if (res.data && res.data.postInfos && Array.isArray(res.data.postInfos)) {
            const post = res.data.postInfos.find(p => p.postId === postId || p.postID === postId);
            if (post) return post;
            if (!res.data.hasMore) break;
        }
    }
    return null;
}

function normalizeMedia(post) {
    const CACHE_URL = "https://cache.lahelu.com/";
    const medias = [];

    if (post.mediaType === "video" || post.type === "video") {
        const videoUrl = post.media?.startsWith("http") ? post.media : CACHE_URL + post.media;
        medias.push({
            type: "video",
            format: "mp4",
            url: videoUrl,
            desc: "Video",
        });
    } else if (post.mediaType === "image" || post.type === "image") {
        const imageUrl = post.media?.startsWith("http") ? post.media : CACHE_URL + post.media;
        medias.push({
            type: "image",
            format: getExtFromUrl(imageUrl, ".jpg"),
            url: imageUrl,
            desc: "Image",
        });
    }

    if (post.content && Array.isArray(post.content) && post.content.length > 0) {
        const firstItem = post.content[0];
        const mediaUrl = firstItem.value?.startsWith("http") ? firstItem.value : CACHE_URL + firstItem.value;
        const isVideo = firstItem.type === "video" || (firstItem.value && firstItem.value.match(/\.(mp4|webm|mov)(\?.*)?$/i));
        const mediaType = isVideo ? "video" : "image";
        const format = mediaType === "video" ? "mp4" : getExtFromUrl(mediaUrl, ".jpg");

        medias.push({
            type: mediaType,
            format: format,
            url: mediaUrl,
            desc: mediaType === "video" ? "Video" : "Image",
        });
    }

    return medias;
}

async function laheluDownloader(url) {
    try {
        if (!isLaheluUrl(url)) {
            return {
                status: false,
                platform: "lahelu",
                message: "Invalid Lahelu URL. Make sure it's a valid post URL.",
            };
        }

        const postId = extractPostId(url);
        if (!postId) {
            return {
                status: false,
                platform: "lahelu",
                message: "Could not extract post ID from URL.",
            };
        }

        const post = await fetchLaheluData(postId);

        if (!post) {
            return {
                status: false,
                platform: "lahelu",
                message: "Post not found. The post may have been deleted or is private.",
            };
        }

        const medias = normalizeMedia(post);

        if (medias.length === 0) {
            return {
                status: false,
                platform: "lahelu",
                message: "No media found in this post.",
            };
        }

        const title = post.title || "Untitled";
        const author = post.userUsername || post.userInfo?.username || "Unknown";
        const createdAt = post.createTime ? new Date(post.createTime * 1000).toLocaleDateString("en-US") : "-";
        const views = parseInt(post.totalViews || 0, 10);
        const likes = parseInt(post.totalUpvotes || 0, 10);
        const comments = parseInt(post.totalComments || 0, 10);

        const selected = medias[0];
        const ext = selected.format.startsWith(".") ? selected.format : "." + selected.format;
        const safeTitle = sanitizeFileName(postId);
        const fileName = `${safeTitle}_${selected.type}${ext}`;

        return {
            status: true,
            platform: "lahelu",
            data: {
                postId: post.postId || post.postID || postId,
                title: title,
                author: author,
                createdAt: createdAt,
                stats: {
                    views: views,
                    likes: likes,
                    comments: comments,
                },
                media: {
                    type: selected.type,
                    format: selected.format,
                    url: selected.url,
                    desc: selected.desc,
                },
                fileName: fileName,
            },
        };
    } catch (error) {
        return {
            status: false,
            platform: "lahelu",
            message: error.message || "An unexpected error occurred",
        };
    }
}

module.exports = laheluDownloader;
