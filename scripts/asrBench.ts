import { parseCommands, type Vocabulary } from '../src/core/commandParser.ts';
import type { Command } from '../src/core/types.ts';

export interface ClipResult {
  file: string;
  heard: string;
  ms: number;
}

/** `color-red-2.wav` → `color red`: the file name is what was said, plus an optional take number. */
export function labelOf(file: string): string {
  return file
    .replace(/\.wav$/i, '')
    .replace(/-\d+$/, '')
    .replaceAll('-', ' ');
}

/** Nearest-rank percentile of a non-empty list. */
export function percentile(values: readonly number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

const show = (commands: Command[]) =>
  commands.map((c) => (c.type === 'color' ? `color:${c.color}` : c.type)).join(' ');

/**
 * Command clips (the label parses to commands) pass when the transcript parses to exactly the
 * same commands. Every other clip (noise, small talk) is a false trigger if any command is heard.
 */
export function summarize(results: readonly ClipResult[], vocab: Vocabulary) {
  const rows = results.map(({ file, heard, ms }) => {
    const expected = show(parseCommands(labelOf(file), vocab));
    const got = show(parseCommands(heard, vocab));
    return { file, heard, expected, got, ok: expected === got, ms: Math.round(ms) };
  });
  const commandRows = rows.filter((r) => r.expected);
  const otherRows = rows.filter((r) => !r.expected);
  const latencies = rows.map((r) => r.ms);
  return {
    rows,
    correct: commandRows.filter((r) => r.ok).length,
    commandClips: commandRows.length,
    falseTriggers: otherRows.filter((r) => !r.ok).length,
    otherClips: otherRows.length,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
  };
}
