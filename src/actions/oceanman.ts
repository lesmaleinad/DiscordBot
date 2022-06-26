import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
} from '@discordjs/voice';
import { Client, InternalDiscordGatewayAdapterCreator } from 'discord.js';
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

export function playOceanMan(
    channelId: string,
    guildId: string,
    adapter: InternalDiscordGatewayAdapterCreator
) {
    const connection = joinVoiceChannel({
        channelId: channelId,
        guildId: guildId,
        adapterCreator: adapter,
        selfDeaf: false,
    });
    const timeout = setTimeout(() => {
        try {
            console.log('Timed out after 10 minutes');
            connection.destroy();
        } catch (e) {
            console.log(e);
        }
    }, 10 * 60 * 1000);

    try {
        const player = createAudioPlayer();
        player.on('error', (e) => {
            console.error(e);
        });
        connection.subscribe(player);

        const link = getRandomMan();
        const stream = ytdl(link, {
            highWaterMark: 1024 * 1024 * 10,
            filter: 'audioonly',
            quality: 'lowestaudio',
        });
        const resource = createAudioResource(stream);
        player.play(resource);

        player.on(AudioPlayerStatus.Idle, () => {
            try {
                clearTimeout(timeout);
                connection.destroy();
            } catch (e) {
                console.log(e);
            }
        });
    } catch (e) {
        console.error(e);
        clearTimeout(timeout);
        connection.destroy();
    }
}
