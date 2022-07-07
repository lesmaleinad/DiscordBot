import { Client, Message, VoiceChannel, VoiceState } from 'discord.js';
import { playOceanMan, sendMessageToTextChannel } from '../actions/oceanman';
import { BotPlayground, GameNight } from '../ids';
import { channelIsVoiceChannel, fetchChannel } from '../validators/channel';
import { MessageHandler } from './messagehandler.base';
import { VoiceStateHandler } from './voicestatehandler';

export class OceanCurse {
    constructor(
        private readonly client: Client,
        private readonly messageHandlers: MessageHandler[],
        private readonly voiceStateHandlers: VoiceStateHandler[],
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
        try {
            for (const messageHandler of this.messageHandlers) {
                const shouldTerminate = messageHandler.handle(message, this);
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
        } catch (e) {
            console.error(e);
        }
    }

    public async onVoiceStateChange(
        oldState: VoiceState,
        newState: VoiceState
    ) {
        try {
            for (const handler of this.voiceStateHandlers) {
                const shouldTerminate = handler.handleVoiceChange(
                    oldState,
                    newState,
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
        } catch (e) {
            console.error(e);
        }
    }

    public async getDefaultVoiceChannel(): Promise<VoiceChannel> {
        return fetchChannel(
            this.client,
            this.defaultVoiceChannelId,
            channelIsVoiceChannel
        );
    }

    public async playOceanMan() {
        const voiceChannel = await this.getDefaultVoiceChannel();
        return playOceanMan(
            voiceChannel.id,
            voiceChannel.guildId,
            voiceChannel.guild.voiceAdapterCreator
        );
    }

    public async sendToDefaultTextChannel(text: string) {
        return sendMessageToTextChannel(
            this.client,
            this.defaultTextChannelId,
            text
        );
    }
}
