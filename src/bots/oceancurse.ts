import { Client, Message } from 'discord.js';
import { BotPlayground, GameNight } from '../ids';
import { MessageHandler } from './messagehandler.base';

export class OceanCurse {
    constructor(
        private readonly client: Client,
        private readonly handlers: MessageHandler[],
        private readonly staging: boolean = false
    ) {}

    public readonly defaultGuildId: string = this.staging
        ? BotPlayground.Guild
        : GameNight.Guild;
    public readonly defaultVoiceChannelId: string = this.staging
        ? BotPlayground.General.Voice
        : GameNight.General.Voice;
    public readonly defaultTextChannelId: string = this.staging
        ? BotPlayground.General.Text
        : GameNight.BotSoup.Text;

    public async onMessage(message: Message) {
        for (const messageHandler of this.handlers) {
            const shouldTerminate = messageHandler.handle(
                message,
                this.client,
                this
            );
            if (typeof shouldTerminate === 'boolean') {
                if (shouldTerminate) {
                    break;
                }
            } else {
                if (await shouldTerminate) {
                    break;
                }
            }
        }
    }
}
