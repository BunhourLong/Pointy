import { describe, expect, it } from 'vitest';
import { PinchDetector } from '@/core/gestures/pinchDetector';
import type { Point } from '@/core/types';

const indices = { wrist: 0, thumbTip: 4, indexTip: 8, middleMcp: 9 };
const detector = () => new PinchDetector({ onRatio: 0.35, offRatio: 0.5, ...indices });

/** 21 landmarks: hand size (wrist → middle MCP) = `size`, thumb–index gap = `gap`. */
function hand(gap: number, size = 0.2): Point[] {
  const lm: Point[] = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
  lm[indices.wrist] = { x: 0.5, y: 0.8 };
  lm[indices.middleMcp] = { x: 0.5, y: 0.8 - size };
  lm[indices.thumbTip] = { x: 0.4, y: 0.5 };
  lm[indices.indexTip] = { x: 0.4 + gap, y: 0.5 };
  return lm;
}

describe('PinchDetector', () => {
  it('detects a pinch when thumb and index close below the on ratio', () => {
    const d = detector();
    expect(d.update(hand(0.2))).toBe(false); // ratio 1.0
    expect(d.update(hand(0.06))).toBe(true); // ratio 0.3
  });

  it('does not flicker while the ratio hovers between the thresholds', () => {
    const d = detector();
    expect(d.update(hand(0.08))).toBe(false); // 0.4: not yet pinched
    d.update(hand(0.06)); // pinch
    expect(d.update(hand(0.08))).toBe(true); // 0.4: still pinched
    expect(d.update(hand(0.09))).toBe(true); // 0.45
    expect(d.update(hand(0.08))).toBe(true);
  });

  it('releases once the ratio rises above the off ratio', () => {
    const d = detector();
    d.update(hand(0.06));
    expect(d.update(hand(0.12))).toBe(false); // 0.6
  });

  it('normalizes by hand size, so distance from the camera does not matter', () => {
    const d = detector();
    // Same 0.06 gap: a pinch for a big (near) hand, open for a small (far) one.
    expect(d.update(hand(0.06, 0.4))).toBe(true); // 0.15
    d.reset();
    expect(d.update(hand(0.06, 0.1))).toBe(false); // 0.6
  });

  it('measures in true proportions on a non-square frame', () => {
    // Horizontal 0.06 gap on a 16:9 frame is 0.107 in height units: ratio 0.53, not a pinch.
    expect(detector().update(hand(0.06), 16 / 9)).toBe(false);
  });
});
