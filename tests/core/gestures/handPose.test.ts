import { describe, expect, it } from 'vitest';
import { HandPoseDetector } from '@/core/gestures/handPose';
import type { Vec3 } from '@/core/types';

const landmarks = {
  wrist: 0,
  thumbTip: 4,
  indexPip: 6,
  indexTip: 8,
  middleMcp: 9,
  middlePip: 10,
  middleTip: 12,
  ringPip: 14,
  ringTip: 16,
  pinkyPip: 18,
  pinkyTip: 20,
};
const detector = (stableFrames = 1) =>
  new HandPoseDetector({ pinchOn: 0.35, pinchOff: 0.5, extendRatio: 1.1, stableFrames, landmarks });

type Finger = 'index' | 'middle' | 'ring' | 'pinky';
// [mcp, pip, tip, x] in MediaPipe order.
const FINGERS: Record<Finger, [number, number, number, number]> = {
  index: [5, 6, 8, -0.02],
  middle: [9, 10, 12, 0],
  ring: [13, 14, 16, 0.02],
  pinky: [17, 18, 20, 0.04],
};
const PALM = 0.08; // wrist → middle MCP

/** World landmarks (m) of an upright hand. `thumbGap` puts the thumb tip that far (in palm sizes) from the index tip. */
function hand(open: Finger[], thumbGap?: number): Vec3[] {
  const lm: Vec3[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  for (const [name, [mcp, pip, tip, x]] of Object.entries(FINGERS)) {
    const extended = open.includes(name as Finger);
    lm[mcp] = { x, y: -PALM, z: 0 };
    lm[pip] = extended ? { x, y: -0.12, z: 0 } : { x, y: -0.1, z: -0.02 };
    lm[tip] = extended ? { x, y: -0.17, z: 0 } : { x, y: -0.06, z: -0.03 };
  }
  const indexTip = lm[8]!;
  lm[4] =
    thumbGap === undefined
      ? { x: -0.07, y: -0.05, z: 0 }
      : { ...indexTip, x: indexTip.x - thumbGap * PALM };
  return lm;
}

describe('HandPoseDetector', () => {
  it('classifies point, open, fist and pinch', () => {
    expect(detector().update(hand(['index']))).toBe('point');
    expect(detector().update(hand(['index', 'middle', 'ring', 'pinky']))).toBe('open');
    expect(detector().update(hand([]))).toBe('fist');
    expect(detector().update(hand(['middle', 'ring', 'pinky'], 0.1))).toBe('pinch');
  });

  it('treats a closed hand with the thumb on the index as a fist, not a grab', () => {
    expect(detector().update(hand([], 0.1))).toBe('fist');
  });

  it('keeps a pinch while the gap hovers between the thresholds', () => {
    const d = detector();
    const fingers: Finger[] = ['middle', 'ring', 'pinky'];
    expect(d.update(hand(fingers, 0.4))).toBe('open'); // not yet pinched
    d.update(hand(fingers, 0.1));
    expect(d.update(hand(fingers, 0.4))).toBe('pinch');
    expect(d.update(hand(fingers, 0.6))).toBe('open');
  });

  it('changes pose only after it holds for stableFrames frames', () => {
    const d = detector(3);
    expect(d.update(hand(['index']))).toBe('open'); // starts open
    expect(d.update(hand(['index']))).toBe('open');
    expect(d.update(hand([]))).toBe('open'); // one-frame flicker: ignored
    expect(d.update(hand(['index']))).toBe('open');
    expect(d.update(hand(['index']))).toBe('open');
    expect(d.update(hand(['index']))).toBe('point');
  });

  it('reset goes back to open', () => {
    const d = detector();
    d.update(hand([]));
    d.reset();
    expect(d.update(hand(['index', 'middle']))).toBe('open');
  });
});
