const { spawn } = require('child_process');
const { oceanManVideos } = require('../dist/videos/getrandomman');

const ytDlp =
    process.env.YT_DLP_PATH ??
    (process.platform === 'win32'
        ? 'C:\\ProgramData\\OceanCurse\\bin\\yt-dlp.exe'
        : 'yt-dlp');
const concurrency = 4;

async function check(url) {
    return new Promise((resolve) => {
        const processHandle = spawn(
            ytDlp,
            [
                '--simulate',
                '--no-playlist',
                '--quiet',
                '--no-warnings',
                '--js-runtimes',
                `node:${process.execPath}`,
                '--format',
                'bestaudio[ext=webm][acodec^=opus]/bestaudio[ext=webm]/bestaudio',
                url,
            ],
            { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] }
        );
        let error = '';
        processHandle.stderr.setEncoding('utf8');
        processHandle.stderr.on('data', (data) => {
            error += data;
        });
        processHandle.on('error', (spawnError) => {
            resolve({ url, ok: false, error: spawnError.message });
        });
        processHandle.on('exit', (code) => {
            resolve({
                url,
                ok: code === 0,
                error: error.trim().split(/\r?\n/).at(-1) ?? '',
            });
        });
    });
}

async function main() {
    const results = [];
    let nextIndex = 0;

    async function worker() {
        while (nextIndex < oceanManVideos.length) {
            const index = nextIndex++;
            const result = await check(oceanManVideos[index]);
            results[index] = result;
            console.log(`${result.ok ? 'OK  ' : 'FAIL'} ${result.url}`);
        }
    }

    await Promise.all(
        Array.from(
            { length: Math.min(concurrency, oceanManVideos.length) },
            worker
        )
    );

    const failed = results.filter((result) => !result.ok);
    console.log(
        JSON.stringify(
            {
                checked: results.length,
                passed: results.length - failed.length,
                failed,
            },
            null,
            2
        )
    );
    process.exitCode = failed.length === 0 ? 0 : 1;
}

void main();
