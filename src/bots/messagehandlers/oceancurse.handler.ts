import { Client, Message, VoiceState } from 'discord.js';
import { playOceanMan, sendMessageToTextChannel } from '../../actions/oceanman';
import { channelIsVoiceChannel, fetchChannel } from '../../validators/channel';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';
import { VoiceStateHandler } from '../voicestatehandler';

export class OceanCurseHandler implements MessageHandler, VoiceStateHandler {
    constructor(private cursedMemberId: string) {}

    public async handleVoiceChange(
        _: VoiceState,
        newState: VoiceState,
        client: Client,
        oceanCurse: OceanCurse
    ): Promise<boolean> {
        const channel = newState.channel;

        if (
            channel?.id === oceanCurse.defaultVoiceChannelId &&
            newState.member?.id === this.cursedMemberId
        ) {
            sendMessageToTextChannel(
                client,
                oceanCurse.defaultTextChannelId,
                `Deploying OceanCurse for ${newState.member.displayName}.`
            );
            playOceanMan(
                oceanCurse.defaultVoiceChannelId,
                oceanCurse.defaultGuildId,
                newState.guild.voiceAdapterCreator
            );
            return true;
        }

        return false;
    }

    public async handle(
        message: Message,
        client: Client,
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
            const requiredVoiceChannel = await fetchChannel(
                client,
                oceanCurse.defaultVoiceChannelId,
                channelIsVoiceChannel
            );

            if (requiredVoiceChannel.members.has(author.id)) {
                const cursedMember = await guild.members.fetch(
                    this.cursedMemberId
                );

                replyAndDelete(
                    `The curse is on ${cursedMember.displayName}. Self destruct in 15 seconds.`
                );
            } else {
                sendMessageToTextChannel(
                    client,
                    channelId,
                    'You have to join the general voice channel to see who has the curse.'
                );
            }
        } else {
            try {
                const [_, __, curseInput] = content.split(' ');
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
                sendMessageToTextChannel(
                    client,
                    channelId,
                    "That curse didn't work. Curses only work like this: 'ocean curse <id OR tagname>'"
                );
            }
        }

        return true;
    }
}
