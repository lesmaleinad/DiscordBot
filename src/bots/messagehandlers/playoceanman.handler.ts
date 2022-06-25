import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
} from '@discordjs/voice';
import {
    Client,
    InternalDiscordGatewayAdapterCreator,
    Message,
} from 'discord.js';
import ytdl from 'ytdl-core';
import { channelIsTextChannel, fetchChannel } from '../../validators/channel';
import { getRandomMan } from '../../videos/getrandomman';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';

export class PlayOceanManHandler extends MessageHandler {
    private async textOceanManAlert(
        client: Client,
        channelId: string,
        message: string = 'Deploying Ocean Man..'
    ) {
        const botSoup = await fetchChannel(
            client,
            channelId,
            channelIsTextChannel
        );
        botSoup.send(message);
    }

    private playOceanMan(
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

    public async handle(
        message: Message,
        client: Client,
        oceanCurse: OceanCurse
    ): Promise<boolean> {
        const { content, guild } = message;

        if (
            guild?.id === oceanCurse.defaultGuildId &&
            !message.author.bot &&
            content.includes('ocean man')
        ) {
            await this.textOceanManAlert(
                client,
                oceanCurse.defaultTextChannelId
            );
            this.playOceanMan(
                oceanCurse.defaultVoiceChannelId,
                oceanCurse.defaultGuildId,
                guild.voiceAdapterCreator
            );

            return true;
        }

        return false;
    }
}
