import { EndBehaviorType, joinVoiceChannel } from '@discordjs/voice';
import { VoiceChannel } from 'discord.js';
import { wait } from '../utils';
import prism from 'prism-media';
import fs from 'fs';
import path from 'path';
import { Porcupine } from '@picovoice/porcupine-node';
import { playOceanMan } from './oceanman';
import { OceanCurse } from '../bots/oceancurse';

const accessKey = process.env['PICOVOICE_ACCESS_KEY']!!;
const modelsDir = path.resolve(process.cwd(), 'models');
const modelsFiles = fs
    .readdirSync(modelsDir)
    .map((file) => path.resolve(modelsDir, file));

console.log('*** Model files ***');
console.log(modelsFiles);

const handle = new Porcupine(
    accessKey,
    modelsFiles,
    modelsFiles.map(() => 1)
);

export async function joinAndListen(
    voiceChannel: VoiceChannel,
    cursedMemberId: string,
    oceanCurse: OceanCurse
) {
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: voiceChannel.guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: false,
    });

    const timeout = setTimeout(
        async () => {
            while (voiceChannel.members.has(cursedMemberId)) {
                await wait(10 * 1000);
            }

            try {
                connection.destroy();
            } catch (e) {
                console.error(e);
            }
        },
        5 * 60 * 1000 // 5 minutes
    );
    const { receiver } = connection;

    let found = false;
    const userToBuffer = new Map<string, any[]>();
    receiver.speaking.setMaxListeners(25).on('start', async (userId) => {
        if (
            found ||
            receiver.subscriptions.get(userId)?.readableEnded === false
        ) {
            return;
        }

        const decoder = new prism.opus.Decoder({
            frameSize: 512,
            channels: 1,
            rate: handle.sampleRate,
        });

        /** 1 frame is 512 samples, and 1 second is 16k samples
         *  so 31.25 frames per second
         */

        /** Number of frames to consider at a time for Porcupine processing */
        const frameBuffer = 30;
        /** Number of frames to jump forward if no hotword found. <= buffer */
        const frameJump = 30;

        const sub = receiver
            .subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 1000,
                },
            })
            .on('error', console.error)
            .pipe(decoder);

        async function processFrames(buffer: any[]) {
            for (
                let i = handle.frameLength;
                i < buffer.length;
                i += handle.frameLength
            ) {
                const result = handle.process(
                    new Int16Array(buffer.slice(i - handle.frameLength, i))
                );
                if (result != -1) {
                    found = true;
                    const word = modelsFiles[result]!.match(
                        /models\\(.*)_en_windows/
                    )?.[1]?.replace('-', ' ');
                    connection.destroy();
                    receiver.speaking.removeAllListeners();
                    sub.destroy();
                    clearTimeout(timeout);
                    const user = await oceanCurse.client.users.fetch(userId);
                    await oceanCurse.sendToDefaultTextChannel(
                        `I heard ${user.displayName} say ${
                            word ? `"${word}"` : 'my name'
                        }, deploying OceanCurse`
                    );
                    await playOceanMan(voiceChannel);
                    return;
                }
            }
        }

        sub.on('close', async () => {
            await processFrames(userToBuffer.get(userId) ?? []);
            userToBuffer.set(userId, []);
        });

        for await (const data of decoder) {
            if (found) return;

            const buffer = userToBuffer.get(userId) ?? [];
            buffer.push(...bufferToInt16(data));
            const limit = handle.frameLength * frameBuffer;

            if (buffer.length > limit) {
                await processFrames(buffer.slice(0, limit));

                userToBuffer.set(
                    userId,
                    buffer.slice(frameJump * handle.frameLength)
                );
            } else {
                userToBuffer.set(userId, buffer);
            }
        }
    });
}

function bufferToInt16(buffer: Buffer) {
    const result = Array(buffer.length / 2);
    for (let i = 0; i < buffer.length; i += 2) {
        result[i / 2] = buffer.readInt16LE(i);
    }
    return result;
}
