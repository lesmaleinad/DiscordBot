import fs from 'fs';
import { optionalEnvironment } from './environment';

export type LogFields = Record<
    string,
    string | number | boolean | null | undefined
>;

const diagnosticFile = optionalEnvironment('DIAGNOSTIC_LOG');
const environment =
    process.argv.includes('--staging') ||
    optionalEnvironment('STAGING')?.toLowerCase() === 'true'
        ? 'staging'
        : 'production';

function write(
    level: 'info' | 'warn' | 'error',
    event: string,
    fields: LogFields = {}
): void {
    const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        event,
        environment,
        ...fields,
    });

    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);

    if (diagnosticFile) {
        fs.appendFileSync(diagnosticFile, `${line}\n`);
    }
}

export const log = {
    info: (event: string, fields?: LogFields) => write('info', event, fields),
    warn: (event: string, fields?: LogFields) => write('warn', event, fields),
    error: (event: string, fields?: LogFields) => write('error', event, fields),
};

export function errorFields(error: unknown): LogFields {
    if (error instanceof Error) {
        const code = (error as NodeJS.ErrnoException).code;
        return {
            errorName: error.name,
            errorMessage: error.message,
            errorCode: code,
        };
    }
    return { errorMessage: String(error) };
}
