import type { EventBus } from '@/core/events';
import type { PinchDetector } from '@/core/gestures/pinchDetector';
import type { PenStateMachine } from '@/core/penStateMachine';
import type { OneEuroFilter } from '@/core/smoothing/oneEuroFilter';
import type { StrokeStore } from '@/core/strokeStore';
import type { AppEvents, Command, InputMode, Point } from '@/core/types';
import type { Webcam } from '@/input/camera/webcam';
import type { HandTracker } from '@/input/tracking/HandTracker';
import type { Renderer } from '@/render/Renderer';
import type { DrawingRepository } from '@/storage/DrawingRepository';
import type { StatusOverlay } from '@/ui/StatusOverlay';

export interface AppDeps {
  video: HTMLVideoElement;
  webcam: Webcam;
  tracker: HandTracker;
  bus: EventBus<AppEvents>;
  renderer: Renderer;
  overlay: StatusOverlay;
  store: StrokeStore;
  pen: PenStateMachine;
  filter: OneEuroFilter;
  pinch: PinchDetector;
  indexTip: number;
  handLostMs: number;
  /** On a spoken "stop", drop the last N ms of the stroke (speech latency overshoot). */
  stopTrimMs: number;
  width: { min: number; max: number; step: number };
  repo: DrawingRepository;
  /** Name the drawing is auto-saved under and restored from. */
  drawingName: string;
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
  private mic = 'off';
  private lastCommand = '';
  private mode: InputMode = 'voice';
  private aspect = 1;
  private savedVersion = 0;

  constructor(deps: AppDeps) {
    this.d = deps;
  }

  async start(): Promise<void> {
    const { bus, webcam, tracker, video, repo, store } = this.d;
    const [saved] = await Promise.all([
      repo.load(this.d.drawingName),
      webcam.start(),
      tracker.init(),
    ]);
    if (saved) store.load(saved.strokes);
    this.savedVersion = store.version;
    this.aspect = video.videoWidth / video.videoHeight;
    video.parentElement?.style.setProperty('--ar', String(this.aspect));

    this.unsubscribe = [
      bus.on('hand:frame', (f) => {
        const tip = f.landmarks[this.d.indexTip];
        if (!tip) return;
        if (this.mode === 'pinch') this.applyPinch(this.d.pinch.update(f.landmarks, this.aspect));
        this.cursor = this.d.filter.filter(tip, f.timestamp);
        this.d.pen.move(this.cursor);
      }),
      bus.on('hand:lost', () => {
        this.cursor = null;
        this.d.filter.reset();
        this.d.pen.lost();
      }),
      bus.on('command', (c) => this.onCommand(c)),
      bus.on('voice:status', (s) => (this.mic = s)),
      bus.on('mode', (m) => {
        this.mode = m;
        this.d.pen.up();
        this.d.pinch.reset();
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
    const { store, pen } = this.d;
    if (store.version !== this.savedVersion) this.save();
    this.d.renderer.render({
      strokes: store.strokes,
      version: store.version,
      current: store.current,
      cursor: this.cursor,
      penDown: pen.state !== 'idle',
      penColor: store.color,
    });
    this.d.overlay.update({
      fps: this.fps,
      hand: this.handVisible,
      pen: pen.state,
      mic: this.mic,
      command: this.lastCommand,
    });
  };

  private onCommand(c: Command): void {
    const { pen, store, width } = this.d;
    this.lastCommand =
      c.type === 'color' ? `color ${c.color}` : c.type === 'width' ? `width ${c.width}` : c.type;
    switch (c.type) {
      case 'draw':
        return pen.down();
      case 'stop':
        if (pen.state !== 'idle') store.trimRecent(this.d.stopTrimMs);
        return pen.up();
      case 'toggle':
        return pen.state === 'idle' ? pen.down() : pen.up();
      case 'clear':
        return store.clear();
      case 'undo':
        return store.undo();
      case 'color':
        return this.setStyle(c.color, store.width);
      case 'width':
        return this.setStyle(store.color, c.width);
      case 'thicker':
        return this.setStyle(store.color, store.width + width.step);
      case 'thinner':
        return this.setStyle(store.color, store.width - width.step);
    }
  }

  private setStyle(color: string, w: number): void {
    const { store, width } = this.d;
    store.color = color;
    store.width = Math.min(width.max, Math.max(width.min, w));
    this.d.bus.emit('pen:style', { color: store.color, width: store.width });
  }

  private save(): void {
    const { repo, store, drawingName } = this.d;
    this.savedVersion = store.version;
    repo
      .save(drawingName, { strokes: store.strokes })
      .catch((err: unknown) => console.warn('Could not save drawing:', err));
  }

  private applyPinch(pinched: boolean): void {
    const { pen } = this.d;
    if (pinched && pen.state === 'idle') pen.down();
    else if (!pinched && pen.state !== 'idle') pen.up();
  }

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
