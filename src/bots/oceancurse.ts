import { joinVoiceChannel } from '@discordjs/voice';
import { Client, Message, VoiceChannel, VoiceState } from 'discord.js';
import {
    PlaybackSession,
    playOceanMan,
    sendMessageToTextChannel,
} from '../actions/oceanman';
import { BotPlayground, GameNight } from '../ids';
import { channelIsVoiceChannel, fetchChannel } from '../validators/channel';
import { errorFields, log } from '../diagnostics';
import { MessageHandler } from './messagehandler.base';
import { VoiceStateHandler } from './voicestatehandler';

export class OceanCurse {
    private activePlayback: PlaybackSession | undefined;
    private activePlaybackChannelId: string | undefined;

    constructor(
        public readonly client: Client,
        private readonly messageHandlers: MessageHandler[],
        private readonly voiceStateHandlers: VoiceStateHandler[],
        private readonly staging: boolean = false
    ) {}

    public get defaultGuildId(): string {
        return this.staging ? BotPlayground.Guild : GameNight.Guild;
    }

    public get defaultVoiceChannelId(): string {
        return this.staging
            ? BotPlayground.General.Voice
            : GameNight.General.Voice;
    }

    public get defaultTextChannelId(): string {
        return this.staging
            ? BotPlayground.General.Text
            : GameNight.BotSoup.Text;
    }

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
            log.error('message.handler_error', {
                messageId: message.id,
                channelId: message.channelId,
                ...errorFields(e),
            });
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
            log.error('voice_state.handler_error', {
                userId: newState.id,
                oldChannelId: oldState.channelId,
                newChannelId: newState.channelId,
                ...errorFields(e),
            });
        }
    }

    public async getDefaultVoiceChannel(): Promise<VoiceChannel> {
        return fetchChannel(
            this.client,
            this.defaultVoiceChannelId,
            channelIsVoiceChannel
        );
    }

    public async playOceanMan(voiceChannel?: VoiceChannel) {
        if (this.activePlayback) {
            log.info('playback.request_coalesced', {
                activeChannelId: this.activePlaybackChannelId,
                requestedChannelId: voiceChannel?.id,
            });
            await this.activePlayback.completion;
            return;
        }

        const targetVoiceChannel =
            voiceChannel ?? (await this.getDefaultVoiceChannel());
        const playback = playOceanMan(targetVoiceChannel);
        this.activePlayback = playback;
        this.activePlaybackChannelId = targetVoiceChannel.id;

        try {
            await playback.completion;
        } finally {
            if (this.activePlayback === playback) {
                this.activePlayback = undefined;
                this.activePlaybackChannelId = undefined;
            }
        }
    }

    public get isPlaying(): boolean {
        return this.activePlayback !== undefined;
    }

    public stopActivePlayback(requestedBy: string): boolean {
        const stopped =
            this.activePlayback?.stop('stopped_by_command') ?? false;
        log.info('playback.stop_requested', { requestedBy, stopped });
        return stopped;
    }

    public moveActivePlayback(voiceChannel: VoiceChannel): boolean {
        if (!this.activePlayback) return false;

        joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guildId,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false,
        });
        const previousChannelId = this.activePlaybackChannelId;
        this.activePlaybackChannelId = voiceChannel.id;
        log.info('playback.moved', {
            previousChannelId,
            channelId: voiceChannel.id,
        });
        return true;
    }

    public async sendToDefaultTextChannel(text: string) {
        return sendMessageToTextChannel(
            this.client,
            this.defaultTextChannelId,
            text
        );
    }
}
