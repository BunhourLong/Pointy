import { describe, expect, it } from 'vitest';
import { labelOf, percentile, summarize } from '../../scripts/asrBench.ts';

const vocab = {
  keywords: {
    draw: ['draw'],
    stop: ['stop'],
    clear: ['clear'],
    undo: ['undo'],
    thicker: ['thicker'],
    thinner: ['thinner'],
  },
  colors: { red: '#f00' },
};

describe('labelOf', () => {
  it('reads the spoken words from the file name, dropping the take number', () => {
    expect(labelOf('color-red-2.wav')).toBe('color red');
    expect(labelOf('draw.wav')).toBe('draw');
    expect(labelOf('noise-12.wav')).toBe('noise');
  });
});

describe('percentile', () => {
  it('uses the nearest rank', () => {
    expect(percentile([30, 10, 20, 40], 50)).toBe(20);
    expect(percentile([30, 10, 20, 40], 95)).toBe(40);
    expect(percentile([7], 95)).toBe(7);
  });
});

describe('summarize', () => {
  it('scores command clips by exact match and counts commands heard in non-command clips', () => {
    const s = summarize(
      [
        { file: 'draw-1.wav', heard: 'Draw.', ms: 100 },
        { file: 'color-red-1.wav', heard: 'Colour red', ms: 200 },
        { file: 'undo-1.wav', heard: 'U', ms: 300 },
        { file: 'stop-1.wav', heard: 'stop stop', ms: 400 },
        { file: 'noise-1.wav', heard: '', ms: 500 },
        { file: 'hello-there-1.wav', heard: 'hello, draw', ms: 600 },
      ],
      vocab,
    );
    expect(s.rows.map((r) => r.ok)).toEqual([true, true, false, false, true, false]);
    expect(s.rows[1]).toMatchObject({ expected: 'color:#f00', got: 'color:#f00' });
    expect(s).toMatchObject({
      correct: 2,
      commandClips: 4,
      falseTriggers: 1,
      otherClips: 2,
      p50: 300,
      p95: 600,
    });
  });
});
