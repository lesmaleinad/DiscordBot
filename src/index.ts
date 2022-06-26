import { generateDependencyReport } from '@discordjs/voice';
import { Client, Intents, Message, VoiceState } from 'discord.js';
import { config } from 'dotenv';
import { exit } from 'process';
import { OceanCurseHandler } from './bots/messagehandlers/oceancurse.handler';
import { PlayOceanManHandler } from './bots/messagehandlers/playoceanman.handler';
import { OceanCurse } from './bots/oceancurse';
import { Daniel } from './ids';

config();

const client = new Client({
    intents: [
        Intents.FLAGS.GUILD_EMOJIS_AND_STICKERS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_VOICE_STATES,
        Intents.FLAGS.GUILDS,
    ],
});

const oceanCurseHandler = new OceanCurseHandler(Daniel);

const oceanCurse = new OceanCurse(
    client,
    [new PlayOceanManHandler(), oceanCurseHandler],
    [oceanCurseHandler],
    !!process.env['STAGING']
);

client.on('ready', (loggedInClient) => {
    console.log(`Connected as ${loggedInClient.user.username}`);
    console.log(generateDependencyReport());
});

client.on('voiceStateUpdate', (oldState: VoiceState, newState: VoiceState) =>
    oceanCurse.onVoiceStateChange(oldState, newState)
);
client.on('messageCreate', (message: Message) => oceanCurse.onMessage(message));

process.on('SIGTERM', () => {
    client.destroy();
    exit(0);
});

async function main() {
    try {
        await client.login(process.env['DISCORD_CLIENT_KEY']);
    } catch (e) {
        console.error('Failed to start up');
        console.error(e);
    }
}

main();
