import { AnyChannel, Client, TextChannel } from 'discord.js';

export type ChannelValidator<T extends AnyChannel> = (
    channel: AnyChannel
) => channel is T;

export const channelIsTextChannel: ChannelValidator<TextChannel> = (
    channel
): channel is TextChannel => {
    return channel.type === 'GUILD_TEXT';
};

export async function fetchChannel<T extends AnyChannel>(
    client: Client,
    id: string,
    validator: ChannelValidator<T>
): Promise<T> {
    const channel = await client.channels.fetch(id);
    if (!channel) {
        throw new Error(`Channel of ID ${id} does not exist`);
    }

    if (!validator(channel)) {
        throw new Error(`Channel of ID ${id} failed validation`);
    }

    return channel;
}
