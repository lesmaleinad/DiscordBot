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
    receiver.speaking.setMaxListeners(25).on('start', async (userId) => {
        if (found) return;

        const decoder = new prism.opus.Decoder({
            frameSize: handle.frameLength,
            channels: 1,
            rate: handle.sampleRate,
        });

        // creates a readable stream of opus packets from user voice
        const sub = receiver
            .subscribe(userId, {
                end: {
                    behavior: EndBehaviorType.AfterSilence,
                    duration: 500,
                },
            })
            .setMaxListeners(50)
            .on('error', console.error)
            .pipe(decoder);

        let arr: any[] = [];
        for await (const data of sub) {
            if (found) return;
            arr.push(...bufferToInt16(data));
            if (arr.length > handle.frameLength) {
                const result = handle.process(
                    new Int16Array(arr.slice(0, handle.frameLength))
                );
                if (result != -1) {
                    found = true;
                    connection.destroy();
                    receiver.speaking.removeAllListeners();
                    sub.destroy();
                    clearTimeout(timeout);
                    const user = await oceanCurse.client.users.fetch(userId);
                    await oceanCurse.sendToDefaultTextChannel(
                        `I heard ${user.displayName} say my name, deploying OceanCurse`
                    );
                    await playOceanMan(voiceChannel);
                    return;
                }

                arr = arr.slice(handle.frameLength);
            }
        }
    });
}

function bufferToInt16(buffer: Buffer) {
    const int16Array = [];

    for (let i = 0; i < buffer.length; i += 2) {
        int16Array.push(buffer.readInt16LE(i));
    }

    return int16Array;
}
