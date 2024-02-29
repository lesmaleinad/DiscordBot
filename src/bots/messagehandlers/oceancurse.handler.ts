import { Message, VoiceState } from 'discord.js';
import { State, StateVar } from '../../actions/persistentence';
import { wait } from '../../utils';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';
import { VoiceStateHandler } from '../voicestatehandler';
import { joinAndListen } from '../../actions/listen';

export class OceanCurseHandler implements MessageHandler, VoiceStateHandler {
    private set cursedMemberId(value: string) {
        State.updateState({ [StateVar.CursedMemberId]: value });
    }

    private get cursedMemberId() {
        return State.getState(StateVar.CursedMemberId);
    }

    public async handleVoiceChange(
        oldState: VoiceState,
        newState: VoiceState,
        oceanCurse: OceanCurse
    ): Promise<boolean> {
        const channel = newState.channel;

        if (
            oldState.channelId !== oceanCurse.defaultVoiceChannelId &&
            channel?.id === oceanCurse.defaultVoiceChannelId &&
            newState.member?.id === this.cursedMemberId
        ) {
            //     await oceanCurse.sendToDefaultTextChannel(
            //         `Deploying OceanCurse for ${newState.member.displayName}.`
            //     );
            //     oceanCurse.playOceanMan();
            //     return true;

            const voiceChannel = await oceanCurse.getDefaultVoiceChannel();
            joinAndListen(voiceChannel, newState.member.id, oceanCurse);
            return true;
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
                console.error('*** ERROR WHILE DELETING MESSAGE ***');
                console.error(`*** REPLY: ${reply} ***`);
                console.error(e);
            }
        }

        const requiredVoiceChannel = await oceanCurse.getDefaultVoiceChannel();

        if (content.toLowerCase() === 'ocean curse') {
            if (requiredVoiceChannel.members.has(author.id)) {
                const cursedMember = await guild.members.fetch(
                    this.cursedMemberId
                );

                await replyAndDelete(
                    `The curse is on ${cursedMember.displayName}. Self destruct in 5 seconds.`
                );
            } else {
                oceanCurse.sendToDefaultTextChannel(
                    'You have to join the general voice channel to see who has the curse.'
                );
            }
        } else if (message.author.id !== this.cursedMemberId) {
            await replyAndDelete(
                "You can't curse someone, you aren't the one who is cursed! Self destruct in 5 seconds."
            );
            oceanCurse.playOceanMan();
        } else {
            if (requiredVoiceChannel.members.has(author.id)) {
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

                    this.cursedMemberId = newCursedMember.user.id;
                    await replyAndDelete(
                        `Cursing ${newCursedMember.displayName}. Self destruct in 5 seconds.`
                    );
                } catch (e) {
                    console.error(e);
                    oceanCurse.sendToDefaultTextChannel(
                        "That curse didn't work. Curses only work like this: 'ocean curse <id OR tagname>'"
                    );
                }
            } else {
                await replyAndDelete(
                    'You must join the voice channel to curse someone. Self destruct in 5 seconds.'
                );
            }
        }

        return true;
    }
}
