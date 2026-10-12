import type { Point } from '@/core/types';

/** Normalized landmark → canvas px. The only place the x-mirror happens. */
export function toCanvas(p: Point, width: number, height: number): Point {
  return { x: (1 - p.x) * width, y: p.y * height };
}
