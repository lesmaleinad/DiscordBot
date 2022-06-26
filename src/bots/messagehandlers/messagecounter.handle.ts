import { Message } from 'discord.js';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';

export class MessageCounterHandler implements MessageHandler {
    private count = 0;

    public async handle(message: Message<boolean>, oceanCurse: OceanCurse) {
        if (message.member && !message.author.bot) {
            this.count++;
            if (this.count % 300 === 0) {
                await oceanCurse.sendToDefaultTextChannel(
                    `${message.member.displayName} sent the 300th message! Deploying Ocean Man!`
                );
                oceanCurse.playOceanMan();
            }
        }

        if (message.content.toLowerCase() === 'ocean count') {
            oceanCurse.sendToDefaultTextChannel(
                `I have counted ${this.count} messages.`
            );
        }

        return false;
    }
}
