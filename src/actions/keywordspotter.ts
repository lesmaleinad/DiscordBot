import fs from 'fs';
import path from 'path';
import {
    booleanEnvironment,
    numberEnvironment,
    optionalEnvironment,
} from '../environment';

interface Waveform {
    sampleRate: number;
    samples: Float32Array;
}

interface KeywordStream {
    acceptWaveform(waveform: Waveform): void;
    inputFinished(): void;
}

interface KeywordResult {
    keyword: string;
}

interface KeywordSpotterHandle {
    createStream(): KeywordStream;
    isReady(stream: KeywordStream): boolean;
    decode(stream: KeywordStream): void;
    getResult(stream: KeywordStream): KeywordResult;
}

interface KeywordSpotterConstructor {
    new (config: object): KeywordSpotterHandle;
}

interface SherpaModule {
    KeywordSpotter: KeywordSpotterConstructor;
}

// sherpa-onnx-node exposes JSDoc but currently ships no TypeScript declarations.
// Keep the untyped native-module boundary isolated in this adapter.
const sherpa = require('sherpa-onnx-node') as SherpaModule;

const sampleRate = 16_000;

export class OceanManKeywordSpotter {
    private readonly handle: KeywordSpotterHandle;

    public constructor() {
        const modelDir =
            optionalEnvironment('SHERPA_MODEL_DIR') ??
            path.resolve(
                process.cwd(),
                'models',
                'sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20'
            );
        const keywordsFile =
            optionalEnvironment('SHERPA_KEYWORDS_FILE') ??
            path.resolve(process.cwd(), 'config', 'keywords.txt');

        const files = {
            encoder: path.join(
                modelDir,
                'encoder-epoch-13-avg-2-chunk-16-left-64.int8.onnx'
            ),
            decoder: path.join(
                modelDir,
                'decoder-epoch-13-avg-2-chunk-16-left-64.onnx'
            ),
            joiner: path.join(
                modelDir,
                'joiner-epoch-13-avg-2-chunk-16-left-64.int8.onnx'
            ),
            tokens: path.join(modelDir, 'tokens.txt'),
            keywordsFile,
        };

        for (const [name, file] of Object.entries(files)) {
            if (!fs.existsSync(file)) {
                throw new Error(`Missing Sherpa ${name}: ${file}`);
            }
        }

        this.handle = new sherpa.KeywordSpotter({
            featConfig: {
                sampleRate,
                featureDim: 80,
            },
            modelConfig: {
                transducer: {
                    encoder: files.encoder,
                    decoder: files.decoder,
                    joiner: files.joiner,
                },
                tokens: files.tokens,
                numThreads: numberEnvironment('SHERPA_NUM_THREADS', 1),
                provider: 'cpu',
                debug: booleanEnvironment('SHERPA_DEBUG', false),
                modelType: 'zipformer2',
            },
            maxActivePaths: 4,
            numTrailingBlanks: numberEnvironment(
                'SHERPA_NUM_TRAILING_BLANKS',
                0
            ),
            keywordsScore: numberEnvironment('SHERPA_KEYWORDS_SCORE', 1.5),
            keywordsThreshold: numberEnvironment(
                'SHERPA_KEYWORDS_THRESHOLD',
                0.22
            ),
            keywordsFile: files.keywordsFile,
        });
    }

    public createStream(): KeywordStream {
        return this.handle.createStream();
    }

    public acceptPcm(stream: KeywordStream, pcm: Buffer): string | undefined {
        stream.acceptWaveform({
            sampleRate,
            samples: pcm16LeToFloat32(pcm),
        });
        return this.decodeReady(stream);
    }

    public finish(stream: KeywordStream): string | undefined {
        stream.acceptWaveform({
            sampleRate,
            samples: new Float32Array(Math.round(sampleRate * 0.4)),
        });
        stream.inputFinished();
        return this.decodeReady(stream);
    }

    private decodeReady(stream: KeywordStream): string | undefined {
        while (this.handle.isReady(stream)) {
            this.handle.decode(stream);
            const keyword = this.handle.getResult(stream).keyword;
            if (keyword) return keyword;
        }
        return undefined;
    }
}

export function pcm16LeToFloat32(buffer: Buffer): Float32Array {
    const samples = new Float32Array(Math.floor(buffer.length / 2));
    for (let i = 0; i < samples.length; i += 1) {
        samples[i] = buffer.readInt16LE(i * 2) / 32_768;
    }
    return samples;
}
