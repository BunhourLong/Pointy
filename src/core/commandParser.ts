import type { Command } from './types';

type SimpleCommand = Exclude<Command, { type: 'color' } | { type: 'toggle' }>['type'];

export interface Vocabulary {
  keywords: Readonly<Record<SimpleCommand, readonly string[]>>;
  /** Spoken color name → CSS color. */
  colors: Readonly<Record<string, string>>;
}

/** Every command word in `text`, in spoken order. Whole words only, case-insensitive. */
export function parseCommands(text: string, vocab: Vocabulary): Command[] {
  const commands: Command[] = [];
  for (const word of text.toLowerCase().match(/[a-z']+/g) ?? []) {
    if (Object.hasOwn(vocab.colors, word)) {
      commands.push({ type: 'color', color: vocab.colors[word]! });
      continue;
    }
    for (const [type, words] of Object.entries(vocab.keywords)) {
      if (words.includes(word)) commands.push({ type: type as SimpleCommand });
    }
  }
  return commands;
}
