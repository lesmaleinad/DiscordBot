import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
} from '@discordjs/voice';
import { Client, VoiceChannel } from 'discord.js';
import ytdl from 'ytdl-core';
import { fetchChannel, channelIsTextChannel } from '../validators/channel';
import { getRandomMan } from '../videos/getrandomman';

export async function sendMessageToTextChannel(
    client: Client,
    channelId: string,
    message: string
) {
    const channel = await fetchChannel(client, channelId, channelIsTextChannel);
    return channel.send(message);
}

export function playOceanMan(voiceChannel: VoiceChannel) {
    return new Promise<void>((resolve) => {
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        const timeout = setTimeout(
            () => {
                try {
                    console.error('Timed out after 10 minutes');
                    connection.destroy();
                } catch (e) {
                    console.log(e);
                } finally {
                    resolve();
                }
            },
            10 * 60 * 1000
        );

        try {
            const player = createAudioPlayer();
            connection.subscribe(player);

            const link = getRandomMan();
            const stream = ytdl(link, {
                highWaterMark: 1024 * 1024 * 10,
                filter: 'audio',
            });
            const resource = createAudioResource(stream);
            player.play(resource);

            player.on(AudioPlayerStatus.Idle, () => {
                try {
                    clearTimeout(timeout);
                    connection.destroy();
                } catch (e) {
                    console.log(e);
                } finally {
                    resolve();
                }
            });

            player.on('error', (e) => {
                console.error('LINK: ' + link);
                console.error(e);
                clearTimeout(timeout);
                connection.destroy();
                resolve();
            });
        } catch (e) {
            console.error(e);
            clearTimeout(timeout);
            connection.destroy();
            resolve();
        }
    });
}
