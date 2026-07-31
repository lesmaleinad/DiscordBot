import fs from 'fs';
import os from 'os';
import path from 'path';
import { Client } from 'discord.js';
import { optionalEnvironment } from './environment';
import { log } from './diagnostics';

export function startHealthHeartbeat(client: Client): () => void {
    const healthFile =
        optionalEnvironment('HEALTH_FILE') ??
        path.join(os.tmpdir(), 'oceancurse-ready');
    log.info('health.started', { healthFile });

    const update = () => {
        if (client.isReady()) {
            fs.writeFileSync(healthFile, new Date().toISOString());
        } else {
            fs.rmSync(healthFile, { force: true });
        }
    };

    update();
    const interval = setInterval(update, 30_000);
    interval.unref();

    return () => {
        clearInterval(interval);
        fs.rmSync(healthFile, { force: true });
        log.info('health.stopped', { healthFile });
    };
}
