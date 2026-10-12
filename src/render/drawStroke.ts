import type { Stroke } from '@/core/types';
import { toCanvas } from './coords';

/** Quadratic curves through the midpoints of consecutive points, in a `width`×`height` px space. */
export function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number,
): void {
  const pts = stroke.points.map((p) => toCanvas(p, width, height));
  const first = pts[0];
  const last = pts[pts.length - 1];
  if (!first || !last) return;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    const next = pts[i + 1]!;
    ctx.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
  }
  ctx.lineTo(last.x, last.y); // a single point draws a round dot
  ctx.stroke();
}
