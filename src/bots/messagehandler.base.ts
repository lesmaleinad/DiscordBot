import { Message } from 'discord.js';
import { OceanCurse } from './oceancurse';

export interface MessageHandler {
    /**
     *
     * @param message message recieved from server
     * @returns true if handling should terminate, false if the next handler should be applied
     */
    handle(
        message: Message,
        oceanCurse: OceanCurse
    ): boolean | Promise<boolean>;
}
