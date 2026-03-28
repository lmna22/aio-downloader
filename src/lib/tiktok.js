const axios = require('axios');
const cheerio = require('cheerio');

let CookieJar, wrapper;
try {
    CookieJar = require('tough-cookie').CookieJar;
    wrapper = require('axios-cookiejar-support').wrapper;
} catch (err) { }

function extractVideoId(url) {
    const match = url.match(/\/(?:video|photo)\/(\d+)/);
    return match ? match[1] : null;
}

async function tiktokViaTikwm(url) {
    const res = await axios.post('https://www.tikwm.com/api/',
        new URLSearchParams({ url, count: 12, cursor: 0, web: 1, hd: 1 }).toString(),
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            },
            timeout: 15000,
        }
    );

    const apiData = res.data;
    if (!apiData || apiData.code !== 0 || !apiData.data) {
        throw new Error('tikwm API returned an error or empty data.');
    }

    const d = apiData.data;
    const isImages = d.images && d.images.length > 0;

    const importantData = {
        videoId: d.id,
        description: d.title,
        createTime: d.create_time,
        videoUrl: isImages ? null : (d.hdplay || d.play),
        videoInfo: {
            size: d.size || null,
            duration: d.duration,
            width: d.width || null,
            height: d.height || null,
            definition: d.hd_size ? 'hd' : 'sd',
            coverUrl: d.cover || d.origin_cover,
            subtitles: []
        },
        author: {
            id: d.author?.id,
            uniqueId: d.author?.unique_id,
            nickname: d.author?.nickname,
            avatarThumb: d.author?.avatar
        },
        music: {
            id: d.music_info?.id,
            title: d.music_info?.title,
            authorName: d.music_info?.author,
            playUrl: d.music_info?.play || d.music,
            isOriginal: d.music_info?.original
        },
        stats: {
            likes: d.digg_count,
            shares: d.share_count,
            comments: d.comment_count,
            plays: d.play_count,
            collects: d.collect_count,
            reposts: null
        },
        locationCreated: null,
        videoBuffer: null,
    };

    if (isImages) {
        importantData.images = d.images;
        importantData.videoInfo.type = 'images';
    }

    return {
        status: true,
        platform: "tiktok",
        data: importantData
    };
}

async function tiktokViaDirect(url) {
    if (!CookieJar || !wrapper) {
        throw new Error('Direct scraping requires tough-cookie and axios-cookiejar-support.');
    }

    const jar = new CookieJar();
    const apiClient = axios.create({
        jar: jar,
        withCredentials: true,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0'
        }
    });
    wrapper(apiClient);

    const htmlResponse = await apiClient.get(url);
    const html = htmlResponse.data;
    const $ = cheerio.load(html);
    let itemStruct = null;

    // Approach 1: __UNIVERSAL_DATA_FOR_REHYDRATION__
    const universalData = $('#__UNIVERSAL_DATA_FOR_REHYDRATION__').html();
    if (universalData) {
        try {
            const jsonData = JSON.parse(universalData);
            itemStruct = jsonData?.__DEFAULT_SCOPE__?.["webapp.video-detail"]?.itemInfo?.itemStruct;
        } catch { }
    }

    // Approach 2: __NEXT_DATA__
    if (!itemStruct) {
        const nextData = $('#__NEXT_DATA__').html();
        if (nextData) {
            try {
                const jsonData = JSON.parse(nextData);
                itemStruct = jsonData?.props?.pageProps?.itemInfo?.itemStruct;
            } catch { }
        }
    }

    // Approach 3: SIGI_STATE script
    if (!itemStruct) {
        const sigiScript = $('script').filter((_, el) => {
            const text = $(el).html() || '';
            return text.includes('SIGI_STATE') || text.includes('"ItemModule"');
        }).html();
        if (sigiScript) {
            try {
                const match = sigiScript.match(/window\['SIGI_STATE'\]\s*=\s*(\{.+?\});/s)
                    || sigiScript.match(/SIGI_STATE\s*=\s*(\{.+?\});/s);
                if (match) {
                    const sigiData = JSON.parse(match[1]);
                    const itemModule = sigiData?.ItemModule;
                    if (itemModule) {
                        const firstKey = Object.keys(itemModule)[0];
                        if (firstKey) itemStruct = itemModule[firstKey];
                    }
                }
            } catch { }
        }
    }

    if (!itemStruct) throw new Error('Direct scraping failed.');

    const videoUrlToDownload = itemStruct.video?.downloadAddr || itemStruct.video?.playAddr;
    const videoId = itemStruct.id;

    const importantData = {
        videoId: videoId,
        description: itemStruct.desc,
        createTime: itemStruct.createTime,
        videoUrl: videoUrlToDownload,
        videoInfo: {
            size: null,
            duration: itemStruct.video?.duration,
            width: itemStruct.video?.width,
            height: itemStruct.video?.height,
            definition: itemStruct.video?.definition,
            coverUrl: itemStruct.video?.cover,
            subtitles: itemStruct.video?.subtitleInfos?.map(sub => ({
                language: sub.LanguageCodeName, url: sub.Url, format: sub.Format, source: sub.Source
            })) || []
        },
        author: {
            id: itemStruct.author?.id,
            uniqueId: itemStruct.author?.uniqueId,
            nickname: itemStruct.author?.nickname,
            avatarThumb: itemStruct.author?.avatarThumb
        },
        music: {
            id: itemStruct.music?.id,
            title: itemStruct.music?.title,
            authorName: itemStruct.music?.authorName,
            playUrl: itemStruct.music?.playUrl,
            isOriginal: itemStruct.music?.original
        },
        stats: {
            likes: itemStruct.statsV2?.diggCount ?? itemStruct.stats?.diggCount,
            shares: itemStruct.statsV2?.shareCount ?? itemStruct.stats?.shareCount,
            comments: itemStruct.statsV2?.commentCount ?? itemStruct.stats?.commentCount,
            plays: itemStruct.statsV2?.playCount ?? itemStruct.stats?.playCount,
            collects: itemStruct.statsV2?.collectCount ?? itemStruct.stats?.collectCount,
            reposts: itemStruct.statsV2?.repostCount
        },
        locationCreated: itemStruct.locationCreated,
        videoBuffer: null
    };

    if (videoUrlToDownload) {
        try {
            const videoResponse = await apiClient.get(videoUrlToDownload, {
                responseType: 'arraybuffer',
                headers: {
                    'Referer': url,
                    'Range': 'bytes=0-'
                }
            });

            if (videoResponse.status === 200 || videoResponse.status === 206) {
                importantData.videoBuffer = Buffer.from(videoResponse.data);
                importantData.videoInfo.size = videoResponse.data.length;
            }
        } catch (videoError) {
            // Video download failed, but metadata is still available
        }
    }

    return {
        status: true,
        platform: "tiktok",
        data: importantData
    };
}

async function tiktokDownloader(url) {
    // Try direct scraping first
    try {
        return await tiktokViaDirect(url);
    } catch { }

    // Fallback: tikwm.com API
    try {
        return await tiktokViaTikwm(url);
    } catch (error) {
        return {
            status: false,
            platform: "tiktok",
            message: error.message || 'All TikTok scraping methods failed.'
        };
    }
}

module.exports = tiktokDownloader;

