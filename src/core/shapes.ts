import type { Point, Region, ShapeKind, Stroke } from './types';
import type { StrokeStore } from './strokeStore';

/** Dense-edge-points Stroke for a shape, exactly filling `region` in unmirrored CAMERA space. */
export function makeShapeStroke(kind: ShapeKind, region: Region, color: string, width: number, edgeStep: number): Stroke {
  if (kind === 'circle') return { points: circlePoints(region, edgeStep), color, width };
  const { x, y, w, h } = region;
  const verts: Point[] =
    kind === 'rectangle'
      ? [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ]
      : [
          { x: x + w / 2, y },
          { x, y: y + h },
          { x: x + w, y: y + h },
        ];
  // Subdivide every edge into segments ≤ edgeStep; each vertex is the start of its edge, so it stays exact.
  const points: Point[] = [];
  for (let i = 0; i < verts.length; i++) {
    const a = verts[i]!;
    const b = verts[(i + 1) % verts.length]!;
    const segs = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / edgeStep));
    for (let j = 0; j < segs; j++) {
      points.push({ x: a.x + ((b.x - a.x) * j) / segs, y: a.y + ((b.y - a.y) * j) / segs });
    }
  }
  points.push({ ...verts[0]! }); // close the loop: first point repeated at the end
  return { points, color, width };
}

function circlePoints({ x, y, w, h }: Region, edgeStep: number): Point[] {
  const rx = w / 2;
  const ry = h / 2;
  const cx = x + rx;
  const cy = y + ry;
  const n = Math.max(12, Math.ceil((Math.PI * (rx + ry)) / edgeStep)); // perimeter ≈ π(rx+ry)
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n;
    points.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  points.push({ ...points[0]! }); // close the loop
  return points;
}

interface Shape {
  stroke: Stroke;
  kind: ShapeKind;
}

/** Creates shapes and applies ops on "it" = the most recently created shape (which: 1 = newest). */
export class ShapeOps {
  private shapes: Shape[] = [];
  private readonly store: StrokeStore;

  constructor(store: StrokeStore) {
    this.store = store;
  }

  /** Adds the shape as a committed stroke, tracking it as "it". */
  add(kind: ShapeKind, region: Region, color: string, width: number, edgeStep: number): void {
    const stroke = makeShapeStroke(kind, region, color, width, edgeStep);
    this.shapes.push({ stroke, kind });
    this.store.add(stroke);
  }

  move(dx: number, dy: number, which: number): void {
    const shape = this.pick(which);
    if (shape) this.store.translate([shape.stroke], dx, dy);
  }

  resize(factor: number, which: number): void {
    const shape = this.pick(which);
    if (!shape) return;
    const f = Math.min(4, Math.max(0.25, factor));
    const { x: cx, y: cy } = bboxCenter(shape.stroke);
    shape.stroke.points = shape.stroke.points.map((p) => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f }));
    this.store.version++;
  }

  recolor(color: string, which: number): void {
    const shape = this.pick(which);
    if (!shape) return;
    shape.stroke.color = color;
    this.store.version++;
  }

  remove(which: number): void {
    const shape = this.pick(which);
    if (!shape) return;
    this.shapes = this.shapes.filter((s) => s.stroke !== shape.stroke);
    this.store.remove([shape.stroke]);
  }

  entries(): readonly Shape[] {
    return this.shapes;
  }

  /** One line per shape for the LLM prompt, newest first: `1 (it): rectangle x=0.1 y=0.2 w=0.3 h=0.4`. */
  describe(): string[] {
    return [...this.shapes].reverse().map((shape, i) => {
      const b = bbox(shape.stroke);
      const n = (v: number) => String(+v.toFixed(4));
      return `${i + 1}${i === 0 ? ' (it)' : ''}: ${shape.kind} x=${n(b.minX)} y=${n(b.minY)} w=${n(b.maxX - b.minX)} h=${n(b.maxY - b.minY)}`;
    });
  }

  /** which counts from NEWEST: 1 = last shape. Out of range → undefined (no-op). */
  private pick(which: number): Shape | undefined {
    return this.shapes.at(-which);
  }
}

function bbox({ points }: Stroke): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

function bboxCenter(stroke: Stroke): Point {
  const b = bbox(stroke);
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 };
}
