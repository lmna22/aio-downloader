const fs = require('fs');
const fsPromises = require('fs').promises;
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');
const { join } = require('path');

let ffmpegPath;
try {
    ffmpegPath = require('ffmpeg-static');
} catch (err) { }

let youtubedl;
try {
    youtubedl = require('youtube-dl-exec');
} catch (err) { }

const tempDir = os.tmpdir();

const QUALITY_MAP = {
    1: '160',
    2: '134',
    3: '135',
    4: '136',
    5: '137',
    6: '264',
    7: '266',
    8: 'bestaudio',
    9: 'bitrateList'
};

async function youtubeDownloader(link, qualityIndex) {
    if (!youtubedl) {
        return {
            status: false,
            platform: "youtube",
            message: "youtube-dl-exec is not installed. Install it with: npm install youtube-dl-exec",
        };
    }
    try {
        let quality = QUALITY_MAP[qualityIndex] || QUALITY_MAP[2];

        const info = await youtubedl(link, {
            dumpSingleJson: true,
            noCheckCertificates: true,
            noWarnings: true,
            preferFreeFormats: true,
            addHeader: ['referer:youtube.com', 'user-agent:googlebot']
        });

        const videoDetails = info;
        const thumb = info.thumbnail;

        const tempInfoFile = path.join(tempDir, `info_${Date.now()}.json`);
        await fsPromises.writeFile(tempInfoFile, JSON.stringify(info));

        let result;
        if (quality === 'bitrateList') {
            result = getBitrateList(info);
        } else if (qualityIndex > 7 || quality === 'bestaudio') {
            result = await downloadAudioOnly(tempInfoFile, quality, videoDetails, thumb);
        } else {
            result = await downloadVideoWithAudio(tempInfoFile, quality, videoDetails, thumb);
        }

        await fsPromises.unlink(tempInfoFile);

        return result;

    } catch (err) {
        return {
            status: false,
            platform: "youtube",
            message: err.message,
        };
    }
}

function getBitrateList(info) {
    const bitrateList = info.formats
        .filter(element => element.acodec !== 'none' && element.vcodec === 'none')
        .map(element => ({
            codec: element.acodec,
            bitrate: element.abr,
            format_id: element.format_id
        }))
        .sort((a, b) => b.bitrate - a.bitrate);

    return {
        status: true,
        platform: "youtube",
        data: { bitrateList }
    };
}

async function downloadAudioOnly(infoFile, quality, videoDetails, thumb) {
    const tempMp3 = path.join(tempDir, `temp_audio_${Date.now()}.mp3`);

    await youtubedl.exec('', {
        loadInfoJson: infoFile,
        extractAudio: true,
        audioFormat: 'mp3',
        audioQuality: '0',
        output: tempMp3
    });

    const mp3Buffer = await fsPromises.readFile(tempMp3);
    await fsPromises.unlink(tempMp3);

    return createResponse(videoDetails, mp3Buffer, quality, thumb, 'mp3');
}

async function downloadVideoWithAudio(infoFile, quality, videoDetails, thumb) {
    const baseName = `temp_video_${Date.now()}`;
    const videoOutput = path.join(tempDir, `${baseName}.fvideo.mp4`);
    const audioOutput = path.join(tempDir, `${baseName}.faudio.m4a`);
    const finalOutput = path.join(tempDir, `${baseName}.mp4`);

    try {
        await youtubedl.exec('', {
            loadInfoJson: infoFile,
            format: quality,
            output: videoOutput
        });

        await youtubedl.exec('', {
            loadInfoJson: infoFile,
            format: 'bestaudio',
            output: audioOutput
        });

        await new Promise((resolve, reject) => {
            const ffmpeg = spawn(ffmpegPath, [
                '-i', videoOutput,
                '-i', audioOutput,
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-strict', 'experimental',
                finalOutput
            ]);

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`ffmpeg exited with code ${code}`));
                }
            });
        });

        const mp4Buffer = await fsPromises.readFile(finalOutput);

        await fsPromises.unlink(videoOutput);
        await fsPromises.unlink(audioOutput);
        await fsPromises.unlink(finalOutput);

        return createResponse(videoDetails, mp4Buffer, quality, thumb, 'mp4');

    } catch (err) {
        throw err;
    }
}

function createResponse(videoDetails, buffer, quality, thumb, type) {
    return {
        status: true,
        platform: "youtube",
        data: {
            title: videoDetails.title,
            result: buffer,
            size: buffer.length,
            quality,
            desc: videoDetails.description,
            views: videoDetails.view_count,
            likes: videoDetails.like_count,
            dislikes: 0,
            channel: videoDetails.uploader,
            uploadDate: videoDetails.upload_date,
            thumb,
            type
        },
    };
}

function sanitizeTitle(title) {
    return title
        .replace(/[\/\\:*?"<>|]/g, '_')
        .trim();
}

async function youtubePlaylistDownloader(url, quality, folderPath = join(process.cwd() + '/temp')) {
    let playlistId;
    try {
        playlistId = url.slice(url.indexOf("list="), url.indexOf("&index"));
    } catch {
        return {
            status: false,
            platform: "youtube",
            message: 'Invalid Playlist URL'
        };
    }
    try {
        const axios = require('axios');
        const { data } = await axios.get(url);
        const htmlStr = data;

        let arr = htmlStr.split('"watchEndpoint":{"videoId":"');
        var db = {};

        for (var i = 1; i < arr.length; i++) {
            let str = arr[i];
            let eI = str.indexOf('"');
            if (str.slice(eI, eI + 13) != '","playlistId') continue;
            let sstr = str.slice(0, eI);
            db[sstr] = 1;
        }

        let title = htmlStr.match(/property="og:title" content="(.+?)"/)?.[1];

        let resultPath = [];
        let metadata = [];

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath);
        }

        for (const key of Object.keys(db)) {
            const res = await youtubeDownloader(`https://www.youtube.com/watch?v=${key}`, quality);
            if (res.status && res.data) {
                const filePath = join(folderPath, `${sanitizeTitle(res.data.title)}.${res.data.type}`);
                fs.writeFileSync(filePath, res.data.result);
                resultPath.push(filePath);
                metadata.push(res.data);
            }
        }

        return {
            status: true,
            platform: "youtube",
            data: {
                title,
                resultPath,
                metadata
            }
        };
    } catch (e) {
        return {
            status: false,
            platform: "youtube",
            message: e.message || 'Something went wrong.'
        };
    }
}

module.exports = {
    youtubeDownloader,
    youtubePlaylistDownloader
};
