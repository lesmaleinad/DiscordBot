import { generateDependencyReport } from '@discordjs/voice';
import { Client, IntentsBitField, Message, VoiceState } from 'discord.js';
import { config } from 'dotenv';
import { exit } from 'process';
import { MessageCounterHandler } from './bots/messagehandlers/messagecounter.handle';
import { OceanCurseHandler } from './bots/messagehandlers/oceancurse.handler';
import { OceanStopHandler } from './bots/messagehandlers/oceanstop.handler';
import { PlayOceanManHandler } from './bots/messagehandlers/playoceanman.handler';
import { OceanCurse } from './bots/oceancurse';

config();

const client = new Client({
    intents: [
        IntentsBitField.Flags.GuildEmojisAndStickers,
        IntentsBitField.Flags.GuildMessageReactions,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildVoiceStates,
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.MessageContent,
    ],
});

const oceanCurseHandler = new OceanCurseHandler();

const oceanCurse = new OceanCurse(
    client,
    [
        new MessageCounterHandler(),
        new PlayOceanManHandler(),
        oceanCurseHandler,
        new OceanStopHandler(),
    ],
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
