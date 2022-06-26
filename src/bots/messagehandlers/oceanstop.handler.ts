import { getVoiceConnection } from '@discordjs/voice';
import { Message } from 'discord.js';
import { FlyGuy, Magnat } from '../../ids';
import { wait } from '../../utils';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';

export class OceanStopHandler implements MessageHandler {
    public async handle(
        message: Message,
        oceanCurse: OceanCurse
    ): Promise<boolean> {
        if (
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
                    oceanCurse.playOceanMan();
                    break;
                default:
                    message.reply('no');
            }
            return true;
        }
        return false;
    }
}
