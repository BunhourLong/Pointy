import type { HandPose, Vec3 } from '../types';

export interface HandPoseOptions {
  /** Pinch starts below this (thumb–index tip distance / palm size)… */
  pinchOn: number;
  /** …and ends above this. The gap between them stops flicker at the threshold. */
  pinchOff: number;
  /** A finger is extended when its tip is this many times farther from the wrist than its PIP joint. */
  extendRatio: number;
  /** A new pose must hold this many frames in a row before it is reported. */
  stableFrames: number;
  landmarks: {
    wrist: number;
    thumbTip: number;
    middleMcp: number;
    indexPip: number;
    indexTip: number;
    middlePip: number;
    middleTip: number;
    ringPip: number;
    ringTip: number;
    pinkyPip: number;
    pinkyTip: number;
  };
}

/** Classifies a hand from its 3D world landmarks (robust to hand rotation, unlike 2D). */
export class HandPoseDetector {
  private readonly o: HandPoseOptions;
  private pose: HandPose = 'open';
  private candidate: HandPose = 'open';
  private count = 0;
  private pinched = false;

  constructor(options: HandPoseOptions) {
    this.o = options;
  }

  update(world: readonly Vec3[]): HandPose {
    const raw = this.classify(world);
    this.count = raw === this.candidate ? this.count + 1 : 1;
    this.candidate = raw;
    if (this.count >= this.o.stableFrames) this.pose = raw;
    return this.pose;
  }

  reset(): void {
    this.pose = this.candidate = 'open';
    this.count = 0;
    this.pinched = false;
  }

  private classify(world: readonly Vec3[]): HandPose {
    const lm = this.o.landmarks;
    const dist = (i: number, j: number) => {
      const a = world[i];
      const b = world[j];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : 0;
    };
    const palm = dist(lm.wrist, lm.middleMcp);
    if (!palm) return this.candidate;
    const extended = (tip: number, pip: number) =>
      dist(lm.wrist, tip) > dist(lm.wrist, pip) * this.o.extendRatio;
    const index = extended(lm.indexTip, lm.indexPip);
    const others = [
      extended(lm.middleTip, lm.middlePip),
      extended(lm.ringTip, lm.ringPip),
      extended(lm.pinkyTip, lm.pinkyPip),
    ];
    const gap = dist(lm.thumbTip, lm.indexTip) / palm;
    this.pinched = gap < (this.pinched ? this.o.pinchOff : this.o.pinchOn);

    // 👌: thumb on index with the other fingers mostly open, so a closing fist never grabs.
    if (this.pinched && others.filter(Boolean).length >= 2) return 'pinch';
    if (!index && !others.some(Boolean)) return 'fist';
    if (index && !others[0]) return 'point';
    return 'open';
  }
}
