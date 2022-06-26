import { Client, Message } from 'discord.js';
import { playOceanMan, sendMessageToTextChannel } from '../../actions/oceanman';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';

export class PlayOceanManHandler implements MessageHandler {
    public async handle(
        message: Message,
        client: Client,
        oceanCurse: OceanCurse
    ): Promise<boolean> {
        const { content, guild } = message;

        if (
            guild?.id === oceanCurse.defaultGuildId &&
            !message.author.bot &&
            content.toLowerCase().includes('ocean man')
        ) {
            await sendMessageToTextChannel(
                client,
                oceanCurse.defaultTextChannelId,
                'Deploying Ocean Man...'
            );
            playOceanMan(
                oceanCurse.defaultVoiceChannelId,
                oceanCurse.defaultGuildId,
                guild.voiceAdapterCreator
            );

            return true;
        }

        return false;
    }
}
