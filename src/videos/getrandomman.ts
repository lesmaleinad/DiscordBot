import fs from 'fs';
import path from 'path';
import { StreamType } from '@discordjs/voice';
import { optionalEnvironment } from '../environment';

export function getRandomMan(): { file: string; inputType: StreamType } {
    const directory = path.resolve(optionalEnvironment('SONG_DIR') ?? 'songs');
    if (!fs.existsSync(directory)) {
        throw new Error(
            `Song directory ${directory} is missing. Run npm run download-songs first.`
        );
    }
    const songs = fs
        .readdirSync(directory, { withFileTypes: true })
        .filter(
            (entry) => entry.isFile() && /\.(webm|ogg|opus)$/i.test(entry.name)
        )
        .map((entry) => path.join(directory, entry.name))
        .filter((file) => fs.statSync(file).size > 0);
    if (songs.length === 0) {
        throw new Error(
            `No songs found in ${directory}. Run npm run download-songs first.`
        );
    }
    const file = songs[Math.floor(Math.random() * songs.length)]!;
    return {
        file,
        inputType:
            path.extname(file).toLowerCase() === '.webm'
                ? StreamType.WebmOpus
                : StreamType.OggOpus,
    };
}
