import {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
    StreamType,
} from '@discordjs/voice';
import { Client, VoiceChannel } from 'discord.js';
import { spawn } from 'child_process';
import { optionalEnvironment } from '../environment';
import { channelIsTextChannel, fetchChannel } from '../validators/channel';
import { getRandomMan } from '../videos/getrandomman';
import { errorFields, log } from '../diagnostics';

export async function sendMessageToTextChannel(
    client: Client,
    channelId: string,
    message: string
) {
    const channel = await fetchChannel(client, channelId, channelIsTextChannel);
    return channel.send(message);
}

export interface PlaybackSession {
    completion: Promise<void>;
    stop(reason: string): boolean;
}

export function playOceanMan(voiceChannel: VoiceChannel): PlaybackSession {
    let stop = (_reason: string) => false;
    const completion = new Promise<void>((resolve) => {
        const startedAt = Date.now();
        const playbackId = startedAt.toString(36);
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        const player = createAudioPlayer();
        const link = getRandomMan();
        const ytDlp =
            optionalEnvironment('YT_DLP_PATH') ??
            (process.platform === 'win32'
                ? 'C:\\ProgramData\\OceanCurse\\bin\\yt-dlp.exe'
                : 'yt-dlp');
        log.info('playback.started', {
            playbackId,
            guildId: voiceChannel.guildId,
            channelId: voiceChannel.id,
            link,
        });
        const downloader = spawn(
            ytDlp,
            [
                '--no-playlist',
                '--quiet',
                '--no-warnings',
                '--js-runtimes',
                `node:${process.execPath}`,
                '--format',
                'bestaudio[ext=webm][acodec^=opus]/bestaudio[ext=webm]/bestaudio',
                '--output',
                '-',
                link,
            ],
            {
                windowsHide: true,
                stdio: ['ignore', 'pipe', 'pipe'],
            }
        );

        let settled = false;
        const finish = (reason: string, failed = false): boolean => {
            if (settled) return false;
            settled = true;
            clearTimeout(timeout);
            const fields = {
                playbackId,
                reason,
                durationMs: Date.now() - startedAt,
                link,
            };
            if (failed) log.warn('playback.finished', fields);
            else log.info('playback.finished', fields);
            if (!downloader.killed) downloader.kill();
            try {
                connection.destroy();
            } catch (error) {
                log.warn('playback.disconnect_failed', {
                    playbackId,
                    ...errorFields(error),
                });
            }
            resolve();
            return true;
        };
        stop = (reason: string) => finish(reason);

        const timeout = setTimeout(
            () => finish('timeout', true),
            10 * 60 * 1000
        );

        downloader.stderr.setEncoding('utf8');
        downloader.stderr.on('data', (data: string) => {
            const message = data.trim();
            if (message) {
                log.warn('playback.downloader_stderr', {
                    playbackId,
                    message,
                });
            }
        });
        downloader.on('error', (error) => {
            log.error('playback.downloader_error', {
                playbackId,
                ...errorFields(error),
            });
            finish('downloader_error', true);
        });
        downloader.on('exit', (code, signal) => {
            if (!settled && code !== 0) {
                log.warn('playback.downloader_exit', {
                    playbackId,
                    exitCode: code,
                    signal,
                });
                finish('downloader_exit', true);
            }
        });

        connection.on('error', (error) => {
            log.error('playback.connection_error', {
                playbackId,
                ...errorFields(error),
            });
        });
        connection.subscribe(player);
        player.play(
            createAudioResource(downloader.stdout, {
                inputType: StreamType.WebmOpus,
            })
        );
        player.on(AudioPlayerStatus.Idle, () => finish('audio_player_idle'));
        player.on('error', (error) => {
            log.error('playback.player_error', {
                playbackId,
                ...errorFields(error),
            });
            finish('audio_player_error', true);
        });
    });

    return { completion, stop };
}
