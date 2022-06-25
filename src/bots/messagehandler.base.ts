import { Message, Client } from 'discord.js';
import { OceanCurse } from './oceancurse';

export abstract class MessageHandler {
    /**
     *
     * @param message message recieved from server
     * @returns true if handling should terminate, false if the next handler should be applied
     */
    public abstract handle(
        message: Message,
        client: Client,
        oceanCurse: OceanCurse
    ): boolean | Promise<boolean>;
}
