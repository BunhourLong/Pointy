import './styles/main.css';
import { App } from './app/App';
import { config } from './config';
import { EventBus } from './core/events';
import { PenStateMachine } from './core/penStateMachine';
import { OneEuroFilter } from './core/smoothing/oneEuroFilter';
import { StrokeStore } from './core/strokeStore';
import type { AppEvents } from './core/types';
import { Webcam } from './input/camera/webcam';
import { KeyboardInput } from './input/keyboard/KeyboardInput';
import { MediaPipeHandTracker } from './input/tracking/MediaPipeHandTracker';
import { CanvasRenderer } from './render/CanvasRenderer';
import { StatusOverlay } from './ui/StatusOverlay';

// Composition root: the only place that constructs concrete classes.
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = $<HTMLVideoElement>('video');
const overlay = new StatusOverlay($('status'));
const bus = new EventBus<AppEvents>();
const store = new StrokeStore(config.pen.color, config.pen.width);
const keyboard = new KeyboardInput(bus);

const app = new App({
  video,
  webcam: new Webcam(video, config.camera.width, config.camera.height),
  tracker: new MediaPipeHandTracker(config.mediapipe),
  bus,
  renderer: new CanvasRenderer($('committed'), $('live'), {
    cursorRadius: config.cursor.radius,
    cursorUpColor: config.cursor.upColor,
  }),
  overlay,
  store,
  pen: new PenStateMachine(store),
  filter: new OneEuroFilter(config.smoothing),
  indexTip: config.landmarks.indexTip,
  handLostMs: config.handLostMs,
});

overlay.update({ fps: 0, hand: false, pen: 'loading…' });
app.start().catch((err: unknown) => {
  console.error(err);
  const name = err instanceof DOMException ? err.name : '';
  overlay.error(
    name === 'NotAllowedError'
      ? 'Camera access was blocked. Allow it in the site settings and reload.'
      : `Could not start: ${err instanceof Error ? err.message : String(err)}`,
  );
});
window.addEventListener('pagehide', () => {
  keyboard.dispose();
  app.dispose();
});
