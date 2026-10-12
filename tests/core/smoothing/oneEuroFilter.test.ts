import { describe, expect, it } from 'vitest';
import { OneEuroFilter } from '@/core/smoothing/oneEuroFilter';

const params = { minCutoff: 1, beta: 10, dCutoff: 1 };
const FRAME_MS = 1000 / 30;

describe('OneEuroFilter', () => {
  it('passes the first sample through, and the first one after reset', () => {
    const f = new OneEuroFilter(params);
    expect(f.filter({ x: 0.5, y: 0.5 }, 0)).toEqual({ x: 0.5, y: 0.5 });
    f.filter({ x: 0.6, y: 0.6 }, FRAME_MS);

    f.reset();

    expect(f.filter({ x: 0.1, y: 0.9 }, 2 * FRAME_MS)).toEqual({ x: 0.1, y: 0.9 });
  });

  it('suppresses jitter while the finger holds still', () => {
    const f = new OneEuroFilter(params);
    const noise = 0.01; // ±1% of the frame, alternating every frame
    let maxDeviation = 0;
    for (let i = 0; i < 60; i++) {
      const out = f.filter({ x: 0.5 + (i % 2 ? noise : -noise), y: 0.5 }, i * FRAME_MS);
      if (i >= 30) maxDeviation = Math.max(maxDeviation, Math.abs(out.x - 0.5));
    }
    expect(maxDeviation).toBeLessThan(noise / 2);
  });

  it('follows fast motion closely (speed raises the cutoff)', () => {
    // Steady-state lag of a ramp at 1 unit/s, 30 fps: ~0.015 with beta=10 vs ~0.16 with beta=0.
    const lagAfterRamp = (beta: number) => {
      const f = new OneEuroFilter({ ...params, beta });
      let lag = 0;
      for (let i = 0; i < 30; i++) {
        const x = i / 30;
        lag = x - f.filter({ x, y: 0 }, i * FRAME_MS).x;
      }
      return lag;
    };
    expect(lagAfterRamp(10)).toBeLessThan(0.03);
    expect(lagAfterRamp(0)).toBeGreaterThan(0.1);
  });

  it('ignores a repeated timestamp instead of dividing by zero', () => {
    const f = new OneEuroFilter(params);
    f.filter({ x: 0.5, y: 0.5 }, 100);
    const out = f.filter({ x: 0.9, y: 0.9 }, 100);
    expect(Number.isFinite(out.x)).toBe(true);
    expect(Number.isFinite(out.y)).toBe(true);
  });
});
