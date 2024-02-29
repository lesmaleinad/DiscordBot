import { Message, User, userMention } from 'discord.js';
import { MessageHandler } from '../messagehandler.base';
import { OceanCurse } from '../oceancurse';
import { State } from '../../actions/persistentence';

export class ThankYouReplyHandler implements MessageHandler {
    private readonly usersWaitingForThanks = new Map<string, NodeJS.Timeout>();

    private clearTimeoutIfExists(userId: string) {
        if (this.usersWaitingForThanks.has(userId)) {
            clearTimeout(this.usersWaitingForThanks.get(userId));
            this.usersWaitingForThanks.delete(userId);
        }
    }

    public expectThanks(user: User, oceanCurse: OceanCurse) {
        this.clearTimeoutIfExists(user.id);

        this.usersWaitingForThanks.set(
            user.id,
            setTimeout(async () => {
                const message = await oceanCurse.sendToDefaultTextChannel(
                    `${userMention(
                        user.id
                    )} didn't thank me in time, and is now cursed. Self destructing in 10 seconds.`
                );
                State.updateState({
                    cursedMemberId: user.id,
                });
                setTimeout(() => message.delete(), 10 * 1000);
            }, 15 * 1000)
        );
    }

    public async handle(
        message: Message<boolean>,
        oceanCurse: OceanCurse
    ): Promise<boolean> {
        if (
            message.channelId === oceanCurse.defaultTextChannelId &&
            message.content.toLowerCase().includes('thank') &&
            this.usersWaitingForThanks.has(message.author.id)
        ) {
            this.clearTimeoutIfExists(message.author.id);

            const responses = [
                "You're welcome.",
                'You are welcome',
                'You are very welcome.',
                "You're welcome!",
                'No problem chief.',
                'No, thank you!',
                'My pleasure',
                "It's my pleasure.",
            ];

            await oceanCurse.sendToDefaultTextChannel(
                responses[Math.floor(responses.length * Math.random())]!
            );

            return true;
        }

        return false;
    }
}
