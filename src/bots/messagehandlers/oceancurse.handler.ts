import { ChannelType, Message, VoiceState } from 'discord.js';
import { State, StateVar } from '../../actions/persistentence';
import { wait } from '../../utils';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';
import { VoiceStateHandler } from '../voicestatehandler';
import { joinAndListen, StopListener } from '../../actions/listen';
import { errorFields, log } from '../../diagnostics';
import { numberEnvironment } from '../../environment';

const curseTtlMinutes = numberEnvironment(
    'CURSE_TTL_MINUTES',
    numberEnvironment('CURSE_TTL_DAYS', 7) * 24 * 60
);
const curseTtlMs = curseTtlMinutes * 60 * 1000;
const leaseCheckIntervalMs = 60 * 1000;
if (curseTtlMinutes <= 0) {
    throw new Error('CURSE_TTL_MINUTES must be greater than zero');
}

export class OceanCurseHandler implements MessageHandler, VoiceStateHandler {
    private stopActiveListener: StopListener | undefined;

    private get cursedMemberId() {
        return State.getState(StateVar.CursedMemberId);
    }

    private get cursedAt() {
        return State.getState(StateVar.CursedAt);
    }

    private claimCurse(memberId: string, source: string): boolean {
        if (this.cursedMemberId !== null) return false;

        const cursedAt = new Date().toISOString();
        State.updateState({
            [StateVar.CursedMemberId]: memberId,
            [StateVar.CursedAt]: cursedAt,
            [StateVar.ReleasedAt]: null,
        });
        log.info('curse.claimed', {
            cursedMemberId: memberId,
            cursedAt,
            source,
        });
        return true;
    }

    private transferCurse(
        expectedMemberId: string,
        newMemberId: string
    ): string | undefined {
        if (this.cursedMemberId !== expectedMemberId) return undefined;

        const cursedAt = new Date().toISOString();
        State.updateState({
            [StateVar.CursedMemberId]: newMemberId,
            [StateVar.CursedAt]: cursedAt,
            [StateVar.ReleasedAt]: null,
        });
        return cursedAt;
    }

    public async startLeaseMonitor(
        oceanCurse: OceanCurse
    ): Promise<() => void> {
        await this.checkLeaseExpiration(oceanCurse);
        const interval = setInterval(async () => {
            try {
                await this.checkLeaseExpiration(oceanCurse);
            } catch (error) {
                log.error('curse.lease_check_failed', errorFields(error));
            }
        }, leaseCheckIntervalMs);
        interval.unref();
        return () => clearInterval(interval);
    }

    private async checkLeaseExpiration(oceanCurse: OceanCurse): Promise<void> {
        const cursedMemberId = this.cursedMemberId;
        const cursedAt = this.cursedAt;
        if (!cursedMemberId || !cursedAt) return;

        const expiresAt = Date.parse(cursedAt) + curseTtlMs;
        if (Date.now() < expiresAt) return;

        await this.releaseCurse(oceanCurse, 'expired');
    }

    public async releaseCurse(
        oceanCurse: OceanCurse,
        reason: 'expired' | 'command',
        requestedBy?: string
    ): Promise<boolean> {
        const cursedMemberId = this.cursedMemberId;
        const cursedAt = this.cursedAt;
        if (!cursedMemberId || !cursedAt) return false;

        const releasedAt = new Date().toISOString();
        State.updateState({
            [StateVar.CursedMemberId]: null,
            [StateVar.CursedAt]: null,
            [StateVar.ReleasedAt]: releasedAt,
        });
        if (this.stopActiveListener) {
            this.stopActiveListener('curse_released');
            this.stopActiveListener = undefined;
        }

        let displayName = `<@${cursedMemberId}>`;
        try {
            const guild = await oceanCurse.client.guilds.fetch(
                oceanCurse.defaultGuildId
            );
            displayName = (await guild.members.fetch(cursedMemberId))
                .displayName;
        } catch (error) {
            log.warn('curse.release_member_lookup_failed', {
                cursedMemberId,
                ...errorFields(error),
            });
        }

        log.info('curse.released', {
            cursedMemberId,
            cursedAt,
            releasedAt,
            reason,
            requestedBy,
        });
        await oceanCurse.sendToDefaultTextChannel(
            `**${displayName} is free. The curse is not.**`
        );
        return true;
    }

    public async reconcileVoiceState(
        oceanCurse: OceanCurse,
        reason: 'startup' | 'curse_transferred' = 'startup'
    ): Promise<void> {
        const cursedMemberId = this.cursedMemberId;
        if (!cursedMemberId) {
            if (this.stopActiveListener) {
                this.stopActiveListener('curse_unclaimed');
                this.stopActiveListener = undefined;
            }
            log.info('listener.reconciled', {
                reason,
                listening: false,
                suppressedBy: 'curse_unclaimed',
            });
            return;
        }

        const guild = await oceanCurse.client.guilds.fetch(
            oceanCurse.defaultGuildId
        );
        const cursedMember = await guild.members.fetch(cursedMemberId);
        const channel = cursedMember.voice.channel;

        if (this.stopActiveListener) {
            this.stopActiveListener(reason);
            this.stopActiveListener = undefined;
        }

        if (channel?.type !== ChannelType.GuildVoice) {
            log.info('listener.reconciled', {
                reason,
                cursedMemberId,
                listening: false,
            });
            return;
        }

        if (oceanCurse.isPlaying) {
            oceanCurse.moveActivePlayback(channel);
            log.info('listener.reconciled', {
                reason,
                guildId: channel.guildId,
                channelId: channel.id,
                cursedMemberId,
                listening: false,
                suppressedBy: 'playback',
            });
            return;
        }

        log.info('listener.reconciled', {
            reason,
            guildId: channel.guildId,
            channelId: channel.id,
            cursedMemberId,
            listening: true,
        });
        this.stopActiveListener = joinAndListen(
            channel,
            cursedMemberId,
            oceanCurse
        );
    }

    public async handleVoiceChange(
        oldState: VoiceState,
        newState: VoiceState,
        oceanCurse: OceanCurse
    ): Promise<boolean> {
        const channel = newState.channel;

        if (
            newState.guild.id !== oceanCurse.defaultGuildId ||
            oldState.channelId === newState.channelId
        ) {
            return false;
        }

        if (this.cursedMemberId === null) {
            const isGenuineHumanJoin =
                oldState.channelId === null &&
                channel?.type === ChannelType.GuildVoice &&
                newState.member?.user.bot === false;
            if (!isGenuineHumanJoin) return false;
            if (!this.claimCurse(newState.id, 'voice_join')) return false;

            if (oceanCurse.isPlaying) {
                oceanCurse.moveActivePlayback(channel);
                log.info('listener.suppressed', {
                    reason: 'playback_active',
                    guildId: channel.guildId,
                    channelId: channel.id,
                    cursedMemberId: newState.id,
                });
                return true;
            }
            log.info('listener.deploying', {
                guildId: channel.guildId,
                channelId: channel.id,
                cursedMemberId: newState.id,
            });
            this.stopActiveListener = joinAndListen(
                channel,
                newState.id,
                oceanCurse
            );
            return true;
        }

        if (newState.id !== this.cursedMemberId) return false;

        if (this.stopActiveListener) {
            this.stopActiveListener(
                channel ? 'cursed_member_moved' : 'cursed_member_left'
            );
            this.stopActiveListener = undefined;
        }

        if (channel?.type === ChannelType.GuildVoice) {
            if (oceanCurse.isPlaying) {
                oceanCurse.moveActivePlayback(channel);
                log.info('listener.suppressed', {
                    reason: 'playback_active',
                    guildId: channel.guildId,
                    channelId: channel.id,
                    cursedMemberId: this.cursedMemberId,
                });
                return true;
            }

            log.info('listener.deploying', {
                guildId: channel.guildId,
                channelId: channel.id,
                cursedMemberId: this.cursedMemberId,
            });

            this.stopActiveListener = joinAndListen(
                channel,
                newState.id,
                oceanCurse
            );
            return true;
        }

        if (channel) {
            log.warn('listener.channel_unsupported', {
                guildId: channel.guildId,
                channelId: channel.id,
                channelType: channel.type,
                cursedMemberId: this.cursedMemberId,
            });
        }

        return false;
    }

    public async handle(
        message: Message,
        oceanCurse: OceanCurse
    ): Promise<boolean> {
        const { author, content, guild, channelId } = message;

        if (
            !guild ||
            !content.toLowerCase().startsWith('ocean curse') ||
            channelId !== oceanCurse.defaultTextChannelId
        ) {
            return false;
        }

        async function replyAndDelete(
            reply: string,
            timeout: number = 5 * 1000
        ) {
            const replyToDelete = await message.reply(reply);
            try {
                await wait(timeout);
                await replyToDelete.delete();
            } catch (e) {
                log.warn('message.cleanup_failed', {
                    messageId: replyToDelete.id,
                    ...errorFields(e),
                });
            }
        }

        const authorVoiceChannel = message.member?.voice.channel;
        const authorIsInVoice =
            authorVoiceChannel?.type === ChannelType.GuildVoice &&
            authorVoiceChannel.guildId === oceanCurse.defaultGuildId;
        const commandIsQuery = content.toLowerCase() === 'ocean curse';

        if (this.cursedMemberId === null) {
            if (!commandIsQuery) {
                log.info('curse.transfer_rejected', {
                    requestedBy: author.id,
                    reason: 'curse_unclaimed',
                });
                await replyAndDelete(
                    'There is no curse to pass. Ask who is cursed first.'
                );
                return true;
            }
            if (!authorIsInVoice) {
                log.info('curse.query_rejected', {
                    requestedBy: author.id,
                    reason: 'not_in_voice_channel',
                });
                await oceanCurse.sendToDefaultTextChannel(
                    'You have to join a voice channel to tempt the curse.'
                );
                return true;
            }
            if (this.claimCurse(author.id, 'ocean_curse_command')) {
                if (oceanCurse.isPlaying) {
                    oceanCurse.moveActivePlayback(authorVoiceChannel);
                }
                await Promise.all([
                    replyAndDelete('**You.**'),
                    oceanCurse.playOceanMan(authorVoiceChannel),
                ]);
                return true;
            }
        }

        const cursedMemberId = this.cursedMemberId;
        if (!cursedMemberId) {
            throw new Error('Curse claim did not produce a holder');
        }

        if (commandIsQuery) {
            if (authorIsInVoice) {
                const cursedMember = await guild.members.fetch(cursedMemberId);
                const cursedAt = this.cursedAt;
                log.info('curse.queried', {
                    requestedBy: author.id,
                    cursedMemberId,
                    cursedAt,
                });

                const cursedAtUnix = cursedAt
                    ? Math.floor(Date.parse(cursedAt) / 1000)
                    : undefined;
                await replyAndDelete(
                    `The curse is on ${cursedMember.displayName}${
                        cursedAtUnix ? `, cursed <t:${cursedAtUnix}:R>` : ''
                    }. Self destruct in 5 seconds.`
                );
            } else {
                log.info('curse.query_rejected', {
                    requestedBy: author.id,
                    reason: 'not_in_voice_channel',
                });
                await oceanCurse.sendToDefaultTextChannel(
                    'You have to join a voice channel to see who has the curse.'
                );
            }
        } else if (message.author.id !== cursedMemberId) {
            log.info('curse.transfer_rejected', {
                requestedBy: author.id,
                reason: 'not_cursed_member',
            });
            await replyAndDelete(
                "You can't curse someone, you aren't the one who is cursed! Self destruct in 5 seconds."
            );
            await oceanCurse.playOceanMan(
                authorVoiceChannel?.type === ChannelType.GuildVoice
                    ? authorVoiceChannel
                    : undefined
            );
        } else {
            if (authorIsInVoice) {
                try {
                    const curseInput = content.split(' ')[2];
                    if (!curseInput) {
                        throw new Error('newCursedMember not specified');
                    }
                    const curseIsId = !!parseInt(curseInput);
                    const newCursedMember = curseIsId
                        ? await guild.members.fetch({ user: curseInput })
                        : (await guild.members.fetch()).find(
                              (member) =>
                                  member.user.tag.toLowerCase() ===
                                  curseInput.toLowerCase()
                          );
                    if (!newCursedMember) {
                        throw new Error(
                            `Cannot find member. input: ${curseInput}, curseIsId: ${curseIsId}`
                        );
                    }

                    const cursedAt = this.transferCurse(
                        cursedMemberId,
                        newCursedMember.user.id
                    );
                    if (!cursedAt) {
                        throw new Error(
                            'The curse changed while the transfer was being resolved'
                        );
                    }
                    log.info('curse.transferred', {
                        requestedBy: author.id,
                        previousCursedMemberId: cursedMemberId,
                        cursedMemberId: newCursedMember.user.id,
                        cursedAt,
                    });
                    await this.reconcileVoiceState(
                        oceanCurse,
                        'curse_transferred'
                    );
                    await replyAndDelete(
                        `Cursing ${newCursedMember.displayName}. Self destruct in 5 seconds.`
                    );
                } catch (e) {
                    log.warn('curse.transfer_failed', {
                        requestedBy: author.id,
                        ...errorFields(e),
                    });
                    await oceanCurse.sendToDefaultTextChannel(
                        "That curse didn't work. Curses only work like this: 'ocean curse <id OR tagname>'"
                    );
                }
            } else {
                log.info('curse.transfer_rejected', {
                    requestedBy: author.id,
                    reason: 'not_in_voice_channel',
                });
                await replyAndDelete(
                    'You must join the voice channel to curse someone. Self destruct in 5 seconds.'
                );
            }
        }

        return true;
    }
}
