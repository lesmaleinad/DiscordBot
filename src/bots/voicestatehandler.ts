import { Client, VoiceState } from 'discord.js';
import { OceanCurse } from './oceancurse';

export interface VoiceStateHandler {
    handleVoiceChange(
        oldState: VoiceState,
        newState: VoiceState,
        client: Client,
        oceanCurse: OceanCurse
    ): boolean | Promise<boolean>;
}
