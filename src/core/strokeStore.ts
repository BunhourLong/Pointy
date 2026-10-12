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

  /** Cuts committed strokes' points within `radius` of `p` out, splitting strokes where needed. */
  erase(p: Point, radius: number, aspect = 1): void {
    const near = (q: Point) => distance(p, q, aspect) <= radius;
    if (!this.strokes.some((s) => s.points.some(near))) return;
    const kept: Stroke[] = [];
    for (const stroke of this.strokes) {
      let run: Point[] = [];
      for (const q of stroke.points) {
        if (!near(q)) run.push(q);
        else if (run.length) {
          kept.push({ ...stroke, points: run });
          run = [];
        }
      }
      if (run.length) kept.push({ ...stroke, points: run });
    }
    this.load(kept);
  }

  /** The committed stroke within `radius` of `p` plus every stroke whose bounds overlap it: "the drawing". */
  strokesAt(p: Point, radius: number, aspect = 1): Stroke[] {
    const hit = this.strokes.find((s) =>
      s.points.some((q, i) => segmentDistance(p, s.points[i - 1] ?? q, q, aspect) <= radius),
    );
    if (!hit) return [];
    const box = bounds(hit);
    return this.strokes.filter((s) => overlaps(bounds(s), box));
  }

  translate(strokes: readonly Stroke[], dx: number, dy: number): void {
    for (const s of strokes) s.points = s.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    this.version++;
  }

  remove(strokes: readonly Stroke[]): void {
    this.load(this.strokes.filter((s) => !strokes.includes(s)));
  }

  /** Replaces everything, e.g. with a saved drawing. */
  load(strokes: readonly Stroke[]): void {
    this.strokes.splice(0, this.strokes.length, ...strokes);
    this.current = null;
    this.version++;
  }
}

/** Distance in frame-height units: `aspect` (width / height) undoes per-axis normalization. */
function distance(a: Point, b: Point, aspect: number): number {
  return Math.hypot((a.x - b.x) * aspect, a.y - b.y);
}

/** Distance from `p` to segment `a`–`b`, in frame-height units. */
function segmentDistance(p: Point, a: Point, b: Point, aspect: number): number {
  const dx = (b.x - a.x) * aspect;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2
    ? Math.max(0, Math.min(1, ((p.x - a.x) * aspect * dx + (p.y - a.y) * dy) / len2))
    : 0;
  return distance(p, { x: a.x + (b.x - a.x) * t, y: a.y + dy * t }, aspect);
}

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function bounds({ points }: Stroke): Box {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

function overlaps(a: Box, b: Box): boolean {
  return a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY;
}
