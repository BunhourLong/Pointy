import type { EventBus } from '@/core/events';
import type { AppEvents, Point } from '@/core/types';
import type { Webcam } from '@/input/camera/webcam';
import type { HandTracker } from '@/input/tracking/HandTracker';
import type { Renderer } from '@/render/Renderer';
import type { StatusOverlay } from '@/ui/StatusOverlay';

export interface AppDeps {
  video: HTMLVideoElement;
  webcam: Webcam;
  tracker: HandTracker;
  bus: EventBus<AppEvents>;
  renderer: Renderer;
  overlay: StatusOverlay;
  indexTip: number;
  handLostMs: number;
}

/** Owns the lifecycle and the rAF detection/render loop. */
export class App {
  private readonly d: AppDeps;
  private raf = 0;
  private unsubscribe: (() => void)[] = [];
  private lastVideoTime = -1;
  private lastSeen = 0;
  private handVisible = false;
  private cursor: Point | null = null;
  private fps = 0;
  private fpsFrames = 0;
  private fpsSince = 0;

  constructor(deps: AppDeps) {
    this.d = deps;
  }

  async start(): Promise<void> {
    const { bus, webcam, tracker, video } = this.d;
    await Promise.all([webcam.start(), tracker.init()]);
    video.parentElement?.style.setProperty('--ar', String(video.videoWidth / video.videoHeight));

    this.unsubscribe = [
      bus.on('hand:frame', (f) => {
        this.cursor = f.landmarks[this.d.indexTip] ?? null;
      }),
      bus.on('hand:lost', () => {
        this.cursor = null;
      }),
    ];
    this.raf = requestAnimationFrame(this.tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.unsubscribe.forEach((off) => off());
    this.unsubscribe = [];
  }

  dispose(): void {
    this.stop();
    this.d.tracker.dispose();
    this.d.webcam.dispose();
    this.d.renderer.dispose();
  }

  private tick = (now: number): void => {
    this.raf = requestAnimationFrame(this.tick);
    const { video } = this.d;
    if (video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = video.currentTime;
      this.detect(now);
    }
    this.d.renderer.render({
      strokes: [],
      version: 0,
      current: null,
      cursor: this.cursor,
      penDown: false,
      penColor: '',
    });
    this.d.overlay.update({ fps: this.fps, hand: this.handVisible, pen: 'idle' });
  };

  private detect(now: number): void {
    const { bus, tracker, video, handLostMs } = this.d;
    const frame = tracker.detect(video, now);
    this.countFps(now);
    if (frame) {
      this.lastSeen = now;
      this.handVisible = true;
      bus.emit('hand:frame', frame);
    } else if (this.handVisible && now - this.lastSeen > handLostMs) {
      this.handVisible = false;
      bus.emit('hand:lost', { timestamp: now });
    }
  }

  /** Detections per second, updated once a second. */
  private countFps(now: number): void {
    this.fpsFrames++;
    if (now - this.fpsSince >= 1000) {
      this.fps = (this.fpsFrames * 1000) / (now - this.fpsSince);
      this.fpsFrames = 0;
      this.fpsSince = now;
    }
  }
}
