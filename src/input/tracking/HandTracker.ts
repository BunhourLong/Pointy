import type { HandFrame } from '@/core/types';

export interface HandTracker {
  init(): Promise<void>;
  /** Returns the first detected hand, or null. `timestamp` must increase monotonically. */
  detect(video: HTMLVideoElement, timestamp: number): HandFrame | null;
  dispose(): void;
}
