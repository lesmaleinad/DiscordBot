import { ChannelType, Message } from 'discord.js';
import { log } from '../../diagnostics';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';
import { ThankYouReplyHandler } from './thankyoureply.handler';

export class PlayOceanManHandler implements MessageHandler {
    constructor(private readonly thankYouHandler: ThankYouReplyHandler) {}

    public async handle(
        message: Message,
        oceanCurse: OceanCurse
    ): Promise<boolean> {
        const { content, guild } = message;

        if (
            guild?.id === oceanCurse.defaultGuildId &&
            !message.author.bot &&
            content.toLowerCase().includes('ocean man')
        ) {
            log.info('playback.requested', {
                requestedBy: message.author.id,
                channelId: message.channelId,
            });
            await oceanCurse.sendToDefaultTextChannel('Deploying Ocean Man...');
            await oceanCurse.playOceanMan(
                message.member?.voice.channel?.type === ChannelType.GuildVoice
                    ? message.member.voice.channel
                    : undefined
            );
            this.thankYouHandler.expectThanks(message.author, oceanCurse);

            return true;
        }

        return false;
    }
}
