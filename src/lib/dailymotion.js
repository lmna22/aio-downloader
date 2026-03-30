const puppeteer = require('puppeteer');

function extractVideoId(url) {
    const patterns = [
        /dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
        /dai\.ly\/([a-zA-Z0-9]+)/,
        /dailymotion\.com\/embed\/video\/([a-zA-Z0-9]+)/,
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

async function fetchDailymotionData(url) {
    const videoId = extractVideoId(url);
    if (!videoId) {
        throw new Error('Invalid Dailymotion URL');
    }

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        let videoData = null;
        let masterM3U8Url = null;
        let masterM3U8Content = null;

        page.on('response', async (response) => {
            const resUrl = response.url();

            if (resUrl.includes('geo.dailymotion.com') && resUrl.includes('/video/') && resUrl.includes('.json') && !resUrl.includes('fields=')) {
                try {
                    const data = await response.json();
                    if (data && data.id === videoId) {
                        videoData = data;
                    }
                } catch (e) { }
            }

            if (resUrl.includes('cdndirector.dailymotion.com') && resUrl.includes('.m3u8') && !resUrl.includes('cookie_sync') && !resUrl.includes('af=')) {
                try {
                    const text = await response.text();
                    if (text.includes('#EXTM3U') && text.includes('#EXT-X-STREAM-INF')) {
                        masterM3U8Url = resUrl;
                        masterM3U8Content = text;
                    }
                } catch (e) { }
            }

            if (resUrl.includes('graphql-eu-west-1.api.dailymotion.com') && resUrl.includes('video')) {
                try {
                    const data = await response.json();
                    if (data && data.data && data.data.video && data.data.video.xid === videoId) {
                        const v = data.data.video;
                        videoData = {
                            id: v.xid || v.id,
                            title: v.title,
                            description: v.description,
                            duration: v.duration,
                            author: v.author,
                            thumbnails: {
                                '360': v.thumbnailx360,
                                '480': v.thumbnailx480,
                                '720': v.thumbnailx720
                            },
                            created_time: v.createdAt ? Math.floor(new Date(v.createdAt).getTime() / 1000) : null,
                            views_total: v.views,
                            likes_total: v.likes
                        };
                    }
                } catch (e) { }
            }
        });

        await page.goto(url, {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        await new Promise(r => setTimeout(r, 5000));

        if (!videoData) {
            videoData = await page.evaluate((id) => {
                const content = document.documentElement.outerHTML;

                const jsonPattern = new RegExp('{"id":"[^"]*' + id + '[^}]*"title":"[^"]+"[^}]*}', 'g');
                const matches = content.match(jsonPattern);

                if (matches && matches.length > 0) {
                    for (const match of matches) {
                        try {
                            const data = JSON.parse(match);
                            if (data.id === id && data.title) {
                                return {
                                    id: data.id,
                                    title: data.title,
                                    description: data.description || '',
                                    duration: data.duration || 0,
                                    author: data.author || '',
                                    thumbnails: data.thumbnails || {},
                                    created_time: data.created_time,
                                    views_total: data.views_total,
                                    likes_total: data.likes_total
                                };
                            }
                        } catch (e) { }
                    }
                }
                return null;
            }, videoId);
        }

        if (!videoData) {
            throw new Error('Failed to fetch video metadata');
        }

        if (!masterM3U8Content || !masterM3U8Content.includes('#EXT-X-STREAM-INF')) {
            throw new Error('No video stream found');
        }

        await browser.close();

        const lines = masterM3U8Content.split('\n');
        const streams = [];
        let currentBandwidth = 0;
        let currentResolution = '';
        let currentName = '';

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line.startsWith('#EXT-X-STREAM-INF:')) {
                const bwMatch = line.match(/BANDWIDTH=(\d+)/);
                const resMatch = line.match(/RESOLUTION=(\d+x\d+)/);
                const nameMatch = line.match(/NAME="([^"]+)"/);

                currentBandwidth = bwMatch ? parseInt(bwMatch[1]) : 0;
                currentResolution = resMatch ? resMatch[1] : '';
                currentName = nameMatch ? nameMatch[1] : '';
            } else if (line && !line.startsWith('#') && (line.includes('.m3u8') || line.includes('dmcdn'))) {
                if (currentResolution) {
                    const [width, height] = currentResolution.split('x').map(Number);
                    const fullUrl = line.startsWith('http') ? line : masterM3U8Url.substring(0, masterM3U8Url.lastIndexOf('/') + 1) + line;
                    streams.push({
                        quality: currentName ? `${currentName}p` : `${height}p`,
                        height: height,
                        width: width,
                        bandwidth: currentBandwidth,
                        name: currentName,
                        fps: null,
                        formatId: currentResolution,
                        type: 'MP4',
                        url: fullUrl,
                    });
                }
                currentResolution = '';
            }
        }

        if (streams.length === 0) {
            throw new Error('No video qualities found in manifest');
        }

        streams.sort((a, b) => a.height - b.height);

        streams.push({
            quality: 'Audio Only',
            height: 0,
            width: 0,
            bandwidth: streams[0].bandwidth,
            name: 'Audio',
            fps: null,
            formatId: 'audio',
            type: 'MP3',
            url: streams[0].url,
        });

        const metadata = {
            id: videoData.id || videoId,
            title: videoData.title || 'Unknown',
            description: videoData.description || '',
            duration: videoData.duration || 0,
            views: parseInt(videoData.views_total) || 0,
            likes: parseInt(videoData.likes_total) || 0,
            owner: {
                screenname: videoData.owner?.screenname || videoData.author || '',
                username: videoData.owner?.username || '',
                id: videoData.owner?.id || '',
            },
            thumbnail: videoData.thumbnails?.['720'] || videoData.thumbnails?.['480'] || videoData.thumbnails?.['360'] || '',
            uploadDate: videoData.created_time ? new Date(videoData.created_time * 1000).toISOString() : '',
        };

        return {
            metadata,
            streams,
            info: videoData,
        };
    } catch (err) {
        if (browser) await browser.close().catch(() => { });
        throw err;
    }
}

async function dailymotionDownloader(url) {
    if (typeof url !== 'string' || (!url.includes('dailymotion.com') && !url.includes('dai.ly'))) {
        return {
            status: false,
            platform: "dailymotion",
            message: 'Invalid Dailymotion URL'
        };
    }

    try {
        const data = await fetchDailymotionData(url);

        if (!data || !data.metadata || !data.streams || data.streams.length === 0) {
            return {
                status: false,
                platform: "dailymotion",
                message: 'Failed to get video data'
            };
        }

        const { metadata, streams } = data;

        const videoUrls = streams
            .filter(s => s.quality !== 'Audio Only')
            .map(s => s.url);

        const audioUrl = streams.find(s => s.quality === 'Audio Only')?.url;

        const qualities = streams
            .filter(s => s.quality !== 'Audio Only')
            .map(s => ({
                quality: s.quality,
                resolution: `${s.width}x${s.height}`,
                bandwidth: s.bandwidth,
                url: s.url
            }));

        return {
            status: true,
            platform: "dailymotion",
            data: {
                id: metadata.id,
                title: metadata.title,
                description: metadata.description,
                duration: metadata.duration,
                views: metadata.views,
                likes: metadata.likes,
                author: metadata.owner?.screenname || metadata.owner?.username,
                thumbnail: metadata.thumbnail,
                uploadDate: metadata.uploadDate,
                url: videoUrls.length > 0 ? videoUrls : [audioUrl],
                audio: audioUrl || null,
                qualities: qualities,
                isVideo: true
            }
        };
    } catch (error) {
        return {
            status: false,
            platform: "dailymotion",
            message: error.message
        };
    }
}

module.exports = dailymotionDownloader;
