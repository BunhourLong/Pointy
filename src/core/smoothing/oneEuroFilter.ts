import type { Point } from '../types';

export interface OneEuroParams {
  /** Hz. Cutoff at rest: lower = less jitter, more lag. */
  minCutoff: number;
  /** How fast the cutoff rises with speed: higher = less lag on fast moves. */
  beta: number;
  /** Hz. Cutoff for the speed estimate. */
  dCutoff: number;
}

/** One Euro filter (Casiez et al. 2012) on a 2D point; cutoff adapts to speed magnitude. */
export class OneEuroFilter {
  private prev: Point | null = null;
  private dPrev: Point = { x: 0, y: 0 };
  private tPrev = 0;
  private readonly params: OneEuroParams;

  constructor(params: OneEuroParams) {
    this.params = params;
  }

  filter(p: Point, tMs: number): Point {
    const dt = (tMs - this.tPrev) / 1000;
    if (!this.prev || dt <= 0) {
      this.prev ??= p;
      this.tPrev = tMs;
      return this.prev;
    }
    const { minCutoff, beta, dCutoff } = this.params;
    const d = { x: (p.x - this.prev.x) / dt, y: (p.y - this.prev.y) / dt };
    const dHat = lerp(this.dPrev, d, alpha(dCutoff, dt));
    const cutoff = minCutoff + beta * Math.hypot(dHat.x, dHat.y);
    const hat = lerp(this.prev, p, alpha(cutoff, dt));

    this.prev = hat;
    this.dPrev = dHat;
    this.tPrev = tMs;
    return hat;
  }

  reset(): void {
    this.prev = null;
    this.dPrev = { x: 0, y: 0 };
  }
}

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
