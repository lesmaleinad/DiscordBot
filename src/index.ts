import { joinVoiceChannel } from '@discordjs/voice';
import { Client, Intents } from 'discord.js';
import { config } from 'dotenv';
import { BotPlayground } from './ids';

config();

const client = new Client({
    intents: [Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILDS],
});

client.on('ready', (loggedInClient) => {
    console.log(`Connected as ${loggedInClient.user.username}`);
});

client.on('messageCreate', async (message) => {
    const { content, channelId, guild } = message;

    console.debug(message);

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
        });

        setTimeout(() => {
            connection.destroy();
        }, 5000);
    }
});

client.login(process.env['DISCORD_CLIENT_KEY']);
