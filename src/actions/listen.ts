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
    receiver.speaking.setMaxListeners(25).on('start', async (userId) => {
        if (
            found ||
            receiver.subscriptions.get(userId)?.readableEnded === false
        ) {
            return;
        }

        const handle = new Porcupine(
            accessKey,
            modelsFiles,
            modelsFiles.map(() => 1)
        );

        const decoder = new prism.opus.Decoder({
            frameSize: handle.frameLength,
            channels: 1,
            rate: handle.sampleRate,
        });

        /** 1 frame is 512 samples, and 1 second is 16k samples
         *  so 31.25 frames per second
         */

        /** Number of frames to consider at a time for Porcupine processing */
        const frameBuffer = 1;
        /** Number of frames to jump forward if no hotword found. <= buffer */
        const frameJump = 1;

        const sub = receiver
            .subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 500,
                },
            })
            .on('error', console.error)
            .pipe(decoder);

        let buf: number[] = [];
        for await (const data of sub) {
            if (found) return;
            buf.push(...bufferToInt16(data));
            const limit = handle.frameLength * frameBuffer;
            if (buf.length > limit) {
                for (let i = 0; i < limit; i += handle.frameLength) {
                    const result = handle.process(
                        new Int16Array(buf.slice(i, i + handle.frameLength))
                    );
                    if (result != -1) {
                        found = true;
                        connection.destroy();
                        receiver.speaking.removeAllListeners();
                        sub.destroy();
                        clearTimeout(timeout);
                        const user =
                            await oceanCurse.client.users.fetch(userId);
                        await oceanCurse.sendToDefaultTextChannel(
                            `I heard ${user.displayName} say my name, deploying OceanCurse`
                        );
                        await playOceanMan(voiceChannel);
                        return;
                    }
                }

                buf = buf.slice(frameJump * handle.frameLength);
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
