import { Message } from 'discord.js';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';

export class PlayOceanManHandler implements MessageHandler {
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

            return true;
        }

        return false;
    }
}
