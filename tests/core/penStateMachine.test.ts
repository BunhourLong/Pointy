import { describe, expect, it } from 'vitest';
import { PenStateMachine } from '@/core/penStateMachine';
import { StrokeStore } from '@/core/strokeStore';

const a = { x: 0.1, y: 0.1 };
const b = { x: 0.2, y: 0.2 };
const c = { x: 0.3, y: 0.3 };
const d = { x: 0.4, y: 0.4 };

function setup() {
  const store = new StrokeStore('#f00', 6);
  return { store, pen: new PenStateMachine(store) };
}

/** Every stroke's points, committed first, then the open one. */
const lines = (store: StrokeStore) =>
  [...store.strokes, ...(store.current ? [store.current] : [])].map((s) => s.points);

describe('PenStateMachine', () => {
  it('starts idle and never records points while the pen is up', () => {
    const { store, pen } = setup();
    pen.move(a);
    pen.move(b);

    expect(pen.state).toBe('idle');
    expect(lines(store)).toEqual([]);
  });

  it('records the hand path after the pen goes down', () => {
    const { store, pen } = setup();
    pen.move(a);
    pen.down();
    pen.move(b);
    pen.move(c);

    expect(pen.state).toBe('drawing');
    expect(lines(store)).toEqual([[b, c]]);
  });

  it('up ends the stroke and ignores later movement', () => {
    const { store, pen } = setup();
    pen.down();
    pen.move(a);
    pen.move(b);
    pen.up();
    pen.move(c);

    expect(pen.state).toBe('idle');
    expect(store.current).toBeNull();
    expect(lines(store)).toEqual([[a, b]]);
  });

  it('down → up → down produces two separate strokes', () => {
    const { store, pen } = setup();
    pen.down();
    pen.move(a);
    pen.move(b);
    pen.up();
    pen.move(c); // repositioning with the pen up
    pen.down();
    pen.move(c);
    pen.move(d);

    expect(lines(store)).toEqual([
      [a, b],
      [c, d],
    ]);
  });

  it('losing the hand with the pen down ends the stroke; a new one starts when it returns', () => {
    const { store, pen } = setup();
    pen.move(a);
    pen.down();
    pen.move(a);
    pen.move(b);
    pen.lost();

    expect(pen.state).toBe('paused');
    expect(store.current).toBeNull();

    pen.move(c);
    pen.move(d);

    expect(pen.state).toBe('drawing');
    expect(lines(store)).toEqual([
      [a, b],
      [c, d],
    ]);
  });

  it('pen down while no hand is visible waits in paused until the hand appears', () => {
    const { store, pen } = setup();
    pen.down();

    expect(pen.state).toBe('paused');

    pen.move(a);
    expect(pen.state).toBe('drawing');
    expect(lines(store)).toEqual([[a]]);
  });

  it('losing the hand with the pen up stays idle', () => {
    const { pen } = setup();
    pen.move(a);
    pen.lost();
    expect(pen.state).toBe('idle');
  });

  it('up while paused returns to idle and the returning hand does not draw', () => {
    const { store, pen } = setup();
    pen.down();
    pen.up();
    pen.move(a);

    expect(pen.state).toBe('idle');
    expect(lines(store)).toEqual([]);
  });
});
