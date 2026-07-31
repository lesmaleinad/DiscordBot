import { ChannelType, Message } from 'discord.js';
import { FlyGuy, Magnat } from '../../ids';
import { wait } from '../../utils';
import { log } from '../../diagnostics';
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
            message.content.toLowerCase() === 'ocean stop'
        ) {
            switch (message.author.id) {
                case Magnat:
                    if (oceanCurse.stopActivePlayback(message.author.id)) {
                        await oceanCurse.sendToDefaultTextChannel(':ok_hand:');
                    }
                    break;
                case FlyGuy:
                    log.info('listener.stop_rejected', {
                        requestedBy: message.author.id,
                        response: 'retaliation',
                    });
                    await message.reply('no');
                    await wait(10 * 1000);
                    await oceanCurse.sendToDefaultTextChannel(
                        'In fact, just because you asked'
                    );
                    await oceanCurse.playOceanMan(
                        message.member?.voice.channel?.type ===
                            ChannelType.GuildVoice
                            ? message.member.voice.channel
                            : undefined
                    );
                    break;
                default:
                    log.info('listener.stop_rejected', {
                        requestedBy: message.author.id,
                        response: 'denied',
                    });
                    await message.reply('no');
            }
            return true;
        }
        return false;
    }
}
