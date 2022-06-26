import { Message, Client } from 'discord.js';
import { playOceanMan, sendMessageToTextChannel } from '../../actions/oceanman';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';

export class MessageCounterHandler implements MessageHandler {
    private count = 0;

    public async handle(
        message: Message<boolean>,
        client: Client<boolean>,
        oceanCurse: OceanCurse
    ) {
        if (message.member && !message.author.bot) {
            this.count++;
            if (this.count % 300 === 0) {
                sendMessageToTextChannel(
                    client,
                    oceanCurse.defaultTextChannelId,
                    `${message.member.displayName} sent the 300th message! Deploying Ocean Man!`
                );
                playOceanMan(
                    oceanCurse.defaultVoiceChannelId,
                    oceanCurse.defaultGuildId,
                    message.member.guild.voiceAdapterCreator
                );
            }
        }

        return false;
    }
}
