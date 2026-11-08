import { describe, expect, it } from 'vitest';
import { config } from '@/config';
import { ShapeOps, makeShapeStroke } from '@/core/shapes';
import { StrokeStore } from '@/core/strokeStore';
import type { Point, Region, Stroke } from '@/core/types';

const step = config.ai.edgeStep;
const region: Region = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };

const segLen = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

const same = (a: Point, b: Point) => Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;

const hasPoint = (stroke: Stroke, p: Point) => stroke.points.some((q) => same(q, p));

describe('makeShapeStroke', () => {
  it('rectangle: exact corners, segments ≤ edgeStep, closed loop', () => {
    const s = makeShapeStroke('rectangle', region, '#f00', 6, step);
    const corners: Point[] = [
      { x: 0.1, y: 0.2 },
      { x: 0.4, y: 0.2 },
      { x: 0.4, y: 0.6 },
      { x: 0.1, y: 0.6 },
    ];
    for (const c of corners) expect(hasPoint(s, c)).toBe(true);
    for (let i = 1; i < s.points.length; i++)
      expect(segLen(s.points[i - 1]!, s.points[i]!)).toBeLessThanOrEqual(step + 1e-9);
    expect(same(s.points[0]!, s.points[s.points.length - 1]!)).toBe(true);
    expect(s.color).toBe('#f00');
    expect(s.width).toBe(6);
  });

  it('triangle: exact 3 vertices present', () => {
    const s = makeShapeStroke('triangle', region, '#f00', 6, step);
    const verts: Point[] = [
      { x: 0.25, y: 0.2 },
      { x: 0.1, y: 0.6 },
      { x: 0.4, y: 0.6 },
    ];
    for (const v of verts) expect(hasPoint(s, v)).toBe(true);
    expect(same(s.points[0]!, s.points[s.points.length - 1]!)).toBe(true);
  });

  it('circle: closed, all points within edgeStep of the ellipse', () => {
    const s = makeShapeStroke('circle', region, '#f00', 6, step);
    expect(same(s.points[0]!, s.points[s.points.length - 1]!)).toBe(true);
    const cx = 0.25, cy = 0.4, rx = 0.15, ry = 0.2;
    for (const p of s.points) {
      // Distance from the point to the ellipse ≈ radial error for near-circular sampling.
      const t = Math.atan2((p.y - cy) / ry, (p.x - cx) / rx);
      const on = { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
      expect(segLen(p, on)).toBeLessThanOrEqual(step);
    }
  });
});

describe('ShapeOps', () => {
  it('add commits to store, bumps version, tracks entries; which=2 is the first', () => {
    const store = new StrokeStore('#f00', 6);
    const ops = new ShapeOps(store);
    const v0 = store.version;
    ops.add('rectangle', region, '#f00', 6, step);
    expect(store.strokes).toHaveLength(1);
    expect(store.version).toBeGreaterThan(v0);
    ops.add('circle', { x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, '#f00', 6, step);
    expect(store.strokes).toHaveLength(2);
    expect(ops.entries()).toHaveLength(2);
    expect(ops.entries()[1]!.kind).toBe('circle');
    // which=2 → the first (rectangle) stroke.
    const before = store.strokes[1]!.points;
    ops.move(0.1, 0, 2);
    expect(store.strokes[1]!.points).toEqual(before); // circle untouched
    expect(store.strokes[0]!.points[0]!.x).toBeCloseTo(0.2);
  });

  it('move(dx,dy,1) translates only the last shape, version bumps', () => {
    const store = new StrokeStore('#f00', 6);
    const ops = new ShapeOps(store);
    ops.add('rectangle', region, '#f00', 6, step);
    ops.add('rectangle', { x: 0.5, y: 0.5, w: 0.2, h: 0.2 }, '#f00', 6, step);
    const first = store.strokes[0]!.points.map((p) => ({ ...p }));
    const v = store.version;
    ops.move(0.1, 0.05, 1);
    expect(store.version).toBeGreaterThan(v);
    const last = store.strokes[1]!.points;
    expect(last[0]!.x).toBeCloseTo(0.6);
    expect(last[0]!.y).toBeCloseTo(0.55);
    expect(store.strokes[0]!.points).toEqual(first);
  });

  it('resize(2,1) doubles the bbox about its center', () => {
    const store = new StrokeStore('#f00', 6);
    const ops = new ShapeOps(store);
    ops.add('rectangle', region, '#f00', 6, step);
    ops.resize(2, 1);
    const xs = store.strokes[0]!.points.map((p) => p.x);
    const ys = store.strokes[0]!.points.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    expect(minX).toBeCloseTo(0.1 - 0.15);
    expect(maxX).toBeCloseTo(0.4 + 0.15);
    expect(minY).toBeCloseTo(0.2 - 0.2);
    expect(maxY).toBeCloseTo(0.6 + 0.2);
  });

  it('recolor sets color + version; remove drops from store and entries; out-of-range = no-op', () => {
    const store = new StrokeStore('#f00', 6);
    const ops = new ShapeOps(store);
    ops.add('rectangle', region, '#f00', 6, step);
    const v = store.version;
    ops.recolor('#0f0', 1);
    expect(store.strokes[0]!.color).toBe('#0f0');
    expect(store.version).toBeGreaterThan(v);

    ops.remove(1);
    expect(store.strokes).toHaveLength(0);
    expect(ops.entries()).toHaveLength(0);

    const v2 = store.version;
    ops.remove(5);
    ops.move(0.1, 0.1, 1);
    ops.resize(2, 1);
    ops.recolor('#00f', 1);
    expect(store.version).toBe(v2);
  });

  it('describe() lists newest first with the contract format', () => {
    const store = new StrokeStore('#f00', 6);
    const ops = new ShapeOps(store);
    ops.add('rectangle', { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }, '#f00', 6, step);
    ops.add('triangle', { x: 0, y: 0, w: 0.1, h: 0.1 }, '#f00', 6, step);
    expect(ops.describe()).toEqual([
      '1 (it): triangle x=0 y=0 w=0.1 h=0.1',
      '2: rectangle x=0.1 y=0.2 w=0.3 h=0.4',
    ]);
  });
});
