import type { StrokeStore } from './strokeStore';
import type { Point, Stroke } from './types';

/** Pick up the drawing under the hand, carry it, and drop it (optionally into the trash). */
export class StrokeGrabber {
  private readonly store: StrokeStore;
  private readonly radius: number;
  private held: Stroke[] = [];
  private last: Point | null = null;

  constructor(store: StrokeStore, radius: number) {
    this.store = store;
    this.radius = radius;
  }

  get holding(): boolean {
    return this.held.length > 0;
  }

  grab(p: Point, aspect = 1): void {
    this.held = this.store.strokesAt(p, this.radius, aspect);
    this.last = p;
  }

  drag(p: Point): void {
    if (!this.holding || !this.last) return;
    this.store.translate(this.held, p.x - this.last.x, p.y - this.last.y);
    this.last = p;
  }

  release(intoTrash: boolean): void {
    if (intoTrash && this.holding) this.store.remove(this.held);
    this.held = [];
    this.last = null;
  }
}
