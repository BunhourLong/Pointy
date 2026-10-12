import { describe, expect, it } from 'vitest';
import { StrokeStore } from '@/core/strokeStore';

const a = { x: 0.1, y: 0.1 };
const b = { x: 0.2, y: 0.2 };
const c = { x: 0.3, y: 0.3 };

describe('StrokeStore', () => {
  it('commits a stroke with its points, color and width on end', () => {
    const store = new StrokeStore('#f00', 6);
    store.start(a);
    store.append(b);
    expect(store.current?.points).toEqual([a, b]);
    expect(store.strokes).toEqual([]);

    store.end();

    expect(store.strokes).toEqual([{ points: [a, b], color: '#f00', width: 6 }]);
    expect(store.current).toBeNull();
  });

  it('undo removes the last committed stroke', () => {
    const store = new StrokeStore('#f00', 6);
    store.start(a);
    store.end();
    store.start(b);
    store.end();

    store.undo();

    expect(store.strokes.map((s) => s.points)).toEqual([[a]]);
  });

  it('undo while drawing discards the open stroke and keeps committed ones', () => {
    const store = new StrokeStore('#f00', 6);
    store.start(a);
    store.end();
    store.start(b);
    store.append(c);

    store.undo();

    expect(store.current).toBeNull();
    expect(store.strokes.map((s) => s.points)).toEqual([[a]]);
  });

  it('clear removes committed and open strokes', () => {
    const store = new StrokeStore('#f00', 6);
    store.start(a);
    store.end();
    store.start(b);

    store.clear();

    expect(store.strokes).toEqual([]);
    expect(store.current).toBeNull();
  });

  it('bumps version only when committed strokes change', () => {
    const store = new StrokeStore('#f00', 6);
    const seen = [store.version];
    const record = () => seen.push(store.version);

    store.start(a);
    store.append(b);
    record(); // open stroke only: unchanged
    store.end();
    record(); // committed
    store.end();
    record(); // nothing open: unchanged
    store.undo();
    record(); // removed
    store.clear();
    record(); // cleared

    expect(seen).toEqual([0, 0, 1, 1, 2, 3]);
  });

  it('trimRecent drops the open stroke points from the last N ms', () => {
    let now = 0;
    const store = new StrokeStore('#f00', 6, () => now);
    store.start(a);
    now = 100;
    store.append(b);
    now = 200;
    store.append(c);
    now = 250;

    store.trimRecent(100); // drops points newer than t=150

    expect(store.current?.points).toEqual([a, b]);
  });

  it('trimRecent keeps the first point so a quick draw/stop still leaves a dot', () => {
    const store = new StrokeStore('#f00', 6, () => 0);
    store.start(a);
    store.append(b);

    store.trimRecent(300);

    expect(store.current?.points).toEqual([a]);
  });

  it('trimRecent leaves committed strokes alone', () => {
    const store = new StrokeStore('#f00', 6, () => 0);
    store.start(a);
    store.end();

    store.trimRecent(300);

    expect(store.strokes.map((s) => s.points)).toEqual([[a]]);
  });

  it('load replaces all strokes and bumps version', () => {
    const store = new StrokeStore('#f00', 6);
    store.start(a);
    store.end();
    store.start(b);
    const saved = [{ points: [c], color: '#00f', width: 3 }];

    store.load(saved);

    expect(store.strokes).toEqual(saved);
    expect(store.current).toBeNull();
    expect(store.version).toBe(2);
  });

  describe('erase', () => {
    const line = (y: number) => [0.1, 0.2, 0.3, 0.4, 0.5].map((x) => ({ x, y }));

    it('cuts the erased points out, splitting the line in two', () => {
      const store = new StrokeStore('#f00', 6);
      store.load([{ points: line(0.5), color: '#00f', width: 3 }]);

      store.erase({ x: 0.3, y: 0.5 }, 0.05);

      expect(store.strokes).toEqual([
        { points: line(0.5).slice(0, 2), color: '#00f', width: 3 },
        { points: line(0.5).slice(3), color: '#00f', width: 3 },
      ]);
    });

    it('removes a line it covers completely and leaves far lines alone', () => {
      const store = new StrokeStore('#f00', 6);
      const far = { points: line(0.9), color: '#f00', width: 6 };
      store.load([{ points: [a], color: '#f00', width: 6 }, far]);

      store.erase(a, 0.05);

      expect(store.strokes).toEqual([far]);
    });

    it('bumps version only when something was erased', () => {
      const store = new StrokeStore('#f00', 6);
      store.load([{ points: line(0.5), color: '#f00', width: 6 }]);
      const before = store.version;

      store.erase({ x: 0.3, y: 0.9 }, 0.05);
      expect(store.version).toBe(before);
      store.erase({ x: 0.3, y: 0.5 }, 0.05);
      expect(store.version).toBe(before + 1);
    });

    it('measures the radius in true proportions on a wide frame', () => {
      const store = new StrokeStore('#f00', 6);
      store.load([{ points: [{ x: 0.34, y: 0.5 }], color: '#f00', width: 6 }]);

      // 0.04 apart horizontally = 0.071 frame heights at 16:9: outside a 0.05 radius.
      store.erase({ x: 0.3, y: 0.5 }, 0.05, 16 / 9);

      expect(store.strokes).toHaveLength(1);
    });
  });

  describe('strokesAt', () => {
    const stroke = (...points: { x: number; y: number }[]) => ({ points, color: '#f00', width: 6 });
    // A "face": a box outline with an eye inside it, plus a separate drawing far away.
    const face = stroke(
      { x: 0.2, y: 0.2 },
      { x: 0.4, y: 0.2 },
      { x: 0.4, y: 0.4 },
      { x: 0.2, y: 0.4 },
    );
    const eye = stroke({ x: 0.25, y: 0.25 }, { x: 0.27, y: 0.25 });
    const far = stroke({ x: 0.8, y: 0.8 }, { x: 0.9, y: 0.9 });

    it('returns the line under the point with every line overlapping it', () => {
      const store = new StrokeStore('#f00', 6);
      store.load([face, eye, far]);

      expect(store.strokesAt({ x: 0.41, y: 0.3 }, 0.05)).toEqual([face, eye]);
    });

    it('returns nothing when no line is within the radius', () => {
      const store = new StrokeStore('#f00', 6);
      store.load([face, eye, far]);

      expect(store.strokesAt({ x: 0.6, y: 0.6 }, 0.05)).toEqual([]);
    });
  });
});
