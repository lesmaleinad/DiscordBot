// Run separately from the bot. Only completed Opus/WebM files are playable.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

async function main() {
    const oceanManVideos = fs
        .readFileSync(path.join(__dirname, '..', 'songs.txt'), 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
    if (oceanManVideos.length === 0)
        throw new Error('songs.txt contains no song URLs');
    const directory = path.resolve(
        process.argv[2] || process.env.SONG_DIR || 'songs'
    );
    const ytDlp = process.env.YT_DLP_PATH || 'yt-dlp';
    fs.mkdirSync(directory, { recursive: true });
    let failed = 0;
    for (const url of oceanManVideos) {
        const parsed = new URL(url);
        const id =
            parsed.hostname === 'youtu.be'
                ? parsed.pathname.slice(1)
                : parsed.searchParams.get('v');
        const destination = path.join(directory, `${id}.webm`);
        if (fs.existsSync(destination) && fs.statSync(destination).size > 0) {
            console.log(`SKIP ${id}: already downloaded`);
            continue;
        }
        console.log(`DOWNLOAD ${url}`);
        const code = await new Promise((resolve) => {
            const child = spawn(
                ytDlp,
                [
                    '--ignore-config',
                    '--no-playlist',
                    '--force-overwrites',
                    '--js-runtimes',
                    `node:${process.execPath}`,
                    '--format',
                    'bestaudio[ext=webm][acodec^=opus]',
                    '--output',
                    destination,
                    url,
                ],
                { windowsHide: true, stdio: 'inherit' }
            );
            child.on('error', (error) => {
                console.error(error.message);
                resolve(1);
            });
            child.on('close', (exitCode) => resolve(exitCode ?? 1));
        });
        if (
            code !== 0 ||
            !fs.existsSync(destination) ||
            fs.statSync(destination).size === 0
        ) {
            failed++;
            console.error(`FAIL ${url}`);
        }
    }
    console.log(
        `${oceanManVideos.length - failed}/${
            oceanManVideos.length
        } songs available in ${directory}`
    );
    process.exitCode = failed ? 1 : 0;
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
