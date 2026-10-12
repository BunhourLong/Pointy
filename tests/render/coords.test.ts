import { describe, expect, it } from 'vitest';
import { toCanvas } from '@/render/coords';

describe('toCanvas', () => {
  it('mirrors x so the drawing matches the mirrored video', () => {
    // A finger on the camera's left (x=0.25) appears on the viewer's right.
    expect(toCanvas({ x: 0.25, y: 0.5 }, 800, 600)).toEqual({ x: 600, y: 300 });
  });

  it('maps the corners of normalized space to the canvas corners', () => {
    expect(toCanvas({ x: 0, y: 0 }, 800, 600)).toEqual({ x: 800, y: 0 });
    expect(toCanvas({ x: 1, y: 1 }, 800, 600)).toEqual({ x: 0, y: 600 });
  });
});
