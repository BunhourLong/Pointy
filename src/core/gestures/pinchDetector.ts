import type { Point } from '../types';

export interface PinchOptions {
  /** Pinch starts below this (thumb–index distance / hand size)… */
  onRatio: number;
  /** …and ends above this. The gap between them stops flicker at the threshold. */
  offRatio: number;
  wrist: number;
  thumbTip: number;
  indexTip: number;
  middleMcp: number;
}

/** Thumb + index pinch with hysteresis, normalized by hand size (wrist → middle MCP). */
export class PinchDetector {
  private pinched = false;
  private readonly o: PinchOptions;

  constructor(options: PinchOptions) {
    this.o = options;
  }

  /** `aspect` = frame width / height; landmarks are normalized per axis. */
  update(landmarks: readonly Point[], aspect = 1): boolean {
    const { wrist, thumbTip, indexTip, middleMcp } = this.o;
    const dist = (i: number, j: number) => {
      const a = landmarks[i];
      const b = landmarks[j];
      return a && b ? Math.hypot((a.x - b.x) * aspect, a.y - b.y) : 0;
    };
    const size = dist(wrist, middleMcp);
    if (!size) return this.pinched;
    const ratio = dist(thumbTip, indexTip) / size;
    this.pinched = this.pinched ? ratio < this.o.offRatio : ratio < this.o.onRatio;
    return this.pinched;
  }

  reset(): void {
    this.pinched = false;
  }
}
