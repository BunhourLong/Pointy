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
});
