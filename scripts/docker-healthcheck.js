const fs = require('node:fs');

const healthFile = process.env.HEALTH_FILE ?? '/tmp/oceancurse-ready';
const maxAgeSeconds = Number(process.env.HEALTH_MAX_AGE_SECONDS ?? '90');

if (!Number.isFinite(maxAgeSeconds) || maxAgeSeconds <= 0) {
    console.error('HEALTH_MAX_AGE_SECONDS must be a positive number');
    process.exit(1);
}

try {
    const ageSeconds = (Date.now() - fs.statSync(healthFile).mtimeMs) / 1000;
    if (ageSeconds > maxAgeSeconds) {
        console.error(
            `Health heartbeat is ${Math.round(ageSeconds)} seconds old; maximum is ${maxAgeSeconds}`
        );
        process.exit(1);
    }
} catch (error) {
    console.error(`Health heartbeat is unavailable: ${error.message}`);
    process.exit(1);
}

