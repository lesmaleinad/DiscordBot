// Run separately from the bot. Only completed Opus/WebM files are playable.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const oceanManVideos = [
    'https://www.youtube.com/watch?v=tkzY_VwNIek',
    'https://www.youtube.com/watch?v=Aad3ufeWQDc',
    'https://www.youtube.com/watch?v=sX25DfAkmBo',
    'https://youtu.be/bC_k4ClAEqc',
    'https://youtu.be/ZjZFn4ZKIzY',
    'https://youtu.be/xfm8xjyBbeg',
    'https://youtu.be/qLTNjWdzqGo',
    'https://youtu.be/DU8Gq3-tccI',
    'https://youtu.be/NQLHwyY9S7w',
    'https://youtu.be/k2ECO76kI44',
    'https://youtu.be/YCDLkW8uwz4',
    'https://youtu.be/W5jQm9esneU',
    'https://youtu.be/X0N9fQtzSHw',
    'https://youtu.be/BfSvnzWAm6Q',
    'https://youtu.be/QFwq3CI1Jw0',
    'https://www.youtube.com/watch?v=8Oob96u2cOg',
    'https://www.youtube.com/watch?v=91nTBwkqG2k',
    'https://www.youtube.com/watch?v=A7LlJzEeI14',
    'https://www.youtube.com/watch?v=-W6abbyFQe0',
    'https://www.youtube.com/watch?v=49F1QWAl_u0',
    'https://www.youtube.com/watch?v=Mbu2KRC0wxg',
    'https://www.youtube.com/watch?v=I3lVZVWCdOo',
    'https://www.youtube.com/watch?v=vEyNlGXuqiw',
    'https://www.youtube.com/watch?v=BEc5hVMGcHw',
    'https://www.youtube.com/watch?v=ya-733fydeI',
    'https://youtu.be/6CE0mfAJn1E',
    'https://youtu.be/GtlpjfNn6VM',
    'https://youtu.be/38nZgYurFpw',
    'https://youtu.be/c7NQiQRYgLs',
    'https://youtu.be/jBamD9KG4Ug',
    'https://youtu.be/n8iZl6qIuZw',
    'https://youtu.be/15pnC9gmiIQ',
];

async function main() {
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
