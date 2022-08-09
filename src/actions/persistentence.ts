import { config } from 'dotenv';
import fs from 'fs';
import { z } from 'zod';
import { Daniel } from '../ids';

config();

export enum StateVar {
    CursedMemberId = 'cursedMemberId',
    MessageCount = 'messageCount',
}

const persistentStateValidator = z.object({
    [StateVar.CursedMemberId]: z
        .string({ description: 'Cursed member ID' })
        .length(18, 'Incorrect length for cursed member ID')
        .default(Daniel),
    [StateVar.MessageCount]: z
        .number({
            description: 'Count of messages sent to the discord',
        })
        .nonnegative('Count of messages cannot be below 0')
        .int('Count of messages must be an integer')
        .default(0),
});

export type PersistentState = z.infer<typeof persistentStateValidator>;

class PersistedState {
    private readState(): PersistentState {
        try {
            const path = process.env['STATE_PATH'];
            if (path) {
                const rawResult = JSON.parse(
                    fs.readFileSync(path, { encoding: 'utf-8' })
                );
                return persistentStateValidator.parse(rawResult);
            } else {
                return persistentStateValidator.parse({});
            }
        } catch (e) {
            console.error('Error when reading state');
            console.error(e);
            return persistentStateValidator.parse({});
        }
    }

    private currentState: PersistentState = this.readState();

    public getState<T extends keyof PersistentState>(
        variable: T
    ): PersistentState[T] {
        return this.currentState[variable];
    }

    public updateState(newState: Partial<PersistentState>): void {
        this.currentState = { ...this.currentState, ...newState };
        const path = process.env['STATE_PATH'];
        if (path) {
            fs.writeFileSync(path, JSON.stringify(this.currentState));
        }
    }
}

export const State = new PersistedState();
