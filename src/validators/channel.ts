import {
    Channel,
    ChannelType,
    Client,
    TextChannel,
    VoiceChannel,
} from 'discord.js';

export type ChannelValidator<T extends Channel> = (
    channel: Channel
) => channel is T;

export const channelIsTextChannel: ChannelValidator<TextChannel> = (
    channel
): channel is TextChannel => {
    return channel.type === ChannelType.GuildText;
};

export const channelIsVoiceChannel: ChannelValidator<VoiceChannel> = (
    channel
): channel is VoiceChannel => {
    return channel.type === ChannelType.GuildVoice;
};

export async function fetchChannel<T extends Channel>(
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
