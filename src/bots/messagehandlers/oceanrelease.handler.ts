import { Message } from 'discord.js';
import { log } from '../../diagnostics';
import { Daniel } from '../../ids';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';
import { OceanCurseHandler } from './oceancurse.handler';

export class OceanReleaseHandler implements MessageHandler {
    public constructor(private readonly curseHandler: OceanCurseHandler) {}

    public async handle(
        message: Message,
        oceanCurse: OceanCurse
    ): Promise<boolean> {
        if (
            !message.guild ||
            message.channelId !== oceanCurse.defaultTextChannelId ||
            message.content.toLowerCase() !== 'ocean release'
        ) {
            return false;
        }

        if (message.author.id !== Daniel) {
            log.info('curse.release_rejected', {
                requestedBy: message.author.id,
                reason: 'not_owner',
            });
            await message.reply('no');
            return true;
        }

        const released = await this.curseHandler.releaseCurse(
            oceanCurse,
            'command',
            message.author.id
        );
        if (!released) {
            await message.reply('The curse is already loose.');
        }
        return true;
    }
}
