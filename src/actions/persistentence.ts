import fs from 'fs';
import { z } from 'zod';
import { Daniel } from '../ids';
import { booleanEnvironment, optionalEnvironment } from '../environment';
import { errorFields, log } from '../diagnostics';

export enum StateVar {
    CursedMemberId = 'cursedMemberId',
    CursedAt = 'cursedAt',
    ReleasedAt = 'releasedAt',
    MessageCount = 'messageCount',
}

const defaultCursedMemberId = optionalEnvironment('CURSED_MEMBER_ID') ?? Daniel;
const defaultCursedAt =
    optionalEnvironment('CURSED_AT') ?? new Date().toISOString();

const persistentStateValidator = z.object({
    [StateVar.CursedMemberId]: z
        .string({ description: 'Cursed member ID' })
        .min(18, 'Incorrect length for cursed member ID')
        .nullable()
        .default(defaultCursedMemberId),
    [StateVar.CursedAt]: z
        .string()
        .datetime()
        .nullable()
        .default(defaultCursedAt),
    [StateVar.ReleasedAt]: z.string().datetime().nullable().default(null),
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
    private readonly path =
        process.argv.includes('--staging') || booleanEnvironment('STAGING')
            ? undefined
            : optionalEnvironment('STATE_PATH');

    private readState(): PersistentState {
        try {
            if (this.path) {
                const rawResult = JSON.parse(
                    fs.readFileSync(this.path, { encoding: 'utf-8' })
                );
                const state = persistentStateValidator.parse(rawResult);
                log.info('state.loaded', {
                    statePath: this.path,
                    cursedMemberId: state.cursedMemberId,
                    cursedAt: state.cursedAt,
                    releasedAt: state.releasedAt,
                });
                return state;
            } else {
                const state = persistentStateValidator.parse({});
                log.info('state.initialized', {
                    persisted: false,
                    cursedMemberId: state.cursedMemberId,
                    cursedAt: state.cursedAt,
                });
                return state;
            }
        } catch (e) {
            const state = persistentStateValidator.parse({});
            log.error('state.read_failed', {
                statePath: this.path,
                fallbackCursedMemberId: state.cursedMemberId,
                ...errorFields(e),
            });
            return state;
        }
    }

    private currentState: PersistentState = this.readState();

    public getState<T extends keyof PersistentState>(
        variable: T
    ): PersistentState[T] {
        return this.currentState[variable];
    }

    public updateState(newState: Partial<PersistentState>): void {
        this.currentState = persistentStateValidator.parse({
            ...this.currentState,
            ...newState,
        });
        if (this.path) {
            const temporaryPath = `${this.path}.tmp`;
            fs.writeFileSync(temporaryPath, JSON.stringify(this.currentState));
            fs.renameSync(temporaryPath, this.path);
        }
    }
}

export const State = new PersistedState();
