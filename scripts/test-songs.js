const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { StreamType } = require('@discordjs/voice');
const { getRandomMan } = require('../dist/videos/getrandomman');

test('song selection ignores partial, empty, unsupported files and directories', () => {
    const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'oceancurse-test-')
    );
    const previous = process.env.SONG_DIR;
    process.env.SONG_DIR = directory;
    try {
        fs.writeFileSync(path.join(directory, 'partial.webm.part'), 'partial');
        fs.writeFileSync(path.join(directory, 'empty.webm'), '');
        fs.writeFileSync(path.join(directory, 'unsupported.mp3'), 'audio');
        fs.mkdirSync(path.join(directory, 'directory.webm'));
        assert.throws(() => getRandomMan(), /No songs found/);
        const song = path.join(directory, 'song.WEBM');
        fs.writeFileSync(song, 'audio');
        assert.deepEqual(getRandomMan(), {
            file: song,
            inputType: StreamType.WebmOpus,
        });
        fs.unlinkSync(song);
        fs.writeFileSync(path.join(directory, 'song.opus'), 'audio');
        assert.equal(getRandomMan().inputType, StreamType.OggOpus);
        process.env.SONG_DIR = path.join(directory, 'missing');
        assert.throws(() => getRandomMan(), /is missing/);
    } finally {
        if (previous === undefined) delete process.env.SONG_DIR;
        else process.env.SONG_DIR = previous;
        fs.rmSync(directory, { recursive: true, force: true });
    }
});

// Exercise the actual script with a fake downloader: no network requests.
async function runDownloader(directory, failedId) {
    const calls = [];
    const scriptProcess = {
        argv: ['node', 'download-songs.js', directory],
        env: {},
        execPath: process.execPath,
    };
    let resolveDone;
    const done = new Promise((resolve) => {
        resolveDone = resolve;
    });
    vm.runInNewContext(
        fs.readFileSync(path.join(__dirname, 'download-songs.js'), 'utf8'),
        {
            URL,
            __dirname,
            process: scriptProcess,
            console: {
                log(message) {
                    if (/songs available/.test(message)) resolveDone();
                },
                error() {},
            },
            require(name) {
                if (name !== 'node:child_process') return require(name);
                return {
                    spawn(_command, args) {
                        const child = new EventEmitter();
                        calls.push(args);
                        queueMicrotask(() => {
                            const destination =
                                args[args.indexOf('--output') + 1];
                            if (
                                path.basename(destination) ===
                                `${failedId}.webm`
                            ) {
                                fs.writeFileSync(
                                    `${destination}.part`,
                                    'incomplete'
                                );
                                child.emit('close', 1);
                            } else {
                                fs.writeFileSync(destination, 'audio');
                                child.emit('close', 0);
                            }
                        });
                        return child;
                    },
                };
            },
        }
    );
    await done;
    // Allow main() to assign its exit status after printing the summary.
    await new Promise((resolve) => setImmediate(resolve));
    return { calls, exitCode: scriptProcess.exitCode };
}

test('downloader maintains 32 URLs, reports failures, retries and skips completed songs', async () => {
    const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'oceancurse-download-test-')
    );
    try {
        const first = await runDownloader(directory, '38nZgYurFpw');
        const playlist = fs
            .readFileSync(path.join(__dirname, '..', 'songs.txt'), 'utf8')
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
        assert.deepEqual(
            first.calls.map((args) => args.at(-1)),
            playlist
        );
        assert.equal(first.calls.length, 32);
        assert.equal(new Set(first.calls.map((args) => args.at(-1))).size, 32);
        assert.equal(first.exitCode, 1);
        assert.ok(
            first.calls.every((args) =>
                args.includes('bestaudio[ext=webm][acodec^=opus]')
            )
        );
        assert.equal(
            fs.readdirSync(directory).filter((name) => name.endsWith('.webm'))
                .length,
            31
        );
        const second = await runDownloader(directory);
        assert.equal(second.calls.length, 1);
        assert.equal(second.exitCode, 0);
        const third = await runDownloader(directory);
        assert.equal(third.calls.length, 0);
        assert.equal(third.exitCode, 0);
        fs.writeFileSync(path.join(directory, '38nZgYurFpw.webm'), '');
        const fourth = await runDownloader(directory);
        assert.equal(fourth.calls.length, 1);
        assert.equal(fourth.exitCode, 0);
    } finally {
        fs.rmSync(directory, { recursive: true, force: true });
    }
});
