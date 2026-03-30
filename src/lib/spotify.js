const axios = require('axios');
const youtubedl = require('youtube-dl-exec');

async function getSpotifyTrackInfo(url) {
    try {
        const trackId = url.split('track/')[1]?.split('?')[0] || url.split('track/')[1]?.split('/')[0];

        if (!trackId) {
            throw new Error('Invalid Spotify track URL');
        }

        const { data } = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        let title = data.title || 'Unknown Title';
        let cover = data.thumbnail_url || '';

        const searchQuery = title;

        return {
            id: trackId,
            title: title.replace(/\s*-\s*(Original Audio|Spotify|Audio|Official Video|Lyrics)$/i, '').trim(),
            artist: 'Spotify Track',
            cover: cover,
            url: url,
            searchQuery: searchQuery
        };
    } catch (e) {
        throw new Error('Failed to fetch Spotify metadata: ' + e.message);
    }
}

async function spotifyDownloader(url, options = {}) {
    const { format = 'mp3' } = options;

    if (typeof url !== 'string' || !url.includes('spotify.com/')) {
        return {
            status: false,
            platform: 'spotify',
            message: 'Invalid Spotify URL. Only track links are supported.'
        };
    }

    try {
        const trackMetadata = await getSpotifyTrackInfo(url);

        // search on youtube for the track
        let videoUrl = null;
        try {
            const searchResult = await youtubedl(`ytsearch1:${trackMetadata.searchQuery}`, {
                dumpSingleJson: true,
                noCheckCertificates: true,
                noWarnings: true,
            });
            videoUrl = searchResult.entries?.[0]?.webpage_url || null;
        } catch (err) {
            console.error('Spotify YouTube Search Error:', err.message);
        }

        return {
            status: true,
            platform: 'spotify',
            data: {
                id: trackMetadata.id,
                title: trackMetadata.title,
                artist: trackMetadata.artist,
                cover: trackMetadata.cover,
                url: trackMetadata.url,
                videoUrl: videoUrl, // This will be used by test.js to auto-download
                searchQuery: trackMetadata.searchQuery,
                format: format,
                isAudio: true,
                message: videoUrl ? 'Successfully found a matching video on YouTube' : 'Could not find a matching video on YouTube'
            }
        };

    } catch (err) {
        return {
            status: false,
            platform: 'spotify',
            message: err.message
        };
    }
}

module.exports = spotifyDownloader;
