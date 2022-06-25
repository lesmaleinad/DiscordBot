import {
    AudioPlayerStatus,
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
    generateDependencyReport,
} from '@discordjs/voice';
import { Client, Intents } from 'discord.js';
import { config } from 'dotenv';
import { exit } from 'process';
import ytdl from 'ytdl-core';
import { BotPlayground } from './ids';
import { getRandomMan } from './videos/getrandomman';

config();

const client = new Client({
    intents: [
        Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILDS,
    ],
});

client.on('ready', (loggedInClient) => {
    console.log(`Connected as ${loggedInClient.user.username}`);
    console.log(generateDependencyReport());
});

client.on('messageCreate', async (message) => {
    const { content, channelId, guild } = message;

    if (
        guild &&
        guild.id == BotPlayground.Guild &&
        channelId === BotPlayground.General.Text &&
        content == 'join'
    ) {
        const connection = joinVoiceChannel({
            channelId: BotPlayground.General.Voice,
            guildId: BotPlayground.Guild,
            adapterCreator: guild.voiceAdapterCreator,
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
});

client.login(process.env['DISCORD_CLIENT_KEY']);

process.on('SIGTERM', () => {
    client.destroy();
    exit(0);
});
