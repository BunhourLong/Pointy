import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandFrame } from '@/core/types';
import type { HandTracker } from './HandTracker';

export interface MediaPipeOptions {
  wasmUrl: string;
  modelUrl: string;
  numHands: number;
}

export class MediaPipeHandTracker implements HandTracker {
  private landmarker: HandLandmarker | null = null;
  private readonly options: MediaPipeOptions;

  constructor(options: MediaPipeOptions) {
    this.options = options;
  }

  async init(): Promise<void> {
    const fileset = await FilesetResolver.forVisionTasks(this.options.wasmUrl);
    const create = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: this.options.modelUrl, delegate },
        runningMode: 'VIDEO',
        numHands: this.options.numHands,
      });
    // GPU is much faster but unavailable on some machines/browsers.
    this.landmarker = await create('GPU').catch(() => create('CPU'));
  }

  detect(video: HTMLVideoElement, timestamp: number): HandFrame | null {
    const hand = this.landmarker?.detectForVideo(video, timestamp).landmarks[0];
    return hand ? { landmarks: hand.map(({ x, y }) => ({ x, y })), timestamp } : null;
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
  }
}
