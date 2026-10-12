import type { Point, Stroke } from './types';

export class StrokeStore {
  readonly strokes: Stroke[] = [];
  current: Stroke | null = null;
  /** Bumps whenever `strokes` changes, so renderers can skip redraws. */
  version = 0;
  color: string;
  width: number;

  constructor(color: string, width: number) {
    this.color = color;
    this.width = width;
  }

  start(p: Point): void {
    this.current = { points: [p], color: this.color, width: this.width };
  }

  append(p: Point): void {
    this.current?.points.push(p);
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
    this.strokes.length = 0;
    this.current = null;
    this.version++;
  }
}
