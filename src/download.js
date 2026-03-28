const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { DEFAULT_UA } = require("./utils");

async function download(url, outputPath, options = {}) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const res = await axios.get(url, {
        responseType: "stream",
        headers: {
            "User-Agent": DEFAULT_UA,
            ...options.headers,
        },
        timeout: options.timeout || 120000,
    });

    const totalBytes = parseInt(res.headers["content-length"] || "0", 10);
    let downloadedBytes = 0;

    if (options.onProgress && typeof options.onProgress === "function") {
        res.data.on("data", (chunk) => {
            downloadedBytes += chunk.length;
            options.onProgress({
                downloaded: downloadedBytes,
                total: totalBytes,
                percentage: totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0,
            });
        });
    }

    return new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(outputPath);
        res.data.pipe(writer);

        writer.on("finish", () => {
            const stats = fs.statSync(outputPath);
            resolve({
                path: outputPath,
                size: stats.size,
                filename: path.basename(outputPath),
            });
        });

        writer.on("error", reject);
        res.data.on("error", reject);
    });
}

module.exports = download;
