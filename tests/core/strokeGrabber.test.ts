import { describe, expect, it } from 'vitest';
import { StrokeGrabber } from '@/core/strokeGrabber';
import { StrokeStore } from '@/core/strokeStore';

const setup = () => {
  const store = new StrokeStore('#f00', 6);
  store.load([
    {
      points: [
        { x: 0.2, y: 0.2 },
        { x: 0.3, y: 0.2 },
      ],
      color: '#f00',
      width: 6,
    },
    { points: [{ x: 0.8, y: 0.8 }], color: '#00f', width: 6 },
  ]);
  return { store, grabber: new StrokeGrabber(store, 0.05) };
};

describe('StrokeGrabber', () => {
  it('moves the grabbed drawing along with the hand', () => {
    const { store, grabber } = setup();
    const before = store.version;

    grabber.grab({ x: 0.25, y: 0.2 });
    grabber.drag({ x: 0.35, y: 0.3 });

    expect(grabber.holding).toBe(true);
    expect(store.strokes[0]!.points[0]!.x).toBeCloseTo(0.3);
    expect(store.strokes[0]!.points[0]!.y).toBeCloseTo(0.3);
    expect(store.strokes[1]!.points).toEqual([{ x: 0.8, y: 0.8 }]);
    expect(store.version).toBeGreaterThan(before);
  });

  it('deletes the drawing when released over the trash', () => {
    const { store, grabber } = setup();
    grabber.grab({ x: 0.25, y: 0.2 });

    grabber.release(true);

    expect(store.strokes.map((s) => s.color)).toEqual(['#00f']);
    expect(grabber.holding).toBe(false);
  });

  it('drops the drawing where it is when released elsewhere', () => {
    const { store, grabber } = setup();
    grabber.grab({ x: 0.25, y: 0.2 });
    grabber.drag({ x: 0.25, y: 0.3 });

    grabber.release(false);
    grabber.drag({ x: 0.5, y: 0.5 });

    expect(store.strokes).toHaveLength(2);
    expect(store.strokes[0]!.points[0]!.y).toBeCloseTo(0.3);
  });

  it('holds nothing when grabbing empty space', () => {
    const { store, grabber } = setup();
    const before = store.version;

    grabber.grab({ x: 0.5, y: 0.5 });
    grabber.drag({ x: 0.6, y: 0.6 });
    grabber.release(true);

    expect(grabber.holding).toBe(false);
    expect(store.strokes).toHaveLength(2);
    expect(store.version).toBe(before);
  });
});
