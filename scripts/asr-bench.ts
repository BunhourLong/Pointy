// ASR accuracy bench: sends every clip in a folder to an OpenAI-compatible
// `/v1/audio/transcriptions` server and scores the text with Pointy's own command parser.
// Usage: npm run bench:asr -- [--url http://localhost:5092] [--model parakeet-tdt-0.6b] [--dir tests/fixtures/asr]
// Compare models or servers by running it once per --url/--model.
//
// shortcut: this file uses Node globals and `node:` modules, and @types/node isn't installed, so
// tsc doesn't check it (Node only strips the types). The logic lives in asrBench.ts, which is
// type-checked and tested. Add @types/node and put `scripts` in tsconfig to check this file too.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { config } from '../src/config.ts';
import { summarize, type ClipResult } from './asrBench.ts';

const HELP = `Record clips into the folder, named after what you say, plus an optional take number:
  draw-1.wav, stop-2.wav, color-red-1.wav, thicker-1.wav, hello-there-1.wav, noise-1.wav
Clips whose name holds no command word (noise, small talk) count as false-trigger checks.
Record ~30: each command word 2-3 times, some colors, plus noise, silence and non-command speech.
Fedora: arecord -f S16_LE -r 16000 -c 1 -d 2 tests/fixtures/asr/draw-1.wav`;

const { values } = parseArgs({
  options: {
    url: { type: 'string', default: 'http://localhost:5092' },
    model: { type: 'string', default: 'parakeet-tdt-0.6b' },
    dir: { type: 'string', default: 'tests/fixtures/asr' },
  },
});
const { url, model, dir } = values;

const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.wav')).sort();
if (files.length === 0) {
  console.error(`No .wav clips in ${dir}.\n${HELP}`);
  process.exit(1);
}

async function transcribe(file: string): Promise<ClipResult> {
  const form = new FormData();
  form.append('file', new Blob([await readFile(join(dir, file))], { type: 'audio/wav' }), file);
  form.append('model', model);
  const start = performance.now();
  const res = await fetch(new URL('/v1/audio/transcriptions', url), { method: 'POST', body: form });
  const ms = performance.now() - start;
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status} ${await res.text()}`);
  const body = await res.json();
  if (typeof body?.text !== 'string')
    throw new Error(`${file}: no "text" in ${JSON.stringify(body)}`);
  return { file, heard: body.text, ms };
}

// One at a time, so latency isn't skewed by our own requests queueing on the server.
const results: ClipResult[] = [];
for (const file of files) results.push(await transcribe(file));

const s = summarize(results, { keywords: config.voice.keywords, colors: config.pen.colors });
const pct = (n: number, of: number) => (of ? `${((100 * n) / of).toFixed(0)}%` : 'n/a');
console.log(`${model} @ ${url}, ${files.length} clips`);
console.table(s.rows);
console.table({
  [model]: {
    accuracy: `${s.correct}/${s.commandClips} (${pct(s.correct, s.commandClips)})`,
    'false triggers': `${s.falseTriggers}/${s.otherClips} (${pct(s.falseTriggers, s.otherClips)})`,
    'p50 ms': s.p50,
    'p95 ms': s.p95,
  },
});
