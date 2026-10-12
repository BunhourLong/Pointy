import type { Point, Stroke } from './types';

export class StrokeStore {
  readonly strokes: Stroke[] = [];
  current: Stroke | null = null;
  /** Bumps whenever `strokes` changes, so renderers can skip redraws. */
  version = 0;
  color: string;
  width: number;
  /** When each point of `current` was added, for trimRecent. */
  private times: number[] = [];
  private readonly now: () => number;

  constructor(color: string, width: number, now: () => number = () => performance.now()) {
    this.color = color;
    this.width = width;
    this.now = now;
  }

  start(p: Point): void {
    this.current = { points: [p], color: this.color, width: this.width };
    this.times = [this.now()];
  }

  append(p: Point): void {
    if (!this.current) return;
    this.current.points.push(p);
    this.times.push(this.now());
  }

  /** Drops the open stroke's points from the last `ms` (keeps the first), to hide voice-command lag. */
  trimRecent(ms: number): void {
    if (!this.current) return;
    const cutoff = this.now() - ms;
    const keep = Math.max(1, this.times.findLastIndex((t) => t <= cutoff) + 1);
    this.current.points.length = keep;
    this.times.length = keep;
  }

  end(): void {
    if (!this.current) return;
    this.strokes.push(this.current);
    this.current = null;
    this.version++;
  }

  /** Discards the open stroke if there is one, otherwise the last committed stroke. */
  undo(): void {
    if (this.current) this.current = null;
    else if (this.strokes.pop()) this.version++;
  }

  clear(): void {
    this.load([]);
  }

  /** Replaces everything, e.g. with a saved drawing. */
  load(strokes: readonly Stroke[]): void {
    this.strokes.splice(0, this.strokes.length, ...strokes);
    this.current = null;
    this.version++;
  }
}
