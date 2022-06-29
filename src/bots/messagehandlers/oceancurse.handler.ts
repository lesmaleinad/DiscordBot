import { Message, VoiceState } from 'discord.js';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';
import { VoiceStateHandler } from '../voicestatehandler';

export class OceanCurseHandler implements MessageHandler, VoiceStateHandler {
    constructor(private cursedMemberId: string) {}

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
            await oceanCurse.sendToDefaultTextChannel(
                `Deploying OceanCurse for ${newState.member.displayName}.`
            );
            oceanCurse.playOceanMan();
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
            timeout: number = 15 * 1000
        ) {
            const replyToDelete = await message.reply(reply);
            setTimeout(() => {
                replyToDelete.delete();
            }, timeout);
        }

        if (content.toLowerCase() === 'ocean curse') {
            const requiredVoiceChannel =
                await oceanCurse.getDefaultVoiceChannel();

            if (requiredVoiceChannel.members.has(author.id)) {
                const cursedMember = await guild.members.fetch(
                    this.cursedMemberId
                );

                replyAndDelete(
                    `The curse is on ${cursedMember.displayName}. Self destruct in 15 seconds.`
                );
            } else {
                oceanCurse.sendToDefaultTextChannel(
                    'You have to join the general voice channel to see who has the curse.'
                );
            }
        } else if (message.author.id !== this.cursedMemberId) {
            await replyAndDelete(
                "You can't curse someone, you aren't the one who is cursed! Self destruct in 15 seconds."
            );
            oceanCurse.playOceanMan();
        } else {
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
                replyAndDelete(
                    `Cursing ${newCursedMember.displayName}. Self destruct in 15 seconds.`
                );
            } catch (e) {
                console.error(e);
                oceanCurse.sendToDefaultTextChannel(
                    "That curse didn't work. Curses only work like this: 'ocean curse <id OR tagname>'"
                );
            }
        }

        return true;
    }
}
