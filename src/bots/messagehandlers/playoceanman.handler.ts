import { Message } from 'discord.js';
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
            await oceanCurse.sendToDefaultTextChannel('Deploying Ocean Man...');
            oceanCurse.playOceanMan();
            this.thankYouHandler.expectThanks(message.author, oceanCurse);

            return true;
        }

        return false;
    }
}
