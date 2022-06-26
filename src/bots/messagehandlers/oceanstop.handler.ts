import { getVoiceConnection } from '@discordjs/voice';
import { Message, Client } from 'discord.js';
import { playOceanMan } from '../../actions/oceanman';
import { FlyGuy, Magnat } from '../../ids';
import { wait } from '../../utils';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';

export class OceanStopHandler implements MessageHandler {
    public async handle(
        message: Message,
        client: Client,
        oceanCurse: OceanCurse
    ): Promise<boolean> {
        if (
            client.user &&
            message.guild &&
            message.channelId === oceanCurse.defaultTextChannelId &&
            message.content === 'ocean stop'
        ) {
            switch (message.author.id) {
                case Magnat:
                    const voiceConnection = getVoiceConnection(
                        oceanCurse.defaultGuildId
                    );

                    if (voiceConnection) {
                        voiceConnection.destroy();
                        message.channel.send(':ok_hand:');
                    }
                    break;
                case FlyGuy:
                    await message.reply('no');
                    await wait(10 * 1000);
                    await oceanCurse.sendToDefaultTextChannel(
                        'In fact, just because you asked'
                    );
                    playOceanMan(
                        oceanCurse.defaultVoiceChannelId,
                        oceanCurse.defaultGuildId,
                        message.guild.voiceAdapterCreator
                    );
                    break;
                default:
                    message.reply('no');
            }
            return true;
        }
        return false;
    }
}
