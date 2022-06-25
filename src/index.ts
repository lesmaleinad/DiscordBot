import { generateDependencyReport } from '@discordjs/voice';
import { Client, Intents } from 'discord.js';
import { config } from 'dotenv';
import fastify from 'fastify';
import { exit } from 'process';
import { PlayOceanManHandler } from './bots/messagehandlers/playoceanman.handler';
import { OceanCurse } from './bots/oceancurse';

config();

const client = new Client({
    intents: [
        Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILDS,
    ],
});

const oceanCurse = new OceanCurse(
    client,
    [new PlayOceanManHandler()],
    !!process.env['STAGING']
);

client.on('ready', (loggedInClient) => {
    console.log(`Connected as ${loggedInClient.user.username}`);
    console.log(generateDependencyReport());
});

client.on('messageCreate', async (message) => {
    oceanCurse.onMessage(message);
});

client.login(process.env['DISCORD_CLIENT_KEY']);
process.on('SIGTERM', () => {
    client.destroy();
    exit(0);
});

const server = fastify();
server.get('*', () => {
    return 'Server online!';
});

const port = process.env['PORT'] && parseInt(process.env['PORT']);
server.listen({ port: port || 8000 });
