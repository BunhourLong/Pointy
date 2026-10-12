import type { EventBus } from '@/core/events';
import type { HandPoseDetector } from '@/core/gestures/handPose';
import type { PenStateMachine } from '@/core/penStateMachine';
import type { OneEuroFilter } from '@/core/smoothing/oneEuroFilter';
import type { StrokeGrabber } from '@/core/strokeGrabber';
import type { StrokeStore } from '@/core/strokeStore';
import type { AppEvents, Command, HandFrame, HandPose, InputMode, Point } from '@/core/types';
import type { Webcam } from '@/input/camera/webcam';
import type { HandTracker } from '@/input/tracking/HandTracker';
import { toCanvas } from '@/render/coords';
import type { Rect, Renderer } from '@/render/Renderer';
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
  poses: HandPoseDetector;
  grabber: StrokeGrabber;
  /** Landmarks averaged into the cursor for each pose. */
  anchors: Readonly<Record<HandPose, readonly number[]>>;
  /** Leaving the draw pose drops the stroke's last N ms (the finger moves while curling). */
  releaseTrimMs: number;
  /** Fraction of the frame height. */
  eraserRadius: number;
  trash: Rect;
  handLostMs: number;
  /** On a spoken "stop", drop the last N ms of the stroke (speech latency overshoot). */
  stopTrimMs: number;
  width: { min: number; max: number; step: number };
  repo: DrawingRepository;
  /** Name the drawing is auto-saved under and restored from. */
  drawingName: string;
  saveThrottleMs: number;
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
  private pose: HandPose = 'open';
  private fps = 0;
  private fpsFrames = 0;
  private fpsSince = 0;
  private mic = 'off';
  private lastCommand = '';
  private mode: InputMode = 'voice';
  private aspect = 1;
  private savedVersion = 0;
  private savedAt = 0;

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
      bus.on('hand:frame', (f) => this.onFrame(f)),
      bus.on('hand:lost', () => {
        const { pen, filter, grabber, poses } = this.d;
        grabber.release(false);
        // Hand mode: the pose is unknown until the hand is back, so lift the pen.
        if (this.mode === 'hand') pen.up();
        else pen.lost();
        this.cursor = null;
        this.pose = 'open';
        filter.reset();
        poses.reset();
      }),
      bus.on('command', (c) => this.onCommand(c)),
      bus.on('voice:status', (s) => (this.mic = s)),
      bus.on('mode', (m) => {
        this.mode = m;
        this.d.pen.up();
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
    if (store.version !== this.savedVersion && now - this.savedAt > this.d.saveThrottleMs) {
      this.save(now);
    }
    this.d.renderer.render({
      strokes: store.strokes,
      version: store.version,
      current: store.current,
      cursor: this.cursor,
      tool: this.pose === 'fist' ? 'eraser' : this.pose === 'pinch' ? 'grab' : 'pen',
      penDown: pen.state !== 'idle',
      penColor: store.color,
      holding: this.d.grabber.holding,
      overTrash: this.overTrash(),
    });
    this.d.overlay.update({
      fps: this.fps,
      hand: this.handVisible ? this.pose : '✗',
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

  private save(now: number): void {
    const { repo, store, drawingName } = this.d;
    this.savedVersion = store.version;
    this.savedAt = now;
    repo
      .save(drawingName, { strokes: store.strokes })
      .catch((err: unknown) => console.warn('Could not save drawing:', err));
  }

  /** point/open move the pen, fist erases, pinch grabs. Hand mode: point = pen down. */
  private onFrame(f: HandFrame): void {
    const { poses, filter, pen, store, grabber, anchors } = this.d;
    const pose = poses.update(f.world);
    const prev = this.pose;
    if (pose !== prev) {
      if (prev === 'pinch') grabber.release(this.overTrash()); // where the pinch was, before the cursor moves
      const keepsPen = pose === 'point' || (pose === 'open' && this.mode === 'voice');
      if (!keepsPen && pen.state !== 'idle') {
        store.trimRecent(this.d.releaseTrimMs);
        pen.up();
      }
      if (anchors[prev].join() !== anchors[pose].join()) filter.reset(); // don't glide between landmarks
      this.pose = pose;
    }
    const anchor = average(anchors[pose].map((i) => f.landmarks[i]));
    if (!anchor) return;
    this.cursor = filter.filter(anchor, f.timestamp);

    if (pose === 'fist') return store.erase(this.cursor, this.d.eraserRadius, this.aspect);
    if (pose === 'pinch') {
      if (pose !== prev) grabber.grab(this.cursor, this.aspect);
      else grabber.drag(this.cursor);
      return;
    }
    if (this.mode === 'hand' && pose === 'point') pen.down();
    pen.move(this.cursor);
  }

  private overTrash(): boolean {
    if (!this.d.grabber.holding || !this.cursor) return false;
    const { x, y } = toCanvas(this.cursor, 1, 1); // normalized screen space
    const t = this.d.trash;
    return x >= t.x && x <= t.x + t.w && y >= t.y && y <= t.y + t.h;
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

function average(points: (Point | undefined)[]): Point | null {
  if (!points.length || points.some((p) => !p)) return null;
  const sum = (points as Point[]).reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / points.length, y: sum.y / points.length };
}
