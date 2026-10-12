import type { StrokeStore } from './strokeStore';
import type { PenState, Point } from './types';

/**
 * idle: pen up. drawing: pen down, hand visible. paused: pen down, hand lost.
 * Only down() opens strokes and only up() lifts the pen; points are never recorded while idle.
 */
export class PenStateMachine {
  state: PenState = 'idle';
  private handVisible = false;
  private readonly store: StrokeStore;

  constructor(store: StrokeStore) {
    this.store = store;
  }

  down(): void {
    if (this.state === 'idle') this.state = this.handVisible ? 'drawing' : 'paused';
  }

  up(): void {
    this.state = 'idle';
    this.store.end();
  }

  /** Smoothed fingertip position. The stroke opens on the first point after pen-down. */
  move(p: Point): void {
    this.handVisible = true;
    if (this.state === 'paused') this.state = 'drawing';
    if (this.state !== 'drawing') return;
    if (this.store.current) this.store.append(p);
    else this.store.start(p);
  }

  lost(): void {
    this.handVisible = false;
    if (this.state === 'drawing') this.state = 'paused';
    this.store.end();
  }
}
