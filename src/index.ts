import {
    Client,
    Events,
    IntentsBitField,
    Message,
    VoiceState,
} from 'discord.js';
import { exit } from 'process';
import { OceanCurseHandler } from './bots/messagehandlers/oceancurse.handler';
import { OceanStopHandler } from './bots/messagehandlers/oceanstop.handler';
import { OceanReleaseHandler } from './bots/messagehandlers/oceanrelease.handler';
import { PlayOceanManHandler } from './bots/messagehandlers/playoceanman.handler';
import { OceanCurse } from './bots/oceancurse';
import { ThankYouReplyHandler } from './bots/messagehandlers/thankyoureply.handler';
import { booleanEnvironment, secretEnvironment } from './environment';
import { startHealthHeartbeat } from './health';
import { errorFields, log } from './diagnostics';

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
const thankYouHandler = new ThankYouReplyHandler();
let stopHealthHeartbeat: (() => void) | undefined;
let stopCurseLeaseMonitor: (() => void) | undefined;
const staging =
    process.argv.includes('--staging') || booleanEnvironment('STAGING');

const oceanCurse = new OceanCurse(
    client,
    [
        thankYouHandler,
        new PlayOceanManHandler(thankYouHandler),
        new OceanReleaseHandler(oceanCurseHandler),
        oceanCurseHandler,
        new OceanStopHandler(),
    ],
    [oceanCurseHandler],
    staging
);

client.on(Events.ClientReady, async (loggedInClient) => {
    log.info('discord.ready', {
        userId: loggedInClient.user.id,
        username: loggedInClient.user.username,
        guildCount: loggedInClient.guilds.cache.size,
        staging,
    });
    stopHealthHeartbeat?.();
    stopHealthHeartbeat = startHealthHeartbeat(client);
    try {
        stopCurseLeaseMonitor?.();
        stopCurseLeaseMonitor =
            await oceanCurseHandler.startLeaseMonitor(oceanCurse);
        await oceanCurseHandler.reconcileVoiceState(oceanCurse);
    } catch (error) {
        log.error('listener.reconcile_failed', errorFields(error));
    }
});

client.on(
    Events.VoiceStateUpdate,
    async (oldState: VoiceState, newState: VoiceState) => {
        await oceanCurse.onVoiceStateChange(oldState, newState);
    }
);
client.on(Events.MessageCreate, async (message: Message) => {
    await oceanCurse.onMessage(message);
});
client.on(Events.Error, (error) => {
    log.error('discord.client_error', errorFields(error));
});
client.on(Events.ShardDisconnect, (event, shardId) => {
    log.warn('discord.shard_disconnected', {
        shardId,
        closeCode: event.code,
        reason: event.reason || undefined,
    });
});
client.on(Events.ShardReconnecting, (shardId) => {
    log.warn('discord.shard_reconnecting', { shardId });
});
client.on(Events.ShardResume, (shardId, replayedEvents) => {
    log.info('discord.shard_resumed', { shardId, replayedEvents });
});

function shutDown(signal: string) {
    log.info('app.stopping', { signal });
    stopCurseLeaseMonitor?.();
    stopHealthHeartbeat?.();
    client.destroy();
    exit(0);
}

process.on('SIGTERM', () => shutDown('SIGTERM'));
process.on('SIGINT', () => shutDown('SIGINT'));

async function main() {
    log.info('app.starting', {
        staging,
        nodeVersion: process.version,
        pid: process.pid,
    });
    try {
        await client.login(
            secretEnvironment('DISCORD_CLIENT_KEY', 'DISCORD_TOKEN_FILE')
        );
    } catch (e) {
        log.error('app.start_failed', errorFields(e));
        process.exitCode = 1;
    }
}

main();
