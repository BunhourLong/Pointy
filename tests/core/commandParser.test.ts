import { describe, expect, it } from 'vitest';
import { commandWords, parseCommands } from '@/core/commandParser';

const vocab = {
  keywords: {
    draw: ['draw', 'go', 'start'],
    stop: ['stop', 'up'],
    clear: ['clear'],
    undo: ['undo'],
    thicker: ['thicker'],
    thinner: ['thinner'],
  },
  colors: { red: '#f00', blue: '#00f' },
};

describe('parseCommands', () => {
  it('maps every keyword synonym to its command', () => {
    expect(parseCommands('go', vocab)).toEqual([{ type: 'draw' }]);
    expect(parseCommands('up', vocab)).toEqual([{ type: 'stop' }]);
    expect(parseCommands('thinner', vocab)).toEqual([{ type: 'thinner' }]);
  });

  it('maps color names to a color command', () => {
    expect(parseCommands('blue', vocab)).toEqual([{ type: 'color', color: '#00f' }]);
  });

  it('returns every command in spoken order, ignoring other words and case', () => {
    expect(parseCommands('OK Draw a line, then STOP. Undo!', vocab)).toEqual([
      { type: 'draw' },
      { type: 'stop' },
      { type: 'undo' },
    ]);
  });

  it('only matches whole words', () => {
    expect(parseCommands('drawing goal stopped redo constructor', vocab)).toEqual([]);
  });

  it('returns an empty list for no text', () => {
    expect(parseCommands('', vocab)).toEqual([]);
  });
});

describe('commandWords', () => {
  it('lists every word the parser reacts to, once each', () => {
    const words = commandWords({ ...vocab, colors: { red: '#f00', blue: '#00f', stop: '#000' } });
    expect(words.sort()).toEqual(
      [
        'blue',
        'clear',
        'draw',
        'go',
        'red',
        'start',
        'stop',
        'thicker',
        'thinner',
        'undo',
        'up',
      ].sort(),
    );
  });
});
