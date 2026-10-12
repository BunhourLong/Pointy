import { describe, expect, it } from 'vitest';
import { CommandDebouncer } from '@/core/commandDebouncer';
import type { Command } from '@/core/types';

const draw: Command = { type: 'draw' };
const stop: Command = { type: 'stop' };
const undo: Command = { type: 'undo' };

describe('CommandDebouncer', () => {
  it('emits each command once while the interim transcript grows', () => {
    const d = new CommandDebouncer();
    expect(d.update([draw])).toEqual([draw]);
    expect(d.update([draw])).toEqual([]); // same words, re-sent as interim/final
    expect(d.update([draw, stop])).toEqual([stop]);
    expect(d.update([draw, stop])).toEqual([]);
  });

  it('emits a repeated word again when it is spoken again', () => {
    const d = new CommandDebouncer();
    d.update([undo]);
    expect(d.update([undo, undo])).toEqual([undo]);
  });

  it('a word the recognizer revises away does not swallow the next command', () => {
    const d = new CommandDebouncer();
    d.update([draw]); // "go"
    expect(d.update([])).toEqual([]); // revised to "goal"
    expect(d.update([stop])).toEqual([stop]); // "goal stop"
  });

  it('reset starts a new transcript', () => {
    const d = new CommandDebouncer();
    d.update([draw, stop]);
    d.reset();
    expect(d.update([draw])).toEqual([draw]);
  });
});
