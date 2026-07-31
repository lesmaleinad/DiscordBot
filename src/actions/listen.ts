import { EndBehaviorType, joinVoiceChannel } from '@discordjs/voice';
import { VoiceChannel } from 'discord.js';
import prism from 'prism-media';
import { wait } from '../utils';
import { OceanCurse } from '../bots/oceancurse';
import { errorFields, log } from '../diagnostics';
import { OceanManKeywordSpotter } from './keywordspotter';

const keywordSpotter = new OceanManKeywordSpotter();

export type StopListener = (reason: string) => void;

export function joinAndListen(
    voiceChannel: VoiceChannel,
    cursedMemberId: string,
    oceanCurse: OceanCurse
): StopListener {
    const startedAt = Date.now();
    log.info('listener.started', {
        guildId: voiceChannel.guildId,
        channelId: voiceChannel.id,
        cursedMemberId,
    });
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    let found = false;
    let stopped = false;
    const stopListener = (reason: string) => {
        if (stopped) return;
        stopped = true;
        clearTimeout(timeout);
        receiver.speaking.removeAllListeners();
        try {
            connection.destroy();
        } catch (error) {
            log.warn('listener.disconnect_failed', {
                reason,
                ...errorFields(error),
            });
        }
        log.info('listener.stopped', {
            reason,
            channelId: voiceChannel.id,
            cursedMemberId,
            durationMs: Date.now() - startedAt,
        });
    };

    const timeout = setTimeout(
        async () => {
            while (voiceChannel.members.has(cursedMemberId)) {
                await wait(10 * 1000);
            }
            stopListener('cursed_member_left');
        },
        5 * 60 * 1000
    );

    const { receiver } = connection;
    connection.on('error', (error) => {
        log.error('listener.connection_error', {
            channelId: voiceChannel.id,
            ...errorFields(error),
        });
    });

    const deployCurse = async (userId: string, keyword: string) => {
        if (found) return;
        found = true;
        clearTimeout(timeout);
        log.info('keyword.detected', {
            userId,
            keyword,
            channelId: voiceChannel.id,
        });
        stopListener('keyword_detected');

        const user = await oceanCurse.client.users.fetch(userId);
        const phrase = keyword.replaceAll('_', ' ').toLowerCase();
        await oceanCurse.sendToDefaultTextChannel(
            `I heard ${user.displayName} say "${phrase}", deploying OceanCurse`
        );
        await oceanCurse.playOceanMan(voiceChannel);
    };

    const listenToSpeaker = async (userId: string) => {
        if (
            found ||
            receiver.subscriptions.get(userId)?.readableEnded === false
        ) {
            return;
        }

        const stream = keywordSpotter.createStream();
        const decoder = new prism.opus.Decoder({
            frameSize: 320,
            channels: 1,
            rate: 16_000,
        });
        const subscription = receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 1000,
            },
        });

        subscription.on('error', (error) => {
            log.warn('listener.subscription_error', {
                userId,
                ...errorFields(error),
            });
        });
        decoder.on('error', (error) => {
            log.warn('listener.decoder_error', {
                userId,
                ...errorFields(error),
            });
        });
        subscription.pipe(decoder);

        try {
            for await (const data of decoder as unknown as AsyncIterable<Buffer>) {
                if (found) return;
                const keyword = keywordSpotter.acceptPcm(stream, data);
                if (keyword) {
                    subscription.destroy();
                    await deployCurse(userId, keyword);
                    return;
                }
            }

            if (!found) {
                const keyword = keywordSpotter.finish(stream);
                if (keyword) await deployCurse(userId, keyword);
            }
        } catch (error) {
            log.error('listener.stream_error', {
                userId,
                ...errorFields(error),
            });
        }
    };

    receiver.speaking.setMaxListeners(25).on('start', async (userId) => {
        await listenToSpeaker(userId);
    });

    return stopListener;
}
