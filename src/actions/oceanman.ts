import {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
} from '@discordjs/voice';
import { Client, VoiceChannel } from 'discord.js';
import fs from 'fs';
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
    // Select and open before joining voice so missing songs do not cause a reconnect.
    const { file, inputType } = getRandomMan();
    const audio = fs.createReadStream(file);
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
        log.info('playback.started', {
            playbackId,
            guildId: voiceChannel.guildId,
            channelId: voiceChannel.id,
            file,
        });

        let settled = false;
        const finish = (reason: string, failed = false): boolean => {
            if (settled) return false;
            settled = true;
            clearTimeout(timeout);
            const fields = {
                playbackId,
                reason,
                durationMs: Date.now() - startedAt,
                file,
            };
            if (failed) log.warn('playback.finished', fields);
            else log.info('playback.finished', fields);
            player.stop(true);
            audio.destroy();
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

        audio.on('error', (error) => {
            log.error('playback.file_error', {
                playbackId,
                file,
                ...errorFields(error),
            });
            finish('file_error', true);
        });

        connection.on('error', (error) => {
            log.error('playback.connection_error', {
                playbackId,
                ...errorFields(error),
            });
            finish('connection_error', true);
        });
        connection.subscribe(player);
        player.on(AudioPlayerStatus.Idle, () => finish('audio_player_idle'));
        player.on('error', (error) => {
            log.error('playback.player_error', {
                playbackId,
                ...errorFields(error),
            });
            finish('audio_player_error', true);
        });
        try {
            player.play(createAudioResource(audio, { inputType }));
        } catch (error) {
            log.error('playback.resource_error', {
                playbackId,
                file,
                ...errorFields(error),
            });
            finish('resource_error', true);
        }
    });

    return { completion, stop };
}
