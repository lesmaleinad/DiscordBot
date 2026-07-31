import fs from 'fs';
import { config } from 'dotenv';

config({
    path: process.env['OCEAN_CURSE_ENV_FILE'] ?? '.env',
    quiet: true,
});

export function optionalEnvironment(name: string): string | undefined {
    const value = process.env[name]?.trim();
    return value || undefined;
}

export function requiredEnvironment(name: string): string {
    const value = optionalEnvironment(name);
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}

export function secretEnvironment(name: string, fileVariable: string): string {
    const secretFile = optionalEnvironment(fileVariable);
    if (secretFile) {
        return fs.readFileSync(secretFile, 'utf8').trim();
    }
    return requiredEnvironment(name);
}

export function booleanEnvironment(
    name: string,
    defaultValue = false
): boolean {
    const value = optionalEnvironment(name);
    if (value === undefined) return defaultValue;
    if (['1', 'true', 'yes', 'on'].includes(value.toLowerCase())) return true;
    if (['0', 'false', 'no', 'off'].includes(value.toLowerCase())) return false;
    throw new Error(`${name} must be true or false`);
}

export function numberEnvironment(name: string, defaultValue: number): number {
    const raw = optionalEnvironment(name);
    if (raw === undefined) return defaultValue;
    const value = Number(raw);
    if (!Number.isFinite(value)) {
        throw new Error(`${name} must be a number`);
    }
    return value;
}
